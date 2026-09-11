# Lasyly — Legal Copy Audit & Rewrite

**Prepared:** September 9, 2026
**Scope:** All user-facing wording (marketing, UI, disclaimers, Terms, Creator Terms, Privacy).
**Operator context:** India-based sports analytics/community platform, potentially international users.

> **NOT LEGAL ADVICE.** This is a copy-and-risk audit by a non-lawyer, grounded in primary and authoritative sources current to September 2026. Several conclusions require sign-off from a qualified Indian lawyer before launch. Those are flagged explicitly. Do not treat any wording here as conferring legal immunity.

---

## PART 1 — EXECUTIVE VERDICT

### The single most important finding
The audit of the actual code (not just the copy) surfaced a discrepancy that dominates everything else: **the marketing and Terms describe a live, operational paid-picks economy — Stripe wallet, top-ups, "instant payouts", an 85/15 revenue split, subscriptions — but in the code that economy is not built.** The Wallet page is a "Coming Soon" stub, the Pro/billing CTA is disabled ("Upgrade — coming soon"), and the only implemented monetization primitive is a per-betslip "Premium Pick / Lock selections behind a paywall" price toggle. So the site currently **advertises a money flow that does not exist yet.** That is both a consumer-protection/misleading-advertising problem and a chance to fix the legal design *before* it ships rather than after.

### Currently safe (GREEN)
- The core analytics framing *inside the app* (hit rates, L5/L10 splits, matchup grades, confidence as a weighted historical score, streak dots). These are described as historical frequency, not guarantees. Good.
- The existing "Not a sportsbook … informational purposes only" footer and the Terms §3 non-wagering statements. Correct direction, but incomplete for India (see below).
- The new Data Sources page's in-house/estimate framing and non-affiliation disclaimer.

### Questionable (YELLOW)
- Marketing verbs and headlines built around **"win"** ("Win more. Do less.", "Stop guessing. Start winning lazily.", "the laziest way to win at sports"). Not fatal, but for an India-based operator post-PROG Act, "win at sports [betting]" framing is the kind of language regulators scrutinize. Reframe toward research/analysis.
- **Sports Reference data.** Their published policies say most data is licensed from third parties who preclude bulk redistribution, and they "cannot give explicit permission to reuse en masse." Presenting derived analytics is more defensible than redistributing raw stat tables, but the current copy that we already softened still sits on top of a scraping pipeline. This is a real IP/contract question, not a copy question.
- Terms §7.2 claiming **"all analytics … are the intellectual property of Lasyly"** and §7.3 invoking **"fair use"** — both overclaim. You cannot own raw facts, and "fair use" is a US doctrine that does not neatly map to India and shouldn't be used as a blanket justification.

### Must change immediately (RED)
> Calibration note: the RED label here reflects the **advertising, unbuilt-feature, and misleading-claim** problems, which are relatively clear. It does **not** assert that the PROG Act definitely applies to paid pick communities — that specific legal characterization is genuinely uncertain and is a lawyer question (see "Needs a lawyer"). The point is to reduce avoidable exposure now, not to declare the feature unlawful.

