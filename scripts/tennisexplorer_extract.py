"""
TennisExplorer match-detail extractor.

Parses a tennisexplorer.com match-detail page into a structured dict that maps
onto the `tennis_matches` schema (player1_name, player2_name, tournament, round,
status, winner_name, score) plus head-to-head history and per-surface W/L splits.

This is the parsing core. It is import-safe (no side effects) so it can be unit
tested and reused by the orchestration script.
"""
from __future__ import annotations

import re
from typing import Optional, TypedDict


# Map tennisexplorer round labels -> internal round codes used elsewhere.
ROUND_MAP = {
    "final": "F",
    "semifinal": "SF",
    "quarterfinal": "QF",
    "round of 16": "R16",
    "round of 32": "R32",
    "round of 64": "R64",
    "round of 128": "R128",
    "1/8 finals": "R16",
    "1/16 finals": "R32",
    "1/32 finals": "R64",
    "1/64 finals": "R128",
    "1. round": "R1",
    "2. round": "R2",
    "3. round": "R3",
    "qualification": "Q",
}


class MatchHeader(TypedDict, total=False):
    player1_name: str
    player2_name: str
    player1_profile: str
    player2_profile: str
    tournament: str
    round: str
    round_raw: str
    surface: str
    date_label: str
    time: str


def _clean(text: str) -> str:
    """Collapse whitespace and strip."""
    return re.sub(r"\s+", " ", (text or "")).strip()


def normalize_round(raw: str) -> str:
    """Map a tennisexplorer round label to an internal round code."""
    key = _clean(raw).lower()
    return ROUND_MAP.get(key, raw.strip() if raw else "")


def parse_match_id(url: str) -> Optional[str]:
    """Extract the numeric match id from a match-detail URL."""
    m = re.search(r"[?&]id=(\d+)", url)
    return m.group(1) if m else None


def parse_header(page) -> MatchHeader:
    """
    Parse the match header (players, tournament, round, surface, time) from a
    tennisexplorer match-detail Scrapling page object.
    """
    header: MatchHeader = {}

    # The first box in #center carries comma-separated meta in a stable order:
    #   "<date>, <HH:MM>, <tournament>, <round>, <surface>"
    # e.g. "Today, 14:15, French Open, quarterfinal, clay"
    #      "01.06.2026, 02:10, UTR Pro Tennis Series 3, -, -"  (round/surface absent)
    boxes = page.css("#center .box")
    if boxes:
        meta = _clean(boxes[0].get_all_text(strip=True))
        parts = [p.strip() for p in meta.split(",") if p.strip()]

        def _val(tok: Optional[str]) -> Optional[str]:
            """Treat placeholder '-' as missing."""
            return tok if tok and tok != "-" else None

        # Anchor on the time token; fields follow it positionally.
        time_idx = next((i for i, p in enumerate(parts)
                         if re.fullmatch(r"\d{1,2}:\d{2}", p)), None)
        if time_idx is not None:
            header["time"] = parts[time_idx]
            if time_idx >= 1:
                header["date_label"] = _val(parts[time_idx - 1])
            tournament = _val(parts[time_idx + 1]) if time_idx + 1 < len(parts) else None
            round_raw = _val(parts[time_idx + 2]) if time_idx + 2 < len(parts) else None
            surface = _val(parts[time_idx + 3]) if time_idx + 3 < len(parts) else None
            if tournament:
                header["tournament"] = tournament
            if round_raw:
                header["round_raw"] = round_raw
                header["round"] = normalize_round(round_raw)
            surfaces = {"clay", "hard", "grass", "indoors", "carpet"}
            if surface and surface.lower() in surfaces:
                header["surface"] = surface.capitalize()

    # Player names + profile URLs come from the header player links.
    center = page.css("#center").first
    if center:
        seen = []
        for a in center.css("a"):
            href = a.attrib.get("href", "")
            if "/player/" in href and href not in [s[1] for s in seen]:
                seen.append((_clean(a.get_all_text(strip=True)), href))
            if len(seen) >= 2:
                break
        if len(seen) >= 1:
            header["player1_name"] = seen[0][0]
            header["player1_profile"] = seen[0][1]
        if len(seen) >= 2:
            header["player2_name"] = seen[1][0]
            header["player2_profile"] = seen[1][1]

    return header


