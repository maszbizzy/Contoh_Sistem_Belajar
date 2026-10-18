import os, tempfile, unittest
from datetime import datetime, timedelta
from workflow import SistemPermohonan, Status, RalatAliran


class Jam:
    def __init__(self):
        self.t = datetime(2026, 10, 19, 9, 0)
    def __call__(self):
        return self.t


class TestAliran(unittest.TestCase):
    def setUp(self):
        self.jam = Jam()
        self.log = os.path.join(tempfile.mkdtemp(), "audit.jsonl")
        self.s = SistemPermohonan(self.log, sekarang=self.jam)

    def test_lulus_terus(self):
        r = self.s.hantar("Ali")
        self.s.ambil_semakan(r, "Siti")
        self.s.semak(r, "Siti", lengkap=True)
        self.s.luluskan(r, "Razak", lulus=True)
        self.assertEqual(self.s.permohonan[r].status, Status.DILULUSKAN)

    def test_kembali_dan_betulkan(self):
        r = self.s.hantar("Ali")
        self.s.ambil_semakan(r, "Siti")
        self.s.semak(r, "Siti", lengkap=False, senarai_kurang=["Salinan IC"])
        self.assertEqual(self.s.permohonan[r].status, Status.DIKEMBALIKAN)
        self.s.betulkan(r, "Ali")
        self.assertEqual(self.s.permohonan[r].status, Status.DIHANTAR)

    def test_had_pembetulan_tutup(self):
        r = self.s.hantar("Ali")
        for _ in range(2):
            self.s.ambil_semakan(r, "Siti")
            self.s.semak(r, "Siti", lengkap=False)
            self.s.betulkan(r, "Ali")
        self.s.ambil_semakan(r, "Siti")
        self.s.semak(r, "Siti", lengkap=False)
        self.assertEqual(self.s.permohonan[r].status, Status.DITUTUP)

    def test_tamat_tempoh(self):
        r = self.s.hantar("Ali")
        self.s.ambil_semakan(r, "Siti")
        self.s.semak(r, "Siti", lengkap=False)
        self.jam.t += timedelta(days=15)
        with self.assertRaises(RalatAliran):
            self.s.betulkan(r, "Ali")
        self.assertEqual(self.s.permohonan[r].status, Status.DITUTUP)

    def test_tolak_wajib_alasan(self):
        r = self.s.hantar("Ali")
        self.s.ambil_semakan(r, "Siti")
        self.s.semak(r, "Siti", lengkap=True)
        with self.assertRaises(RalatAliran):
            self.s.luluskan(r, "Razak", lulus=False)

    def test_tindakan_tak_sah_ditolak(self):
        r = self.s.hantar("Ali")
        with self.assertRaises(RalatAliran):
            self.s.luluskan(r, "Razak", lulus=True)

    def test_audit_log_direkod(self):
        r = self.s.hantar("Ali")
        self.s.ambil_semakan(r, "Siti")
        with open(self.log, encoding="utf-8") as f:
            baris = f.readlines()
        self.assertEqual(len(baris), 2)
        self.assertIn("AMBIL_SEMAKAN", baris[1])


if __name__ == "__main__":
    unittest.main()
