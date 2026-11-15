from datetime import date
from io import BytesIO
from unittest import TestCase
from zipfile import ZipFile

from market import archive_link, parse_archive, summarize_archives
from server import classify, discover_documents, normalize_filings, rank_passages, ticker_from

ARCHIVES = "https://archives.nseindia.com"


class PipelineTests(TestCase):
    def test_bhavcopy_parsing_and_volume_exclude_latest_session(self):
        buffer = BytesIO()
        with ZipFile(buffer, "w") as archive:
            archive.writestr("test.csv",
                              "TradDt,TckrSymb,SctySrs,ClsPric,PrvsClsgPric,TtlTradgVol\n"
                              "2026-04-23,INFY,EQ,98,100,2000\n"
                              "2026-04-23,INFY,BE,98,100,200\n"
                              "2026-04-23,UNOWNED,EQ,98,100,200\n")
        latest = parse_archive(buffer.getvalue(), ("INFY",))
        historical = {"INFY": {"volume": 1000}}
        bar, = summarize_archives([latest] + [historical] * 20, ("INFY",))
        self.assertEqual(bar, {"ticker": "INFY", "date": "2026-04-23", "close": 98,
                               "previous": 100, "volume": 2000, "mean": 1000})
        self.assertIsNone(summarize_archives([latest, historical], ("INFY",))[0]["mean"])
        self.assertIn("20260423", archive_link(date(2026, 4, 23)))

    def test_filing_relevance_and_dedup(self):
        filing = {"symbol": "INFY", "an_dt": "23-Apr-2026 15:20:00", "seq_id": 42,
                  "desc": "Quarterly results", "attchmntFile": ARCHIVES + "/results.pdf"}
        event, = normalize_filings([filing, filing, {**filing, "symbol": "UNOWNED"}])
        self.assertEqual(event["kind"], "Results")
        self.assertEqual(event["date"], "2026-04-23T15:20:00+05:30")
        self.assertEqual(classify("Closure of trading window", "ahead of financial results")[0], "Routine")

    def test_discovery_for_unseeded_company_uses_latest_safe_sources(self):
        def disclosure(label, path, stamp):
            return {"symbol": "MARUTI", "an_dt": stamp, "desc": label, "attchmntFile": path}

        report = ARCHIVES + "/annual.pdf"
        call = ARCHIVES + "/transcript.pdf"
        documents = discover_documents([
            disclosure("Integrated Annual Report", report, "10-Jul-2026"),
            disclosure("Earnings call transcript", call, "10-Oct-2026"),
            disclosure("Earnings call transcript", ARCHIVES + "/old.pdf", "10-Apr-2026"),
            disclosure("Annual Report", "https://example.net/bad.pdf", "20-Oct-2026"),
        ], "MARUTI")
        self.assertEqual([doc["url"] for doc in documents], [report, call])
        self.assertEqual(ticker_from("  m&m.ns "), "M&M")
        with self.assertRaises(ValueError):
            ticker_from("../INFY")

    def test_passages_have_numeric_evidence_and_page_numbers(self):
        ranked = rank_passages([
            (1, "The outlook is uncertain and guidance varies across programmes and geographies."),
            (8, "We set revenue growth guidance at 4–6% for the year based on our contracted pipeline."),
        ])
        self.assertEqual(len(ranked), 1)
        self.assertEqual(ranked[0]["page"], 8)
        self.assertIn("4–6%", ranked[0]["text"])