1. **Marketing copy that advertises a paid-picks economy as a headline product to Indian users.** Under the **Promotion and Regulation of Online Gaming Act, 2025** (in force **1 May 2026**), *offering, advertising, and facilitating payments* for "online money games" is prohibited **irrespective of skill vs. chance**, with penalties reported up to 3 years' imprisonment and ₹1 crore fines ([Deloitte](https://www.deloitte.com/content/dam/assets-zone1/in/en/docs/services/tax/2025/tax-alerts/in-regulatory-tax-the-promotion-and-regulation-of-online-gaming-bill-2025.pdf), [Bar & Bench](https://www.barandbench.com/news/litigation/cci-closes-winzo-antitrust-case-against-google-after-online-gaming-ban)). **Whether a paid tipster pick — where the user buys a creator's content and no stake is placed, held, or settled through Lasyly — is an "online money game" is genuinely unsettled.** There's a reasonable argument it is not (it is content access, closer to a paid newsletter than a wager). But the *advertising* and *payment-facilitation* language in the Act is broad, so the conservative move is: reframe the marketing away from "sell your betting picks / keep 85% / instant payouts," and treat the paid feature itself as hold-for-counsel rather than launch-and-hope. The urgency is about not *advertising* an uncleared monetized flow — not a conclusion that the flow is illegal.
2. **Sportsbook-branded UI** (the betslip modal's "Sportsbook" dropdown listing Bet365, 1xBet, DraftKings, etc.). Listing named betting operators inside platform-controlled UI run from India is closer to promotion of those operators than the rest of the product, and it's low-cost to neutralize. Making the field sportsbook-agnostic removes the exposure without hurting the feature. (The odds/stake fields are the user's own record of an external slip and are lower-risk.)
3. **Terms/Privacy silent on India + priced in USD.** For an India operator you should name governing law/jurisdiction (currently "applicable laws" + binding arbitration with no seat) and reconcile USD pricing. This is a clarity/consistency fix, not a claim about outcome.
4. **"Fair use" and "all analytics are our IP"** clauses — rewrite (Part 5). These overclaim regardless of the gaming question.

### Needs a lawyer (before launch)
- Whether the paid-picks feature is lawful for Indian users under the PROG Act and Rules.
- Sports Reference / PFR / third-party data licensing and scraping exposure (US-owned providers; their terms bind you contractually regardless of where you sit).
- Payment design (Stripe USD vs. India, GST, TDS on creator payouts, FEMA if cross-border).
- Consumer-protection/misleading-ad review of performance and earnings claims.

---

## PART 2 — BRAND POSITIONING

**One sentence:**
> Lasyly is a free sports analytics and community platform where fans research player and team performance and independent creators publish their own sports analysis — not a sportsbook, and never a place to place, hold, or settle a wager.

**One paragraph:**
> Lasyly turns raw sports statistics into research anyone can use: hit rates, matchup grades, trends, and consistency signals, all calculated in-house from historical performance. Around that sits a community layer where creators run their own public and private rooms to share analysis, opinions, and predictions. Lasyly does not accept wagers, run betting games, hold betting stakes, set or offer odds, decide any outcome, or pay winnings. Creator opinions are the creator's own. Everything on Lasyly is for information and analysis — the decisions are yours, and following the laws that apply to you is your responsibility.

---

## PART 3 — FULL WEBSITE COPY AUDIT

Format: **Current → Recommended → Why.**

### 3.1 Landing (`app/(marketing)/page.tsx`)

- **Meta title** — Current: "Lasyly — Prop Analytics, Rooms & Pick Marketplace." → Recommended: "Lasyly — Sports Prop Analytics, Community Rooms & Creator Picks." → *Why:* "Marketplace" reads like a transactional betting product; "creator picks" is accurate and softer.
- **Meta desc / hero sub** — Current: "The laziest way to win at sports… a pick marketplace where you keep 85%." → Recommended: "Sports research the lazy way — real hit rates, live scores across 10+ sports, community rooms, and independent creator analysis. Free." → *Why:* removes "win at sports" + the earnings promise from indexed metadata; keeps energy.
- **H1** — Current: "Win more. Do less." → Recommended: "Know more. Do less." (or "See more. Do less.") → *Why:* preserves the rhythm and brand voice while dropping the outcome guarantee implied by "win."
- **Stats strip "Seller revenue share 85%"** → Recommended: remove from the public landing page until the payout feature is real and India-cleared; if kept, label "Creator revenue share (where available)." → *Why:* advertises an unbuilt, high-risk money flow as a headline stat.
- **Feature 04 "Pick marketplace / Sell your picks and keep 85%…"** → Recommended: "Creator picks — Independent creators share analysis and picks in their own rooms. Follow the track records you trust." → *Why:* accurately positions creators as the speakers; drops the earnings headline.
- **Feature 05 "Pick tracker … track win rate, ROI, and net profit"** → Recommended keep, but label as *your own logged results*: "Log your picks and track your hit rate, ROI, and net result over time." → *Why:* fine as a personal analytics tool; "net profit" is okay when it's the user's own tracker, not a promise.
- **Seller section "Your edge is worth money. Start earning it." / "Start selling picks"** → Recommended: gate this entire section behind region/feature availability and reword to "Creator tools — publish your analysis" until payouts are live and cleared. → *Why:* this is the densest cluster of "advertising a paid picks economy" copy; highest PROG-Act exposure.
- **FAQ "Is Lasyly a sportsbook?"** → keep, strengthen: add "We also do not hold betting funds, settle bets, or pay winnings, and we are not affiliated with any sportsbook." → *Why:* completes the negative-scope statement.
- **FAQ "How does the pick marketplace work?"** → Recommended: "Creators can open rooms and share their own analysis and picks. Where creator monetization is available, members pay for access to that creator's content — not to place any bet. Availability varies by region." → *Why:* preserves the buying-content-vs-wagering distinction the brief requires.
- **Final CTA "Stop guessing. Start winning lazily."** → Recommended: "Stop guessing. Start researching." → *Why:* same reason as H1.

### 3.2 Features (`app/(marketing)/features/page.tsx`)
- **Feature 05 "Sell what you know / A Stripe-backed credit system runs the pick economy… Buyers load credits and unlock picks"** → Recommended: "Creator tools — Independent creators can run rooms and, where available, offer paid access to their own content. Payments are for content/community access, not wagers." → *Why:* removes "pick economy" transactional framing and the implied live Stripe wallet.
- **Comparison table row "Seller monetization (85%)"** → Recommended: "Creator monetization (where available)"; footnote it. → *Why:* don't headline an unbuilt/uncleared feature as a competitive checkmark.

### 3.3 Tipsters page (`app/(marketing)/tipsters/page.tsx`) — highest-risk page
This page (meta "sell their picks… keep 85%", "Your edge. Your income.", the revenue calculator, "instant payouts", "monthly subscription") is the most exposed single artifact. Recommendation: **do not ship this page to Indian users in its current form.** Rework as a "Creators" page:
- **H1 "Your edge. Your income."** → "Your analysis. Your audience."
- **"Sell picks… keep 85% of every sale"** → "Publish your analysis in your own room. Where creator monetization is available in your region, keep the majority of what members pay for access — we take a platform fee."
- **Revenue calculator ($1,000/mo, "No caps")** → remove, or replace with a non-numeric "creators keep the majority; a platform fee applies" statement. → *Why:* concrete earnings projections are classic misleading-advertising and inducement territory. (Separately, whether the underlying paid feature engages the PROG Act at all is unsettled and a lawyer question — but the earnings-projection copy is a problem on ordinary consumer-protection grounds regardless of how that question resolves.)
- **"withdrawn via Stripe… payouts processed automatically"** → don't state as live until it is; "Payout options and availability depend on your region."

### 3.4 Compare / Props / Players / Scores / Blog
- **Compare page** lists competitors as "sports betting tools." → Recommended: "sports analytics tools." Keep factual feature comparisons; drop the "betting" umbrella noun where Lasyly is the subject.
- **Props/today + Players pages**: framing is already historical ("L10 Hit", "Grade", "Hit Rates"). Keep. Add the short analytics disclaimer (Part 4B) to the footer of these pages.
- **Scores CTA "join betting rooms with other fans"** → "join community rooms with other fans." → *Why:* "betting rooms" mischaracterizes the room feature.
- **Blog**: post titles like "Ready to bet smarter?" and "Why You Should Share Your Slip" are opinion/editorial and lower-risk, but the CTA "Ready to bet smarter?" in platform-controlled template chrome → "Ready to research smarter?" Creator/author opinion inside post *bodies* can retain natural betting vocabulary (see Part 8 rule on user/creator content).
- **`.tmp` duplicate blog files** were flagged in the repo — clean those up so stale copy can't ship.

---

## PART 4 — GLOBAL DISCLAIMERS

Keep these short and placed once each, not scattered.

### A. Site-wide footer (replace "Not a sportsbook. For entertainment and analytics purposes only.")
> Lasyly is a sports analytics and community platform. We do not accept wagers, hold betting funds, set odds, settle bets, or pay winnings, and we are not a sportsbook or gambling operator. Analytics are historical and informational only and do not predict or guarantee outcomes. Creator content reflects the creator's own views. You are responsible for following the laws that apply where you are.

### B. Analytics-page disclaimer (player/prop pages)
> These metrics are calculated from historical performance. Past results don't guarantee future outcomes. For research only — not betting or financial advice.

### C. Creator-profile disclaimer
> This creator is an independent user, not a Lasyly employee or partner. Their analysis, opinions, and picks are their own. Lasyly does not verify, endorse, or guarantee any creator's claims or results.

### D. Paid-community disclaimer (shown before any paid access, where the feature is available)
> You're paying for access to this creator's content and community — not placing a bet. No wager is made, held, or settled through Lasyly, and no betting account is created by this purchase.

### E. Marketplace / payment disclaimer (checkout)
> This payment is for digital content and community access only. Lasyly is not accepting a sports wager and does not create a betting wallet or sportsbook account. Availability of paid creator features depends on your region.

### F. Data-source / statistics disclaimer
> Some statistics originate from third-party providers and are used subject to applicable rights and terms; Lasyly calculates its own metrics from that information. Data may contain errors or delays. Sources are credited on our Data Sources page.

---

## PART 5 — TERMS OF SERVICE (rewritten)

> Drafting note: replace the current Terms. Fill bracketed items with counsel. Named India governing law + seat is a placeholder pending the lawyer's advice on where users sit and how payments flow.

**Lasyly Terms of Service** — *Last updated: [date]*

**1. Definitions.** "Lasyly", "we", "us" — the operator, [legal entity name], based in India. "Service" — the Lasyly website and app. "Analytics" — metrics Lasyly calculates from historical sports data. "Creator" — a user who publishes analysis/opinions/picks. "Creator Content" — content a Creator publishes. "User Content" — content any user posts. "Third-Party Data" — statistics, scores, logos, and news originating from third parties.

**2. Eligibility.** You must be 18+ and legally permitted to use the Service where you are. You are responsible for compliance with the laws applicable to you, including any laws governing gaming, betting, or online content in your jurisdiction.

**3. Accounts.** You are responsible for your credentials and for activity on your account. Provide accurate information. One account per person unless we permit otherwise. We may suspend or terminate accounts that violate these Terms.

**4. Sports analytics and informational content.** Analytics are historical and derived; they describe past performance and estimates only. They are **not** predictions of, or guarantees about, any future result, and are **not** betting, investment, or financial advice. You rely on them at your own discretion.

**5. Third-party data and content.** Certain statistics, scores, logos, and news are provided by third parties and used subject to applicable rights and terms. They remain the property of their respective owners. We do not claim ownership of underlying third-party facts or datasets. We identify sources on our Data Sources page and preserve required attributions.

**6. Creator-generated content.** Creator Content is the Creator's own opinion and analysis. Lasyly does not author, verify, endorse, or guarantee Creator Content or any Creator's results. Creators are independent users, not our agents or partners.

**7. Creator communities and rooms.** Creators may run public or private rooms to share content and discuss sports. Access to some rooms may require payment **for the content/community only**. Paying for access is not a wager and creates no betting account, stake, or entitlement to winnings.

**8. Payments and subscriptions.** Where paid features are available, payments are processed by our payment provider(s). Prices, currency, and availability may vary by region and are shown at the point of purchase. [Refund policy — see §[x].] Paid features may be unavailable in some regions.

**9. Creator payouts and platform fee.** Where creator monetization is available, Lasyly may retain a platform fee and remit the balance to the Creator, subject to verification, tax withholding where required, and applicable law. Creators are responsible for their own taxes. We may change fees or payout terms with reasonable prior notice.

**10. Prohibited conduct.** No spam, harassment, hate speech, illegal content, impersonation, manipulation of analytics/leaderboards, unauthorized automated access, reverse engineering, circumvention of security, or malware. No using the Service to offer, operate, facilitate, or advertise any wagering, betting, or online money game, or to conduct financial transactions for such activity.

**11. No wagering through Lasyly.** Lasyly does not accept, place, hold, match, or settle bets or wagers, does not offer or set odds, does not operate a betting exchange or sportsbook, and does not pay winnings. Nothing on the Service is an offer to do so.

**12. No guaranteed results.** We do not guarantee that any pick, prediction, projection, analytic, or Creator opinion will be accurate or profitable. Past performance does not guarantee future results.

**13. User responsibility for legal compliance.** You are solely responsible for ensuring your use — including any decisions you make using the Service — is lawful where you are.

**14. Intellectual property.** We own or license the Lasyly software, brand, logos, original content, page design, and our original methodology to the extent legally protectable. We do **not** claim ownership of raw underlying facts or third-party datasets. You may not copy, redistribute, or commercially exploit the Service or our proprietary materials without written permission.

**15. Third-party trademarks and logos.** Team, league, athlete, sportsbook, and provider names and logos are the property of their owners. Their appearance does not imply affiliation, endorsement, or license unless expressly stated.

**16. Data accuracy / disclaimers.** The Service is provided "as is" and "as available", without warranties to the extent permitted by law. We do not warrant uninterrupted access or that data, scores, or analytics are accurate, complete, or timely.

**17. Limitation of liability.** To the maximum extent permitted by applicable law, Lasyly is not liable for indirect, incidental, special, consequential, or punitive damages, or for losses arising from decisions you make using the Service. [Liability cap — counsel to set consistent with Indian law.]

**18. Indemnification.** You will indemnify Lasyly against claims arising from your content, your use of the Service, your breach of these Terms, or your infringement of third-party rights.

**19. Suspension / termination.** We may suspend or terminate access for violations or legal/operational reasons. On termination, [treatment of any balances/credits — counsel].

**20. Content moderation.** We may review, restrict, or remove content and enforce community rules and the Creator Policy. We are an intermediary and rely on applicable safe-harbour protections; nothing here waives them.

**21. Privacy.** Our Privacy Policy explains how we handle personal data.

**22. Governing law.** These Terms are governed by the laws of India. [Seat/exclusive jurisdiction — e.g., courts at [city] — counsel to confirm, especially for non-India users.]

**23. Dispute resolution.** [Counsel to design: negotiation → arbitration seated in [city] under the Arbitration and Conciliation Act, 1996, or courts. The current "binding arbitration, except where prohibited" clause needs a seat and a consumer-law carve-out.]

**24. Changes to terms.** We may update these Terms and will post the new date; material changes get reasonable notice.

**25. Contact.** [Support email / grievance officer details — see Privacy Part 7.]

---

## PART 6 — CREATOR TERMS (Creator Policy)

**Lasyly Creator Policy** — *Last updated: [date]*

**1. Who this covers.** Anyone who publishes analysis, opinions, predictions, or picks, or runs a room, on Lasyly.

**2. You are independent.** You are not a Lasyly employee, agent, or partner. Your content is your own. Don't imply Lasyly endorses you.

**3. Your content, your responsibility.** You own your Creator Content and grant Lasyly a licence to host and display it to operate the Service. You're responsible for its legality and accuracy.

**4. Honest claims only. Prohibited claims include:** "guaranteed win", "100% guaranteed", "risk-free", "can't lose", "sure bet", "lock", "free money", "easy money", "inside information", or any claim of guaranteed profit or certainty of outcome. Do not fabricate or inflate records, wins, or track-record stats.

**5. No impersonation / false affiliation.** Do not claim affiliation with, or endorsement by, any sportsbook, league, team, athlete, data provider, or Lasyly.

**6. No prohibited financial or wagering activity.** Do not use Lasyly to accept, hold, pool, match, or settle wagers, to run a betting book or online money game, or to facilitate payments for any of that. Paid access you offer is for your content/community only.

**7. Disclosure.** Present your picks as your opinion/analysis, not fact or a guaranteed outcome.

**8. Payments and payouts.** Where monetization is available: pricing, platform fee, verification, payout method, minimums, and timing are as shown in-product and may change with notice. You're responsible for your taxes. [Refunds — see policy.]

**9. Conduct.** No spam, harassment, manipulation, or unauthorized use of third-party trademarks/content.

**10. Moderation and enforcement.** We may review, restrict, demonetize, suspend, or terminate creators and remove content for violations, fraud, or legal/operational reasons.

**11. Regional availability.** Creator monetization may be unavailable or restricted in some regions, including where local law prohibits it.

---

## PART 7 — PRIVACY POLICY (rewritten, based on actual data)

> Aligns to India's **DPDP Act, 2023 + DPDP Rules, 2025** (Rules notified 13 Nov 2025; phased commencement, core obligations expected fully enforceable ~13 May 2027). Do **not** claim "fully DPDP compliant"; describe practices and appoint the required contacts. Counsel to confirm notice/consent and Data Protection Board specifics.

**Lasyly Privacy Policy** — *Last updated: [date]*

**1. What we collect.**
- **Account:** email, username, avatar, account/role preference.
- **Auth:** via Supabase / Google OAuth (we don't store your Google password).
- **Usage & device:** IP address, device/browser info, pages/actions, cookies and similar technologies.
- **Content:** posts, chat messages, rooms, betslips/pick logs you create.
- **Payments (where enabled):** processed by our payment provider(s); we store transaction records, not full card numbers.
- **Support & safety:** support requests, moderation records, security logs.

**2. Why we use it (and legal basis).** To provide and secure the Service, operate accounts and rooms, process any payments/payouts, prevent abuse and fraud, meet legal obligations, and send account/security emails. We process on the bases permitted under the DPDP Act (consent and legitimate/lawful uses as defined by the Act and Rules). We don't send marketing email without consent.

**3. Sharing.** With processors (e.g., Supabase, Vercel, our payment provider) under contract; when legally required; and to enforce our Terms. Public content (e.g., public betslips, public profiles) is visible to others. We don't sell personal data.

**4. Retention.** Chat messages: auto-deleted after 24 hours. Payment records: retained as required by law [confirm period with counsel]. Other data: as long as your account is active or as needed for legal/operational purposes.

**5. International transfers.** Some providers process data outside India. Where required, transfers are subject to applicable safeguards and any restrictions notified under the DPDP framework.

**6. Your rights.** Subject to applicable law, you may request access, correction, updating, erasure of your data, withdraw consent, and nominate a person to exercise rights on your behalf (as provided under the DPDP Act). To exercise these, contact our Grievance Officer (§7).

**7. Grievance / contact.** Grievance Officer: [name], [email]. We respond within the timelines required by applicable law.

**8. Children.** The Service is for users 18+. We don't knowingly collect data from children; where the DPDP framework's rules on minors apply, we follow them.

**9. Security.** Encryption in transit (TLS) and at rest for sensitive fields, access controls (RLS), and standard hardening (CSP/HSTS). No system is perfectly secure.

**10. Cookies.** Essential cookies for login/functionality and limited analytics; manage via your browser and our consent controls.

**11. Changes.** We'll post updates with a new date and give notice of material changes.

---

## PART 8 — UI COPY

Rule applied throughout: **Lasyly-controlled chrome uses accurate, non-wagering language; genuine creator/user-authored content may keep natural betting vocabulary because it's their speech, not ours.**

**Navigation / menus**
- Sidebar "Tipsters" (→/marketplace) → **"Creators"**.
- Marketing nav "Picks" (→/tipsters) → **"Creators"**.
- "Wallet (Soon)" → keep "Soon" until built; label region-aware when live.
- Bottom nav labels: keep Explore/Scores/News/Props/Rooms/Dashboard; rename "Props" is fine (analytics), keep.

**Buttons / CTAs**
- "Start selling picks" / "Sell your picks" → **"Start publishing"** / **"Share your analysis."**
- "Become a tipster" / "Start as a tipster" → **"Become a creator."**
- "Browse tipsters" → **"Browse creators."**
- "Share Pick" (betslip modal submit) → keep **"Share Pick"** (accurate: it's the user sharing their own pick).
- "Premium Pick / Lock selections behind a paywall" → **"Paid pick — members pay to view"** (drop "Lock"; keep it clearly *view access to content*). Show disclaimer D near the price field.

**Betslip / analytics modal (`CreateBetslipModal`)**
- "Sportsbook" dropdown listing Bet365/1xBet/DraftKings/etc. → **rename field to "Source (optional)"** and **remove the pre-populated operator list**; let users free-type or leave blank. → *Why:* stop the platform from advertising named betting operators from India.
- "Total Odds" → keep as a numeric field but label **"Odds (as quoted)"**; it's user-entered data about their own external slip.
- "Stake (optional)" → keep; it's the user's own record in their tracker.

**Analytics pages**
- "LASYLY PRO" header — fine.
- Keep "Hit rate", "Matchup grade", "Confidence" but ensure "Confidence" tooltip says it's a **weighted score of historical factors**, not a probability of winning (it already does — keep). Add analytics disclaimer B.

**Onboarding**
- Role "I'm a Seller — Share premium picks… earn from your expertise." → **"I'm a Creator — Share your analysis and picks; earn where creator monetization is available."**

**Notifications / toasts**
- "Logged: {player} over {line} {stat}" — fine (user's own log).
- Any future payout/purchase notifications must use disclaimer-E language ("access to content", not "bet"/"payout of winnings").

**Payment pages (when built)**
- Header: **"Add funds for creator content"** (not "Deposit"/"Betting wallet").
- Confirmation: show disclaimer E.

---

## PART 9 — LEGAL RISK MATRIX

| Area | Risk | Why | Recommended action | Lawyer? |
|---|---|---|---|---|
| Paid picks feature legality (India users) | **YELLOW (unsettled)** | PROG Act 2025 bans offering/advertising/facilitating payment for "online money games". Whether paid *content access* (no stake placed/held/settled through Lasyly) is such a game is genuinely uncertain — arguable either way | Hold the paid feature for counsel before enabling in India; design it as paid content access, not a wager; region-gate; do not treat as settled either direction | **Yes** |
| Advertising betting/earnings ("sell picks, keep 85%, instant payouts, $850/mo") | **RED** | Advertising/promotion of money-gaming and misleading earnings claims | Remove earnings projections & "sell picks" headlines; reword to creator/content | **Yes** |
| Sportsbook dropdown (Bet365, 1xBet…) in UI | **RED** | Platform-level promotion of named betting operators from India | Make source field free-text; remove operator list | **Yes** |
| Sports Reference / basketball-ref data | **YELLOW→RED** | SRL claims ownership/licence; third-party licences preclude bulk redistribution; "no explicit permission to reuse en masse" | Present derived analytics, not raw tables; keep attribution; review scraping vs. their terms | **Yes** |
| PFR/NFL data | **YELLOW** | Same SRL family; league marks | Same as above; no "official" claims | **Yes** |
| ESPN data/logos/news | **YELLOW** | Logos are trademarks; content is owned; "public API" ≠ redistribution licence | Attribute; link out for news; avoid implying partnership | Yes |
| "All analytics are our IP" (Terms 7.2) | **YELLOW** | Can't own raw facts | Rewrote in Part 5 §14 | Yes |
| "Fair use" clause (Terms 7.3) | **YELLOW** | US doctrine; not a blanket India justification | Removed; replaced with rights/terms language | Yes |
| Database/compilation rights | **YELLOW** | Copyright can subsist in selection/arrangement even where facts aren't protected | Don't copy others' compilation structure; document own methodology | Yes |
| Scraping / bot access | **YELLOW** | Provider ToS often prohibit; contract/CFAA-type exposure for US sites | Review each source's ToS; rate-limit; prefer licensed feeds | **Yes** |
| Trademarks (teams/leagues/books) | **YELLOW** | Marks shown in UI | Non-affiliation disclaimer (in place); nominative use only | Yes |
| Misleading advertising / consumer protection | **YELLOW→RED** | "Win", guaranteed earnings, unbuilt features advertised as live | Reframe (Part 3); don't advertise unbuilt features | Yes |
| Online gaming regulation generally | **YELLOW→RED (fact-dependent)** | Central PROG Act + residual state laws; exposure depends on whether/how paid features and betting-adjacent promotion are implemented | Counsel-led positioning; keep free analytics/rooms clearly separate from any paid-wagering-adjacent flow | **Yes** |
| Age restriction | **GREEN→YELLOW** | 18+ stated; enforcement is the question | Keep 18+, add age gate where paid features live | Yes |
| Privacy (DPDP) | **YELLOW** | Rules notified Nov 2025, phased; obligations approaching | Rewrote Privacy; appoint Grievance Officer; don't claim "compliant" | Yes |
| Payments (Stripe USD from India) | **YELLOW→RED** | Currency, GST, TDS on creator payouts, FEMA if cross-border | Payment/tax counsel before enabling money flow | **Yes** |
| Refunds | **YELLOW** | "Non-refundable once revealed" + consumer law | Counsel to align with Indian consumer protection | Yes |
| Creator liability / defamation / fraud | **YELLOW** | Creators may make false claims | Creator Policy prohibitions (Part 6) + moderation | Yes |
| Platform/intermediary safe harbour | **YELLOW** | Depends on IT Act intermediary rules compliance | Grievance officer, takedown process, diligence | **Yes** |
| Cross-border users | **YELLOW** | Foreign gambling/ad/consumer/data laws | Region-gating + counsel | Yes |
| US source-provider contracts | **YELLOW** | US-owned providers' ToS bind you regardless of India base | Review + prefer licensed data | **Yes** |

---

## PART 10 — LAWYER CHECKLIST (questions to hand to Indian counsel)

**Online gaming / betting regulation (PROG Act 2025 + Rules 2026 + residual state law)**
1. Does a *paid tipster pick* (user pays a creator for content, no stake placed through us) fall within "online money game" or the advertising/facilitation prohibitions under the PROG Act? Does the answer change if payouts flow through our wallet?
2. Can we advertise/operate free sports analytics and *free* creator rooms in India without registration or restriction?
3. If paid creator features are launched, what structure (if any) is lawful in India, and must we region-gate India entirely?
4. Does listing named sportsbooks in-UI or letting creators post odds/slips create advertising/abetment exposure for us as the platform?

**Copyright / IP / data licensing**
5. Our exposure for scraping and computing analytics from Sports Reference / PFR / fbref given their ToS (bulk-reuse restrictions) — do we need licences?
6. Database/compilation rights risk under the Copyright Act for our derived metrics and tables.
7. Can we safely claim ownership of our *methodology* and derived outputs, and how should we word IP clauses?
8. Trademark use of team/league/sportsbook names and logos — nominative use limits.

**Privacy / data protection (DPDP)**
9. Our DPDP obligations now vs. on full commencement; consent-notice wording; Grievance Officer/Consent Manager needs; children's-data handling.
10. Cross-border transfer restrictions for our processors (Supabase/Vercel/payment provider).

**Payments / tax**
11. Lawful payment design for creator monetization from an India base: currency, GST, TDS on payouts, FEMA if cross-border; role of the payment processor.
12. Refund policy compliance with Indian consumer protection.

**Platform / intermediary / advertising**
13. Intermediary safe-harbour conditions (IT Act/Rules) we must meet for creator/user content.
14. Misleading-advertising exposure for performance/earnings claims and for advertising features not yet live.

---

## PART 11 — SOURCES

- Promotion and Regulation of Online Gaming Act, 2025 — MeitY explainer/FAQ: https://www.meity.gov.in/static/uploads/2025/10/85fbcf755d765740d9552694bf34fa02.pdf
- PROG Rules, 2025 (notified under s.19) — MeitY: http://www.meity.gov.in/static/uploads/2025/10/18bae7782749f36ebb062fdb0b2607ea.pdf
- Act text (Lok Sabha, as passed): https://www.livelaw.in/pdf_upload/the-promotion-and-regulation-of-online-gaming-bill-2025-616405.pdf
- PRS Legislative Bill Summary (definition of "online money game"): https://prsindia.org/files/bills_acts/bills_parliament/2025/Bill_Summary-Online_Gaming_Bill_2025.pdf
- In-force date 1 May 2026; bans money games + ads + payment facilitation, skill/chance immaterial — Bar & Bench: https://www.barandbench.com/news/litigation/cci-closes-winzo-antitrust-case-against-google-after-online-gaming-ban
- Ban on offering/advertising/facilitating payments — Drishti IAS: https://www.drishtiias.com/daily-updates/daily-news-analysis/promotion-and-regulation-of-online-gaming-act,-2025
- Penalties (up to 3 yrs / ₹1 crore) — Deloitte tax alert: https://www.deloitte.com/content/dam/assets-zone1/in/en/docs/services/tax/2025/tax-alerts/in-regulatory-tax-the-promotion-and-regulation-of-online-gaming-bill-2025.pdf
- "Irrespective of skill, chance, or both" analysis — Lexology: https://www.lexology.com/library/detail.aspx?g=1d532495-2600-49ec-b44d-cece3e4a42b0
- DPDP Rules 2025 notified 13 Nov 2025; phased, full enforce ~13 May 2027 — Mondaq: https://www.mondaq.com/india/privacy-protection/1840296/dpdp-act-and-ai-what-it-means-for-global-tech-companies
- DPDP operationalisation overview — ET Government: https://www.government.economictimes.indiatimes.com/news/secure-india/revolutionizing-digital-privacy-indias-dpdp-act-and-2025-rules-explained/125424652
- Sports Reference — Sharing/citation policy: https://www.sports-reference.com/sharing.html
- Sports Reference — Terms of Use (ownership/licence of Content): https://www.sports-reference.com/termsofuse.html
- Sports Reference — bulk-reuse restrictions ("no explicit permission to reuse en masse"): https://web.archive.org/web/20161119002158/http:/www.sports-reference.com/data_use.html
- Sports Reference — bot/scraping policy: https://www.sports-reference.com/bot-traffic.html

*Content from sources was rephrased and summarized for compliance with licensing restrictions.*