def parse_score(page, header: Optional[MatchHeader] = None) -> tuple[Optional[str], Optional[str], str]:
    """
    Determine match score, winner, and status.

    Returns (score, winner_name, status) where status is 'upcoming' or 'completed'.

    For a played match, tennisexplorer renders box[1] as:
        "{HomePlayer} {SetsHome} : {SetsAway} ({game scores}) {AwayPlayer} ..."
    e.g. "Jodar Rafael 3 : 2 (4-6, 4-6, 6-1, 6-2, 6-2) Carreno-Busta Pablo".
    An unplayed match has no sets score in box[1].
    """
    boxes = page.css("#center .box")
    if len(boxes) < 2:
        return None, None, "upcoming"

    text = _clean(boxes[1].get_all_text(strip=True))

    # Sets score, e.g. "3 : 2". Anchor it before the optional game-score paren.
    sets_match = re.search(r"(\d)\s*:\s*(\d)", text)
    if not sets_match:
        return None, None, "upcoming"

    sets_home, sets_away = int(sets_match.group(1)), int(sets_match.group(2))

    # Home player name = text before the sets score.
    home_name = _clean(text[: sets_match.start()])

    # Game scores inside parentheses, e.g. "(4-6, 4-6, 6-1)" or "(7-6 5 , 5-7, 6-0)"
    # where a trailing number after a set is the tiebreak points (7-6 5 -> 7-6(5)).
    games_match = re.search(r"\(([^)]*\d+-\d+[^)]*)\)", text[sets_match.end():])
    if games_match:
        raw_sets = [s.strip() for s in games_match.group(1).split(",") if s.strip()]
        normalized = []
        for s in raw_sets:
            # "7-6 5" -> "7-6(5)"; plain "5-7" stays as-is.
            tb = re.match(r"^(\d+-\d+)\s+(\d+)$", s)
            normalized.append(f"{tb.group(1)}({tb.group(2)})" if tb else s)
        score = " ".join(normalized)
    else:
        score = f"{sets_home}-{sets_away}"

    # Determine winner: home player if they won more sets.
    winner = None
    if header and home_name:
        p1 = header.get("player1_name", "")
        p2 = header.get("player2_name", "")
        # Match the home name to one of the header players (substring/last-name match).
        home_is_p1 = _name_matches(home_name, p1)
        home_is_p2 = _name_matches(home_name, p2)
        if sets_home > sets_away:
            winner = p1 if home_is_p1 else (p2 if home_is_p2 else home_name)
        elif sets_away > sets_home:
            winner = p2 if home_is_p1 else (p1 if home_is_p2 else None)
    elif home_name:
        winner = home_name if sets_home > sets_away else None

    return score, winner, "completed"


def _name_matches(a: str, b: str) -> bool:
    """Loose name comparison: case-insensitive token overlap on surname."""
    if not a or not b:
        return False
    a_tokens = set(re.sub(r"[^a-zA-Z\s-]", "", a).lower().split())
    b_tokens = set(re.sub(r"[^a-zA-Z\s-]", "", b).lower().split())
    return bool(a_tokens & b_tokens)


def parse_h2h(page) -> dict:
    """
    Parse the two 'Latest matches' (result mutual) tables into recent-form lists
    for each player. Returns {'player1': [...], 'player2': [...]}.
    """
    result = {"player1": [], "player2": []}
    tables = page.css("table.result.mutual")
    keys = ["player1", "player2"]

    for idx, table in enumerate(tables[:2]):
        rows = table.css("tr")
        entries = []
        pending_meta = None
        for r in rows:
            cells = [_clean(c.get_all_text(strip=True)) for c in r.css("td")]
            if not cells:
                continue
            # A meta row has a single cell like "French Open , R16 , 31.05.2026"
            if len(cells) == 1 and re.search(r"\d{2}\.\d{2}\.\d{4}", cells[0]):
                pending_meta = cells[0]
            elif len(cells) >= 2 and pending_meta:
                # Match row: ['', 'Jodar - Carreno-Busta', '3:2']
                matchup = next((c for c in cells if " - " in c or "-" in c and c), "")
                score = cells[-1]
                meta_parts = [p.strip() for p in pending_meta.split(",")]
                entries.append({
                    "tournament": meta_parts[0] if meta_parts else "",
                    "round": meta_parts[1] if len(meta_parts) > 1 else "",
                    "date": meta_parts[2] if len(meta_parts) > 2 else "",
                    "matchup": matchup,
                    "score": score,
                })
                pending_meta = None
        result[keys[idx]] = entries

    return result


