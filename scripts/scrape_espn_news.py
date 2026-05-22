"""
ESPN News Scraper
Fetches news articles from ESPN's public API and stores them in Supabase.
Runs hourly via GitHub Actions.

Usage:
  python scripts/scrape_espn_news.py
"""

import os
import sys
import json
import time
import logging
import re
from datetime import datetime, timezone
from pathlib import Path

import requests

# Setup logging
log_dir = Path("scripts/logs")
log_dir.mkdir(exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(log_dir / "espn_news_scraper.log"),
        logging.StreamHandler(),
    ],
)
logger = logging.getLogger(__name__)

# Load env
env_path = Path(".env.local")
if env_path.exists():
    for line in env_path.read_text().splitlines():
        if "=" in line and not line.startswith("#"):
            key, val = line.split("=", 1)
            os.environ.setdefault(key.strip(), val.strip())

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    logger.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
    sys.exit(1)

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates",
}

# ESPN feeds to scrape
ESPN_FEEDS = [
    {"name": "Premier League", "url": "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/news?limit=15", "category": "Football"},
    {"name": "NBA", "url": "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/news?limit=15", "category": "NBA"},
    {"name": "NFL", "url": "https://site.api.espn.com/apis/site/v2/sports/football/nfl/news?limit=10", "category": "NFL"},
    {"name": "UFC", "url": "https://site.api.espn.com/apis/site/v2/sports/mma/ufc/news?limit=8", "category": "UFC"},
    {"name": "Tennis", "url": "https://site.api.espn.com/apis/site/v2/sports/tennis/news?limit=8", "category": "Tennis"},
    {"name": "F1", "url": "https://site.api.espn.com/apis/site/v2/sports/racing/f1/news?limit=8", "category": "F1"},
    {"name": "Cricket", "url": "https://site.api.espn.com/apis/site/v2/sports/cricket/news?limit=8", "category": "Cricket"},
]


def upgrade_image_url(url: str) -> str:
    """Upgrade ESPN CDN image URLs to 1296x729 resolution."""
    if not url:
        return url
    return re.sub(r"_\d+x\d+_\d+-\d+\.", "_1296x729_16-9.", url)


def pick_best_image(images: list) -> str | None:
    """Pick the widest image and upgrade to high-res."""
    if not images:
        return None
    sorted_imgs = sorted(images, key=lambda x: x.get("width", 0), reverse=True)
    url = sorted_imgs[0].get("url")
    return upgrade_image_url(url) if url else None


def fetch_full_article(article_id: str) -> dict | None:
    """Fetch full article story from ESPN core API."""
    try:
        resp = requests.get(
            f"https://now.core.api.espn.com/v1/sports/news/{article_id}",
            headers={"User-Agent": "Lasyly/1.0"},
            timeout=10,
        )
        if resp.status_code != 200:
            return None
        data = resp.json()
        headlines = data.get("headlines", [])
        if not headlines:
            return None
        h = headlines[0]
        return {
            "story": h.get("story"),
            "byline": h.get("byline"),
        }
    except Exception as e:
        logger.warning(f"Failed to fetch full article {article_id}: {e}")
        return None


def fetch_feed(feed: dict) -> list[dict]:
    """Fetch articles from one ESPN feed."""
    try:
        resp = requests.get(feed["url"], headers={"User-Agent": "Lasyly/1.0"}, timeout=15)
        if resp.status_code != 200:
            logger.warning(f"Feed {feed['name']} returned {resp.status_code}")
            return []
        data = resp.json()
        articles = data.get("articles", [])
        results = []
        for article in articles:
            article_id = str(article.get("id", ""))
            headline = article.get("headline", "")
            if not article_id or not headline:
                continue
            link = article.get("links", {}).get("web", {}).get("href", "")
            image = pick_best_image(article.get("images", []))
            results.append({
                "id": article_id,
                "headline": headline,
                "description": article.get("description", ""),
                "published_at": article.get("published", datetime.now(timezone.utc).isoformat()),
                "source": feed["name"],
                "category": feed["category"],
                "image_url": image,
                "link": link,
                "article_type": article.get("type", "HeadlineNews"),
            })
        return results
    except Exception as e:
        logger.error(f"Error fetching feed {feed['name']}: {e}")
        return []


def fetch_stories_for_articles(articles: list[dict]) -> list[dict]:
    """Fetch full story for HeadlineNews articles."""
    for article in articles:
        # Ensure all articles have story and byline keys
        if "story" not in article:
            article["story"] = None
        if "byline" not in article:
            article["byline"] = None

        if article.get("article_type") == "HeadlineNews":
            full = fetch_full_article(article["id"])
            if full:
                article["story"] = full.get("story")
                article["byline"] = full.get("byline")
            time.sleep(0.5)  # Be nice to ESPN
    return articles


def upsert_to_supabase(articles: list[dict]) -> int:
    """Upsert articles to Supabase."""
    if not articles:
        return 0
    # Batch in groups of 50
    total = 0
    for i in range(0, len(articles), 50):
        batch = articles[i:i+50]
        resp = requests.post(
            f"{SUPABASE_URL}/rest/v1/espn_news",
            headers=HEADERS,
            json=batch,
        )
        if resp.status_code in (200, 201):
            total += len(batch)
        else:
            logger.error(f"Upsert failed: {resp.status_code} {resp.text[:200]}")
    return total


def main():
    logger.info("=" * 60)
    logger.info("ESPN News Scraper — Starting")
    logger.info("=" * 60)

    all_articles = []

    for feed in ESPN_FEEDS:
        logger.info(f"Fetching: {feed['name']} ({feed['category']})")
        articles = fetch_feed(feed)
        logger.info(f"  → Got {len(articles)} articles")
        all_articles.extend(articles)
        time.sleep(1)

    logger.info(f"Total articles fetched: {len(all_articles)}")

    # Fetch full stories for headline articles
    logger.info("Fetching full stories for HeadlineNews articles...")
    headline_articles = [a for a in all_articles if a.get("article_type") == "HeadlineNews"]
    logger.info(f"  → {len(headline_articles)} headline articles to fetch stories for")
    all_articles = fetch_stories_for_articles(all_articles)

    # Upsert to Supabase
    logger.info("Upserting to Supabase...")
    count = upsert_to_supabase(all_articles)
    logger.info(f"  → Upserted {count} articles")

    logger.info("Done!")


if __name__ == "__main__":
    main()
