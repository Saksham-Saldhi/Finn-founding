"""Bundle the static site as one HTML file for offline review."""
from pathlib import Path
import sys

site = Path(__file__).resolve().parent / "site"
page = (site / "index.html").read_text()
page = page.replace('<link rel="stylesheet" href="style.css">', "<style>\n" + (site / "style.css").read_text() + "</style>")
for name in ("market-data", "data", "engine", "app"):
    script = (site / f"{name}.js").read_text()
    assert "</script" not in script.lower()
    page = page.replace(f'<script defer src="{name}.js"></script>', "")
    page = page.replace("</body>", "<script>\n" + script + "</script>\n</body>")
output = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("FINN.html")
output.write_text(page)
