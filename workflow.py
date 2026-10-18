"""Aliran permohonan: hantar -> semak -> (pembetulan) -> lulus/tolak. Setiap tindakan direkod dalam log audit."""
import json
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from itertools import count

MAX_PEMBETULAN = 2          # default: 2 kali dikembalikan
TEMPOH_PEMBETULAN = timedelta(days=14)  # default: 14 hari untuk betulkan


class Status(str, Enum):
    DIHANTAR = "DIHANTAR"
    DISEMAK = "DISEMAK"
    DIKEMBALIKAN = "DIKEMBALIKAN"
    MENUNGGU_LULUS = "MENUNGGU_LULUS"
    DILULUSKAN = "DILULUSKAN"
    DITOLAK = "DITOLAK"
    DITUTUP = "DITUTUP"         # pemohon tak betulkan dalam tempoh


class RalatAliran(Exception):
    pass


@dataclass
class Permohonan:
    rujukan: str
    pemohon: str
    status: Status = Status.DIHANTAR
    bilangan_pembetulan: int = 0
    tarikh_akhir_pembetulan: datetime | None = None
    sejarah: list = field(default_factory=list)


class SistemPermohonan:
    def __init__(self, log_path, sekarang=datetime.now):
        self.log_path = log_path
        self.sekarang = sekarang
        self.permohonan = {}
        self._seq = count(1)

    # ---- log audit: append-only, satu baris JSON setiap tindakan ----
    def _log(self, rujukan, tindakan, pelaku, dari, ke, nota=""):
        rekod = {"masa": self.sekarang().isoformat(timespec="seconds"), "rujukan": rujukan,
                 "tindakan": tindakan, "pelaku": pelaku, "dari": dari, "ke": ke, "nota": nota}
        with open(self.log_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(rekod, ensure_ascii=False) + "\n")
        if rujukan in self.permohonan:
            self.permohonan[rujukan].sejarah.append(rekod)
        return rekod

    def _tukar(self, p, ke, tindakan, pelaku, nota=""):
        dari = p.status
        p.status = ke
        self._log(p.rujukan, tindakan, pelaku, dari.value, ke.value, nota)

    # ---- langkah 1: pemohon hantar ----
    def hantar(self, pemohon):
        rujukan = f"PMH-{self.sekarang():%Y%m%d}-{next(self._seq):04d}"
        p = Permohonan(rujukan=rujukan, pemohon=pemohon)
        self.permohonan[rujukan] = p
        self._log(rujukan, "HANTAR", pemohon, None, Status.DIHANTAR.value)
        return rujukan

    # ---- langkah 2: pegawai semak ----
    def ambil_semakan(self, rujukan, pegawai):
        p = self._dapat(rujukan, {Status.DIHANTAR, Status.DIKEMBALIKAN})
        if p.status == Status.DIKEMBALIKAN:
            p.status = Status.DIHANTAR  # pemohon dah betulkan, masuk semula
        self._tukar(p, Status.DISEMAK, "AMBIL_SEMAKAN", pegawai)

    def semak(self, rujukan, pegawai, lengkap, senarai_kurang=None):
        p = self._dapat(rujukan, {Status.DISEMAK})
        if lengkap:
            self._tukar(p, Status.MENUNGGU_LULUS, "SEMAK_LENGKAP", pegawai)
            return
        if p.bilangan_pembetulan >= MAX_PEMBETULAN:
            self._tukar(p, Status.DITUTUP, "TUTUP_HAD_PEMBETULAN", pegawai,
                        nota="Had pembetulan dicapai")
            return
        p.bilangan_pembetulan += 1
        p.tarikh_akhir_pembetulan = self.sekarang() + TEMPOH_PEMBETULAN
        self._tukar(p, Status.DIKEMBALIKAN, "KEMBALI_PEMOHON", pegawai,
                    nota="; ".join(senarai_kurang or []))
        self._notis(p, "Permohonan perlu dibetulkan sebelum " + p.tarikh_akhir_pembetulan.strftime("%d/%m/%Y"))

    # ---- langkah 3: pemohon betulkan semula ----
    def betulkan(self, rujukan, pemohon):
        p = self._dapat(rujukan, {Status.DIKEMBALIKAN})
        if self.sekarang() > p.tarikh_akhir_pembetulan:
            self._tukar(p, Status.DITUTUP, "TUTUP_TAMAT_TEMPOH", "sistem")
            raise RalatAliran("Tempoh pembetulan dah tamat")
        self._log(rujukan, "PEMBETULAN_DIHANTAR", pemohon, Status.DIKEMBALIKAN.value, Status.DIKEMBALIKAN.value)
        p.status = Status.DIHANTAR

    # ---- langkah 4: pelulus putuskan ----
    def luluskan(self, rujukan, pelulus, lulus, nota=""):
        p = self._dapat(rujukan, {Status.MENUNGGU_LULUS})
        if not lulus and not nota:
            raise RalatAliran("Alasan wajib bila tolak")
        ke = Status.DILULUSKAN if lulus else Status.DITOLAK
        self._tukar(p, ke, "LULUS" if lulus else "TOLAK", pelulus, nota)
        self._notis(p, f"Permohonan {rujukan} telah {ke.value.lower()}")

    def _dapat(self, rujukan, status_dibenarkan):
        p = self.permohonan.get(rujukan)
        if p is None:
            raise RalatAliran(f"Rujukan {rujukan} tak wujud")
        if p.status not in status_dibenarkan:
            raise RalatAliran(f"Tindakan tak dibenarkan untuk status {p.status.value}")
        return p

    def _notis(self, p, mesej):
        # Stub: gantikan dengan emel/SMS/WhatsApp bila saluran dah dipilih.
        self._log(p.rujukan, "NOTIS", "sistem", None, None, mesej)
