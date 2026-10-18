# Spec sistem permohonan (draf v0.1)

Ini draf berdasarkan andaian default. Semua andaian ditanda **[ANDAIAN]** dan perlu disahkan.

## Aliran
1. Pemohon hantar permohonan → sistem beri nombor rujukan `PMH-YYYYMMDD-NNNN`.
2. Pegawai penyemak ambil tugasan → semak maklumat dan dokumen.
3. Tak lengkap → status `DIKEMBALIKAN`, pemohon diberitahu senarai kekurangan.
4. Lengkap → status `MENUNGGU_LULUS`, pegawai pelulus dapat tugasan.
5. Pelulus lulus atau tolak → status dikemas kini, pemohon diberitahu.
6. Setiap tindakan direkod dalam log audit.

## Status
| Status | Maksud |
|---|---|
| DIHANTAR | Baru masuk atau dah dibetulkan |
| DISEMAK | Sedang disemak |
| DIKEMBALIKAN | Menunggu pemohon betulkan |
| MENUNGGU_LULUS | Lengkap, menunggu keputusan |
| DILULUSKAN / DITOLAK | Keputusan akhir |
| DITUTUP | Had pembetulan atau tempoh tamat |

## Peraturan
- **[ANDAIAN]** Had pembetulan: 2 kali (`MAX_PEMBETULAN`).
- **[ANDAIAN]** Tempoh pembetulan: 14 hari dari tarikh dikembalikan (`TEMPOH_PEMBETULAN`).
- **[ANDAIAN]** Pelulus cuma boleh lulus atau tolak. Tolak wajib ada alasan.
- **[ANDAIAN]** Satu peringkat semakan dan satu peringkat kelulusan.

## Audit
Log disimpan sebagai JSON Lines (satu baris setiap tindakan): masa, rujukan, tindakan, pelaku, status dari, status ke, nota. Log hanya ditambah, tak boleh diedit.
- **[ANDAIAN]** Tempoh simpanan dan siapa boleh lihat belum ditetapkan. Perlu semakan dengan pihak compliance (PDPA 2010).

## Belum dibuat
- Notifikasi sebenar (emel, SMS atau WhatsApp). Sekarang cuma stub yang tulis ke log.
- Pengagihan tugasan automatik dan delegasi bila pegawai bercuti.
- Antara muka pemohon dan pegawai. Sekarang cuma logik dan ujian.
- Storan kekal. Sekarang log fail, bukan pangkalan data.
