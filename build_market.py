"""Regenerate the replay's market module from locally downloaded NSE ZIP archives."""
from datetime import date
import json
from pathlib import Path
import sys

from market import parse_archive, summarize_archives
from server import PORTFOLIO, SITE

directory = Path(sys.argv[1])
end = date.fromisoformat(sys.argv[2])
archives = sorted((path for path in directory.glob("????????.zip") if path.stem <= end.strftime("%Y%m%d")), reverse=True)
if len(archives) < 21:
    raise SystemExit("At least 21 completed NSE session archives are needed.")
rows = summarize_archives([parse_archive(path.read_bytes(), PORTFOLIO) for path in archives[:21]], PORTFOLIO)
(SITE / "market-data.js").write_text("// Derived from 21 NSE CM bhavcopies ending " + end.isoformat() + ".\n"
                                    + "globalThis.FINN_MARKET = " + json.dumps(rows, separators=(",", ":")) + ";\n")