def _split_record(token: str) -> Optional[dict]:
    """Parse a 'wins/losses' token like '19/3' into {'won':19,'lost':3,...}."""
    token = (token or "").strip()
    m = re.fullmatch(r"(\d+)\s*/\s*(\d+)", token)
    if not m:
        return None
    won, lost = int(m.group(1)), int(m.group(2))
    played = won + lost
    return {
        "won": won,
        "lost": lost,
        "played": played,
        "win_pct": round(won / played * 100, 1) if played else None,
    }


def _result_balance_tables(page):
    """Return the .result.balance tables inside #center (DOM-stable selector)."""
    center = page.css("#center").first
    if not center:
        return []
    return center.css("table.result.balance")


def parse_surface_wl(page) -> dict:
    """
    Parse the head-to-head surface W/L comparison table.

    This is the FIRST .result.balance table whose header row starts with
    'Surface'. Layout: ['Surface', '<p1 name>', '<p2 name>'] then rows like
    ['Clay', '19/3', '17/4']. Returns {surface: {player1, player2}} with each
    value a parsed record dict.
    """
    for table in _result_balance_tables(page):
        rows = table.css("tr")
        if not rows:
            continue
        head = [_clean(c.get_all_text(strip=True)) for c in rows[0].css("td,th")]
        if not head or head[0].lower() != "surface":
            continue
        surfaces = {}
        for r in rows[1:]:
            cells = [_clean(c.get_all_text(strip=True)) for c in r.css("td,th")]
            if len(cells) >= 3 and cells[0]:
                surfaces[cells[0]] = {
                    "player1": _split_record(cells[1]),
                    "player2": _split_record(cells[2]),
                }
        return surfaces
    return {}


def parse_year_by_year(page) -> dict:
    """
    Parse the two per-player year-by-year W/L tables.

    These are the .result.balance tables whose header row starts with 'Year'
    and lists surface columns: ['Year','Summary','Clay','Hard','Indoors',
    'Grass','Not set']. The first such table is player1, the second player2.

    Returns {'player1': {year: {surface: record}}, 'player2': {...}} where the
    'Summary'/'Summary:' row is stored under the key 'all'.
    """
    out = {"player1": {}, "player2": {}}
    slot = ["player1", "player2"]
    found = 0

    for table in _result_balance_tables(page):
        rows = table.css("tr")
        if not rows:
            continue
        head = [_clean(c.get_all_text(strip=True)) for c in rows[0].css("td,th")]
        if not head or head[0].lower() != "year":
            continue
        if found >= 2:
            break

        # Column index -> surface label (skip col 0 = year, col 1 = Summary).
        surf_cols = {i: head[i] for i in range(1, len(head))}
        year_map = {}
        for r in rows[1:]:
            cells = [_clean(c.get_all_text(strip=True)) for c in r.css("td,th")]
            if not cells or not cells[0]:
                continue
            year_label = cells[0].rstrip(":").strip()
            year_key = "all" if year_label.lower() == "summary" else year_label
            surf_records = {}
            for i, surf in surf_cols.items():
                if i < len(cells):
                    rec = _split_record(cells[i])
                    surf_label = "Total" if surf.lower() == "summary" else surf
                    if rec:
                        surf_records[surf_label] = rec
            if surf_records:
                year_map[year_key] = surf_records
        out[slot[found]] = year_map
        found += 1

    return out


