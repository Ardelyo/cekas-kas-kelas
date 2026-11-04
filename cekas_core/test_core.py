"""
CEKAS Python Test Suite (100% Pure Python Edition)
Verifies formatters, RBAC, idempotency, transaction processing, whitelist registration,
weekly dues tracking, append-only corrections, Excel (.xlsx) generator, and Chart (.png) generator.
"""

import unittest
from cekas_app.formatters import (
    format_rupiah,
    parse_nominal,
    normalize_category,
    parse_transaction_args,
)
from cekas_app.database import CekasDB
from cekas_app.export_excel import generate_excel_report
from cekas_app.generate_chart import generate_financial_chart


class TestCekasPurePython(unittest.TestCase):
    def test_format_rupiah(self):
        self.assertEqual(format_rupiah(0), "Rp 0")
        self.assertEqual(format_rupiah(5000), "Rp 5.000")
        self.assertEqual(format_rupiah(1250000), "Rp 1.250.000")
        self.assertEqual(format_rupiah(-25000), "-Rp 25.000")

    def test_parse_nominal(self):
        self.assertEqual(parse_nominal("10000"), 10000)
        self.assertEqual(parse_nominal("10.000"), 10000)
        self.assertEqual(parse_nominal("Rp 10.000"), 10000)
        self.assertEqual(parse_nominal("10k"), 10000)
        self.assertEqual(parse_nominal("15rb"), 15000)
        self.assertEqual(parse_nominal("1.5jt"), 1500000)
        self.assertIsNone(parse_nominal("0"))
        self.assertIsNone(parse_nominal("-5000"))
        self.assertIsNone(parse_nominal("abc"))

    def test_parse_transaction_args(self):
        res1 = parse_transaction_args("10k sosial Santunan duka")
        self.assertEqual(res1["amount"], 10000)
        self.assertEqual(res1["category"], "sosial")
        self.assertEqual(res1["description"], "Santunan duka")

        res2 = parse_transaction_args("15.000 Iuran mingguan")
        self.assertEqual(res2["amount"], 15000)
        self.assertEqual(res2["category"], "operasional")
        self.assertEqual(res2["description"], "Iuran mingguan")

    def test_database_rbac_and_idempotency(self):
        db = CekasDB(":memory:")
        info = db.init_class("XI-F2")
        self.assertEqual(info["saldo"], 0)

        # Idempotency guard
        self.assertTrue(db.check_and_mark_message("chat1:101"))
        self.assertFalse(db.check_and_mark_message("chat1:101"))

        # Seed whitelist
        db.seed_whitelist(
            "XI-F2",
            [
                {"nis": "23241001", "nama_resmi": "Ardellio Satria Anindito", "role": "siswa"},
                {"nis": "23241015", "nama_resmi": "Tarina", "role": "bendahara"},
            ],
        )

        # Registration
        reg1 = db.register_member("XI-F2", 111, "23241001", "ardellio")
        self.assertTrue(reg1["success"])
        self.assertEqual(reg1["role"], "siswa")
        self.assertFalse(db.is_bendahara(111))

        # NIS bendahara saja TIDAK cukup (mudah ditebak); hak bendahara hanya lewat PIN
        reg2 = db.register_member("XI-F2", 222, "23241015", "tarina")
        self.assertTrue(reg2["success"])
        self.assertFalse(db.is_bendahara(222))

        # Claim bendahara via PIN
        claim_bad = db.claim_bendahara("XI-F2", 333, "000000")
        self.assertFalse(claim_bad["success"])
        db.set_pin("XI-F2", "482915")
        claim_ok = db.claim_bendahara("XI-F2", 333, "482915", "Wakil Bendahara")
        self.assertTrue(claim_ok["success"])
        self.assertTrue(db.is_bendahara(333))

    def test_transactions_dues_and_reversal(self):
        db = CekasDB(":memory:")
        db.init_class("XI-F2")
        db.seed_initial_students("XI-F2")

        # Record income & expense
        t1 = db.record_transaction("XI-F2", "in", 50000, "operasional", "Iuran kas", "Tarina", 222)
        self.assertEqual(t1["saldo_total"], 50000)

        t2 = db.record_transaction("XI-F2", "in", 30000, "sosial", "Donasi duka", "Tarina", 222)
        self.assertEqual(t2["saldo_total"], 80000)

        t3 = db.record_transaction("XI-F2", "out", 20000, "operasional", "Beli spidol", "Tarina", 222)
        self.assertEqual(t3["saldo_total"], 60000)

        # Append-only reversal
        rev = db.reverse_transaction("XI-F2", t3["tx_id"], "Salah catat spidol", "Tarina", 222)
        self.assertTrue(db.verify_ledger("XI-F2")["ok"])
        self.assertEqual(rev["saldo_total"], 80000)
        self.assertEqual(rev["alokasi"]["operasional"], 50000)

        # Weekly dues payment
        dues_res = db.mark_dues_paid("XI-F2", "23241001", 1, "Tarina", 222, auto_tx=True)
        self.assertEqual(dues_res["nominal"], 10000)
        self.assertEqual(dues_res["saldo_total"], 90000)

        # Duplicate weekly dues payment should raise ValueError
        with self.assertRaises(ValueError):
            db.mark_dues_paid("XI-F2", "23241001", 1, "Tarina", 222, auto_tx=True)

        hist = db.get_student_dues_history("XI-F2", "23241001", max_weeks=4)
        self.assertTrue(hist[0]["is_paid"])
        self.assertFalse(hist[1]["is_paid"])

    def test_excel_and_chart_generators(self):
        db = CekasDB(":memory:")
        db.init_class("XI-F2")
        db.record_transaction("XI-F2", "in", 100000, "operasional", "Saldo awal", "Tarina", 222)

        excel_stream = generate_excel_report(db, "XI-F2")
        excel_bytes = excel_stream.read()
        self.assertGreater(len(excel_bytes), 1000)
        self.assertEqual(excel_bytes[:2], b"PK")  # ZIP/XLSX magic header

        chart_stream = generate_financial_chart(db, "XI-F2")
        chart_bytes = chart_stream.read()
        self.assertGreater(len(chart_bytes), 1000)
        self.assertEqual(chart_bytes[:8], b"\x89PNG\r\n\x1a\n")  # PNG magic header


if __name__ == "__main__":
    unittest.main()
