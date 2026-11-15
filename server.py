"""Local FINN web server and best-effort primary-source adapters."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from functools import wraps
from hashlib import sha256
from http.cookiejar import CookieJar
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from io import BytesIO
import json
from pathlib import Path
import re
from threading import RLock
from time import monotonic
from urllib.error import HTTPError
from urllib.parse import parse_qs, urlencode, urlsplit
from urllib.request import HTTPCookieProcessor, HTTPRedirectHandler, Request, build_opener
from zipfile import BadZipFile

from market import archive_link, parse_archive, summarize_archives

SITE = Path(__file__).resolve().parent / "site"
IST = timezone(timedelta(hours=5, minutes=30))
NSE = "https://www.nseindia.com"
NSE_PAGE = NSE + "/companies-listing/corporate-filings-application?id=allAnnouncements"
PORTFOLIO = tuple(re.findall(r"\['([A-Z0-9]+)',", (SITE / "data.js").read_text().split("const events")[0]))
EXCHANGE_HOSTS = {"www.nseindia.com", "nsearchives.nseindia.com", "archives.nseindia.com"}
NETWORK_ERRORS = (OSError, ValueError, TypeError, KeyError, IndexError)
USER_AGENT = "Mozilla/5.0 (compatible; FINNPrototype/1.0)"
PDF_LIMIT = 40 * 1024 * 1024
WORKERS = ThreadPoolExecutor(max_workers=8)
RESEARCH_LOCK = RLock()
FEED_LOCK = RLock()


class NoRedirects(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def read(url, *, opener=None, limit=4_000_000, headers=None):
    if opener is None:
        opener = build_opener(NoRedirects())
    request = Request(url, headers={"User-Agent": USER_AGENT, **(headers or {})})
    with opener.open(request, timeout=5) as response:
        body = response.read(limit + 1)
    if len(body) > limit:
        raise ValueError("Source exceeded download limit")
    return body


def cached(ttl, capacity):
    def decorate(function):
        entries, lock = {}, RLock()

        @wraps(function)
        def wrapped(*args):
            with lock:
                record = entries.get(args)
                if record is not None and monotonic() - record[0] < ttl:
                    return record[1]
            value = function(*args)
            with lock:
                if len(entries) >= capacity and args not in entries:
                    del entries[min(entries, key=lambda key: entries[key][0])]
                entries[args] = (monotonic(), value)
            return value
        return wrapped
    return decorate


def ticker_from(value):
    symbol = value.strip().upper().removesuffix(".NS")
    if not re.fullmatch(r"[A-Z0-9][A-Z0-9&-]{0,19}", symbol, flags=re.ASCII):
        raise ValueError("Enter an NSE symbol such as MARUTI or INFY.NS.")
    return symbol


def classify(subject, headline=""):
    subject, text = subject.lower(), f"{subject} {headline}".lower()
    if re.search(r"trading window|credit rating.*reaffirm|newspaper|transcript|investor meet|conference call|earnings call|esop|stock options|compliance certificate|reconciliation", subject):
        return "Routine", 20
    rules = [
        (r"financial results|quarterly results|audited results", "Results", 90),
        (r"acquisition|\bmerger\b|demerger|divestment|joint venture", "M&A", 87),
        (r"change in management|resignation|appointment of .*director|managing director|chief financial officer|chief executive officer", "Leadership", 82),
        (r"litigation|penalty|regulatory order", "Regulatory", 76),
        (r"capacity expansion|capital expenditure|new plant", "Capex", 72),
        (r"buyback|fund raising|qualified institutional placement|rights issue|downgrade", "Capital", 67),
        (r"dividend|bonus issue|stock split", "Corporate action", 55),
    ]
    for pattern, kind, score in rules:
        if re.search(pattern, text):
            return kind, score
    if re.search(r"award of order|order win|commercial operation|material event", text):
        return "Business update", 50
    return "Routine", 15


@cached(900, 64)
def archive_session(day):
    try:
        return parse_archive(read(archive_link(day), limit=600_000), PORTFOLIO)
    except (OSError, ValueError, KeyError, BadZipFile):
        return {}


def live_market(now):
    end = now.date() - timedelta(days=now.hour < 16)
    days = [end - timedelta(days=offset) for offset in range(38)]
    weekdays = [day for day in days if day.weekday() < 5]
    sessions = []
    for offset in range(0, len(weekdays), 7):
        batch = weekdays[offset:offset + 7]
        sessions.extend(session for session in WORKERS.map(archive_session, batch) if session)
        if len(sessions) >= 21:
            break
        if offset == 0 and not sessions:
            return []
    return summarize_archives(sessions, PORTFOLIO)


@cached(300, 64)
def exchange_rows(symbol, days):
    opener = build_opener(NoRedirects(), HTTPCookieProcessor(CookieJar()))
    today = datetime.now(IST).date()
    query = {"index": "equities", "from_date": (today - timedelta(days=days)).strftime("%d-%m-%Y"),
             "to_date": today.strftime("%d-%m-%Y")}
    if symbol:
        query["symbol"] = symbol
    url = f"{NSE}/api/corporate-announcements?{urlencode(query)}"
    headers = {"Referer": NSE_PAGE, "Accept": "application/json"}
    try:
        payload = read(url, opener=opener, limit=14_000_000, headers=headers)
    except HTTPError as error:
        if error.code != 401:
            raise
        read(NSE, opener=opener)
        payload = read(url, opener=opener, limit=14_000_000, headers=headers)
    rows = json.loads(payload)
    if not isinstance(rows, list):
        raise ValueError("Unexpected filing feed response")
    return rows


def exchange_time(row):
    for key in ("sort_date", "an_dt", "exchdisstime"):
        value = row.get(key)
        if not isinstance(value, str):
            continue
        try:
            stamp = datetime.fromisoformat(value.strip())
        except ValueError:
            stamp = None
        if stamp is None:
            for pattern in ("%d-%b-%Y %H:%M:%S", "%d-%b-%Y"):
                try:
                    stamp = datetime.strptime(value.strip(), pattern)
                    break
                except ValueError:
                    continue
        if stamp is not None:
            return stamp.replace(tzinfo=IST) if stamp.tzinfo is None else stamp.astimezone(IST)
    return None


def exchange_url(value):
    if not isinstance(value, str):
        return None
    url = urlsplit(value)
    return value if url.scheme == "https" and url.netloc in EXCHANGE_HOSTS else None


def normalize_filings(rows):
    events = {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        stamp = exchange_time(row)
        symbol = row.get("symbol")
        if symbol not in PORTFOLIO or stamp is None:
            continue
        subject = str(row.get("desc") or "Exchange disclosure")
        text = " ".join(str(row.get("attchmntText") or "").split())
        kind, weight = classify(subject, text)
        link = exchange_url(row.get("attchmntFile"))
        identity = str(row.get("seq_id") or link or f"{symbol}:{stamp}:{subject}:{text}")
        event_id = sha256(identity.encode()).hexdigest()[:18]
        events[event_id] = {"id": event_id, "ticker": symbol, "date": stamp.isoformat(),
                            "kind": kind, "weight": weight, "title": subject[:160], "summary": text[:360],
                            "source": link or NSE_PAGE, "sourceName": "NSE exchange disclosure"}
    return list(events.values())


@cached(120, 1)
def build_feed():
    filings_future = WORKERS.submit(exchange_rows, "", 30)
    market = live_market(datetime.now(IST))
    errors = {}
    try:
        filings = normalize_filings(filings_future.result())
    except NETWORK_ERRORS:
        filings = []
        errors["filings"] = "NSE filings are unavailable. You can switch back to the historical replay."
    if not market:
        errors["market"] = "NSE end-of-day archives are unavailable."
    return {"asOf": datetime.now(IST).isoformat(), "market": market, "events": filings, "errors": errors}


def discover_documents(rows, symbol):
    candidates = {"Annual report": [], "Earnings call transcript": []}
    for row in rows:
        if not isinstance(row, dict) or row.get("symbol") != symbol:
            continue
        stamp, url = exchange_time(row), exchange_url(row.get("attchmntFile"))
        if not stamp or not url or not urlsplit(url).path.lower().endswith(".pdf"):
            continue
        subject = str(row.get("desc") or "")
        text = f"{subject} {row.get('attchmntText') or ''}"
        if re.search(r"\btranscript\b", text, re.I) and re.search(r"earnings|results|investor|concall|conference call", text, re.I):
            kind = "Earnings call transcript"
        elif re.search(r"annual (?:integrated )?report|integrated annual report", text, re.I) and not re.search(
            r"newspaper|web.?link|dispatch|business responsibility|sustainability report|annual secretarial|corrigendum", subject, re.I
        ):
            kind = "Annual report"
        else:
            continue
        candidates[kind].append((stamp, {"kind": kind, "url": url, "label": f"NSE filing · {stamp:%d %b %Y}"}))
    return [max(group, key=lambda pair: pair[0])[1] for group in candidates.values() if group]


RESEARCH_TERMS = {
    "guidance": 3, "constant currency": 3, "operating margin": 4, "cash flow": 3,
    "revenue growth": 4, "revenue from operations": 4, "net sales": 4, "operating profit": 4,
    "net profit": 3, "ebitda": 3, "outlook": 2, "capex": 3, "profit after tax": 3, "sales volume": 3,
}
FINANCIAL_TERM = re.compile(r"\b(?:" + "|".join(RESEARCH_TERMS) + r")\b")
NUMBER = re.compile(r"(?<![\w])\d[\d,.]*(?!\w)")
BOILERPLATE = re.compile(r"guidance note on audit|table of contents|auditor.s report|in accordance with the standards on auditing")


def rank_passages(pages):
    ranked = []
    for page, contents in pages:
        sentences = re.split(r"(?<=[.!?])\s+", " ".join(contents.split()))
        for sentence in sentences:
            if len(sentence) < 55 or not NUMBER.search(sentence):
                continue
            lower = sentence.lower()
            matches = list(FINANCIAL_TERM.finditer(lower))
            if not matches:
                continue
            match = max(matches, key=lambda item: RESEARCH_TERMS[item.group()])
            start = max(0, match.start() - 75) if len(sentence) > 350 else 0
            excerpt = sentence[start:start + 345]
            if not NUMBER.search(excerpt) or BOILERPLATE.search(excerpt.lower()):
                continue
            score = sum(RESEARCH_TERMS[term] for term in set(FINANCIAL_TERM.findall(excerpt.lower())))
            excerpt = ("…" if start else "") + excerpt + ("…" if start + 345 < len(sentence) else "")
            ranked.append((score, page, excerpt))
    seen, result = set(), []
    for _, page, text in sorted(ranked, key=lambda item: (-item[0], item[1])):
        if page not in seen:
            result.append({"page": page, "text": text})
            seen.add(page)
        if len(result) == 3:
            break
    return result


def extract_passages(response, annual=False):
    from pypdf import PdfReader
    from pypdf.errors import PyPdfError

    if not response.startswith(b"%PDF-"):
        raise ValueError("Expected a PDF")
    try:
        reader = PdfReader(BytesIO(response))
        count = len(reader.pages)
        indexes = range(min(count, 24))
        if annual and count > 24:
            indexes = sorted(set(range(16)) | {16 + (count-17)*step//23 for step in range(24)})
        pages = ((index + 1, reader.pages[index].extract_text() or "") for index in indexes)
        return rank_passages(pages)
    except PyPdfError as error:
        raise ValueError("This PDF could not be read.") from error


@cached(3600, 32)
def pdf_passages(url, annual):
    response = read(url, limit=PDF_LIMIT, headers={"Accept": "application/pdf"})
    return extract_passages(response, annual)


def attach_passages(document):
    try:
        passages = pdf_passages(document["url"], document["kind"] == "Annual report")
    except (ImportError, OSError, ValueError, RuntimeError, KeyError):
        passages = []
    return {**document, "passages": passages}


@cached(900, 24)
def research_company(symbol):
    try:
        rows = exchange_rows(symbol, 370)
    except NETWORK_ERRORS as error:
        raise RuntimeError("The NSE document index is unavailable. The four replay research briefs are still available.") from error
    documents = discover_documents(rows, symbol)
    return {"ticker": symbol, "documents": list(WORKERS.map(attach_passages, documents)),
            "note": "Newest matched exchange filing per type. Up to 40 annual-report pages and 24 transcript pages sampled."}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=SITE, **kwargs)

    def list_directory(self, path):
        self.send_error(404)
        return None

    def log_request(self, code="-", size="-"):
        pass

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Security-Policy",
                         "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
                         "connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
        super().end_headers()

    def json_response(self, payload, status=200):
        body = json.dumps(payload, allow_nan=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        url = urlsplit(self.path)
        if url.path == "/api/feed":
            with FEED_LOCK:
                payload = build_feed()
            self.json_response(payload)
        elif url.path == "/api/research":
            try:
                symbol = ticker_from(parse_qs(url.query).get("ticker", [""])[0])
            except ValueError as error:
                self.json_response({"error": str(error)}, 400)
                return
            try:
                with RESEARCH_LOCK:
                    payload = research_company(symbol)
                self.json_response(payload)
            except RuntimeError as error:
                self.json_response({"error": str(error)}, 503)
        else:
            super().do_GET()

    def do_POST(self):
        url = urlsplit(self.path)
        if url.path != "/api/research/document":
            self.send_error(404)
            return
        query = parse_qs(url.query)
        try:
            ticker_from(query.get("ticker", [""])[0])
            document_type = query.get("kind", [""])[0]
            names = {"report": "Annual report", "transcript": "Earnings call transcript"}
            if document_type not in names:
                raise ValueError("Choose an annual report or an earnings call transcript.")
            if self.headers.get_content_type() != "application/pdf":
                raise ValueError("Use a PDF file.")
            length = int(self.headers.get("Content-Length", 0))
            if not 0 < length <= PDF_LIMIT:
                raise ValueError("Use a PDF up to 40 MB.")
            self.connection.settimeout(15)
            data = self.rfile.read(length)
            with RESEARCH_LOCK:
                passages = extract_passages(data, document_type == "report")
            filename = query.get("name", ["Primary-source PDF"])[0][:120]
            self.json_response({"kind": names[document_type], "label": filename, "passages": passages})
        except ImportError:
            self.json_response({"error": "Install the Python PDF dependency listed in requirements.txt."}, 503)
        except (OSError, ValueError, RuntimeError) as error:
            self.json_response({"error": str(error)}, 400)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--host", default="127.0.0.1")
    options = parser.parse_args()
    with ThreadingHTTPServer((options.host, options.port), Handler) as server:
        print(f"FINN at http://{options.host}:{options.port}", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
