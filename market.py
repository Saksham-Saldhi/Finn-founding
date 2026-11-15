"""Read NSE cash-market bhavcopy archives and calculate per-ticker baselines."""
import csv
from datetime import date
from io import BytesIO, TextIOWrapper
from statistics import mean
from zipfile import ZipFile

ARCHIVE = "https://archives.nseindia.com/content/cm/BhavCopy_NSE_CM_0_0_0_{stamp}_F_0000.csv.zip"


def archive_link(day):
    return ARCHIVE.format(stamp=day.strftime("%Y%m%d"))


def parse_archive(content, symbols):
    with ZipFile(BytesIO(content)) as archive:
        files = [entry for entry in archive.infolist() if entry.filename.lower().endswith(".csv")]
        if len(files) != 1 or files[0].file_size > 6_000_000:
            raise ValueError("Unexpected NSE archive contents")
        with archive.open(files[0]) as raw, TextIOWrapper(raw, encoding="utf-8-sig") as csv_file:
            rows = {}
            for row in csv.DictReader(csv_file):
                symbol = row["TckrSymb"]
                if row["SctySrs"] != "EQ" or symbol not in symbols:
                    continue
                rows[symbol] = {
                    "ticker": symbol, "date": date.fromisoformat(row["TradDt"]).isoformat(),
                    "close": float(row["ClsPric"]), "previous": float(row["PrvsClsgPric"]),
                    "volume": int(row["TtlTradgVol"]),
                }
            return rows


def summarize_archives(sessions, symbols):
    """Build bars from newest-first exchange sessions. Missing volume reduces coverage."""
    if not sessions:
        return []
    latest = sessions[0]
    bars = []
    for symbol in symbols:
        if symbol not in latest:
            continue
        row = latest[symbol]
        history = [session[symbol]["volume"] for session in sessions[1:21] if symbol in session]
        bars.append({**row, "mean": round(mean(history), 2) if len(history) == 20 else None})
    return bars
