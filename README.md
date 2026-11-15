# FINN · Investor desk

FINN turns a portfolio disclosure into a decision about what to investigate and who might help. It’s a mobile-first prototype for the ENAM Founding AI Engineer build challenge.

## Run it

Python 3.10 or newer. The historical replay has zero dependencies and needs no API keys.

```sh
python3 server.py
```

Open **http://127.0.0.1:8000**. For a self-contained file, run `python3 build_replay.py FINN.html` and open the file in a browser. The standalone file and GitHub Pages support the same historical workflows.

For live-source research and local PDF parsing, install the PDF dependency in a virtual environment:

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python server.py
```

For a phone on the same trusted Wi-Fi network, run `python3 server.py --host 0.0.0.0` and visit port 8000 on the computer’s LAN IP. The default listener is loopback. The development server has no user accounts and is intended for local testing.

## Try three workflows

1. **Brief.** Open the Infosys result. Read the four consolidated metrics, the QoQ and YoY comparisons, and the filing. Switch from **24h** to **7 days** and open the HCLTech board appointment. The reason for the possible contact route is visible. The **30 days** window adds an Infosys acquisitions disclosure. Routine releases are collapsed.
2. **Research.** Open **Wipro**. Check where the actual IT-services revenue sat in its guided-currency range across four quarters, read both primary sources, and see the relevant synthetic contact. Infosys, HCLTech and TCS also have sourced briefs. Type an unseeded ticker such as **MARUTI** on the Python server for document discovery. If coverage is missing, add the issuer’s PDFs in the same view for page-numbered evidence. The [Maruti issuer report archive](https://www.marutisuzuki.com/corporate/investors/company-reports) has published reports and transcripts.
3. **Network.** Search **rural lending**, **IT services**, or **Kimsuka Narsimhan**. The last query shows an employer-based lead whose connection is unverified. In **Brief → Market tripwires**, changing the thresholds to **4%** and **3×** clears the replay’s two alerts. The defaults **2%** and **1.9×** demonstrate a price trigger and a volume trigger separately.

The digest replays selected historical filings up to April 23, 2026 in India time. The four FY26 research briefs also use annual reports published after the event window. They are retrospective research examples.

## Data and architecture

```text
NSE closing archives ── watchlist join ── daily move / 20-session volume ──┐
NSE disclosures ── timestamp, ticker and filing ID ── ranked digest ───────┤
Issuer annual reports and calls ── PDF extraction and page ranking ───────┼── FINN
Synthetic roles, topics and public bio ── ticker and employer matches ────┘
```

| Source | Prototype behavior |
| --- | --- |
| NSE cash-market bhavcopies | Read the latest published `EQ` session, match the 17 watchlist tickers, and compare volume against the previous 20 complete sessions. The replay ships a derived snapshot from March 20 to April 23, 2026. Each alert links to its source archive. Missing history disables that ticker’s volume test. |
| Corporate announcements | The live server requests up to 30 days of NSE disclosure metadata and deduplicates on exchange ID or attachment. Topic rules prioritize results, leadership and other potentially material events. The replay uses a small selection of sourced disclosures. |
| Company fundamentals | Four retrospective briefs are hand-checked against company annual reports and earnings transcripts. Generic lookup searches the past 370 days of NSE filings by ticker. For the most recent matching annual report and transcript it ranks numeric passages and returns the original URL and page number. If discovery or parsing is incomplete, a user can supply primary PDFs directly. Market inputs never supply research claims. |
| Network | Six synthetic profiles are seeded with employers, roles, tenure and topics. Exact ticker matches lead the company workflows. An explicit employer-based overlap links a public appointment bio to a synthetic contact. Shared employment is evidence for a lead, with its own confidence label. |

The browser applies ranking, date windows, rule evaluation, and network matches. The Python server handles fetches, response normalization and PDF text extraction. Source calls use bounded timeouts, a limited fetch pool and in-process TTL caches. The server stores no uploaded files. It accepts primary exchange PDF URLs from the approved NSE archive hosts, checks their size and samples at most 40 report pages or 24 transcript pages. Scanned PDFs and dense tables can require manual review. Words in source titles or passages are treated as source data.

**Models and cost.** OpenAI Codex was used to build the prototype. Runtime filtering, ranking and calculations are deterministic. There are no API model calls or autonomous agents. This keeps evidence inspectable and the static demo free to run. For broader synthesis, I would evaluate a small extraction model for typed fields, verify periods and units against cited text, and use a stronger model for questions that require reconciling contradictory evidence.

**Privacy.** The shipped contacts are fictional. The named director’s career information comes from an issuer-published biography. Only numeric alert preferences persist in the browser. The backend has no contact ingestion, outbound messaging or persistent PDF storage. In production, I would import investor-supplied or consented professional records, scope all contact and graph rows to the authenticated tenant and owner, encrypt stored data, and audit and test cross-tenant access. Store role, employer, date range and provenance, with separate access checks for private notes. Allow revocation and deletion, review stale profile data after 12 months and expire temporary document-processing artifacts after 24 hours. Confirm ambiguous identities and get explicit approval before any introduction is sent.

**Cloud.** GitHub Pages can serve the synthetic-data replay. In production, move public-source refresh to scheduled jobs and an authenticated API, with private contact storage isolated from public data and model context. Use an exchange-approved feed with usage rights and a scheduler before offering timely notifications.

## Coverage and verification

Live closing prices and volume were verified against NSE archives for all 17 tickers. The live NSE announcement endpoint was unreachable in the test environment. The brief shows this as partial coverage, and primary-PDF research is available through the local server. The prototype evaluates rules on load, refresh or settings changes. Background notifications, OCR, exhaustive filings coverage and contact import are outside this prototype.

The historical price snapshot is generated with `python3 build_market.py /path/to/archives 2026-04-23`. Use the exchange’s [daily market reports](https://www.nseindia.com/all-reports) to retrieve the ZIP files for the completed sessions. Tests:

```sh
python3 -m unittest discover -s tests -p 'test_*.py'
node --test tests/engine.test.cjs
```

## Publish the replay

Push the repository to GitHub. In the repository, set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**, then run **Actions → Publish FINN replay → Run workflow**. The resulting Pages URL serves the static historical replay. Use the repository’s Python server for live data and local PDF ingestion.