def parse_bios(page) -> dict:
    """
    Parse the player bio comparison table (.result.gDetail).

    Layout rows (3 cells each, p1 | label | p2):
        ['<p1 name>', '', '<p2 name>']
        ['', '29.', 'Singles ranking', '3.', '']  (5-cell ranking row)
        ['17. 9. 2006', 'Birthdate', '20. 4. 1997']
        ['-', 'Height', '198 cm']
        ['-', 'Weight', '90 kg']
        ['right', 'Plays', 'right']
        ['-', 'Turned pro', '-']
    Returns {'player1': {...}, 'player2': {...}}.
    """
    bios = {"player1": {}, "player2": {}}
    center = page.css("#center").first
    if not center:
        return bios
    tables = center.css("table.result.gDetail")
    if not tables:
        return bios

    rows = tables[0].css("tr")
    label_map = {
        "singles ranking": "rank_singles",
        "doubles ranking": "rank_doubles",
        "birthdate": "birthdate",
        "height": "height",
        "weight": "weight",
        "plays": "plays",
        "turned pro": "turned_pro",
    }

    for r in rows:
        cells = [_clean(c.get_all_text(strip=True)) for c in r.css("td,th")]
        cells = [c for c in cells if c != ""]
        if len(cells) < 3:
            continue
        # Identify the label cell (middle).
        label = cells[1].lower()
        if label not in label_map:
            # 5-cell ranking row collapses to [p1val, label, p2val] after dropping blanks.
            continue
        key = label_map[label]
        bios["player1"][key] = cells[0]
        bios["player2"][key] = cells[2]

    return bios


def parse_profile_slug(profile_url: str) -> Optional[str]:
    """Extract the tennisexplorer player slug from a /player/<slug>/ URL."""
    if not profile_url:
        return None
    m = re.search(r"/player/([^/?]+)", profile_url)
    return m.group(1) if m else None


def parse_match_odds(page) -> Optional[dict]:
    """
    Parse the match-winner average decimal odds.

    The first 'Average odds' row on the page corresponds to the head-to-head
    (match winner) market: ['Average odds', '<p1 odds>', '<p2 odds>'].
    Later 'Average odds' rows belong to over/under, handicap and correct-score
    markets and are ignored. Returns {'player1_odds', 'player2_odds'} or None.
    """
    center = page.css("#center").first
    if not center:
        return None
    for table in center.css("table"):
        for r in table.css("tr"):
            cells = [_clean(c.get_all_text(strip=True)) for c in r.css("td,th")]
            if cells and cells[0].lower() == "average odds":
                nums = []
                for c in cells[1:]:
                    try:
                        nums.append(float(c))
                    except ValueError:
                        continue
                # Match-winner market has exactly two odds.
                if len(nums) == 2:
                    return {"player1_odds": nums[0], "player2_odds": nums[1]}
                # Defensive: if the first row had extra tokens, take first two.
                if len(nums) > 2:
                    return {"player1_odds": nums[0], "player2_odds": nums[1]}
    return None


def extract_match(page, url: str) -> dict:
    """
    Top-level extraction: combine header, score/status, H2H, surface splits,
    year-by-year W/L and player bios into a single structured dict.

    Produces a `tennis_matches`-shaped dict plus all enrichment data needed to
    populate tennis_players, tennis_raw_stats (year/surface W/L) and odds.
    """
    header = parse_header(page)
    score, winner, status = parse_score(page, header)

    p1 = header.get("player1_name")
    p2 = header.get("player2_name")
    # Deterministic ordering for dedup, matching the existing scraper convention.
    if p1 and p2:
        ordered = sorted([p1, p2])
    else:
        ordered = [p1, p2]

    match_record = {
        "match_id": parse_match_id(url),
        "tournament": header.get("tournament"),
        "round": header.get("round"),
        "surface": header.get("surface"),
        "player1_name": ordered[0],
        "player2_name": ordered[1],
        "status": status,
        "winner_name": winner,
        "score": score,
        "scheduled_time": header.get("time"),
        "date_label": header.get("date_label"),
        "source_url": url,
    }

    return {
        "match": match_record,
        "header": header,
        "players": {
            "player1": {
                "name": header.get("player1_name"),
                "profile_url": header.get("player1_profile"),
                "slug": parse_profile_slug(header.get("player1_profile", "")),
            },
            "player2": {
                "name": header.get("player2_name"),
                "profile_url": header.get("player2_profile"),
                "slug": parse_profile_slug(header.get("player2_profile", "")),
            },
        },
        "bios": parse_bios(page),
        "h2h": parse_h2h(page),
        "surface_wl": parse_surface_wl(page),
        "year_by_year": parse_year_by_year(page),
        "odds": parse_match_odds(page),
    }
