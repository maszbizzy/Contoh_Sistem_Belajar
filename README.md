# Contoh Sistem Belajar: permohonan dengan Google Sheet + Apps Script

Google Sheet jadi database, Apps Script jadi API, dan `index.html` dipaparkan melalui GitHub Pages.

## 1. Sediakan Google Sheet dan Apps Script
1. Buat Google Sheet baru.
2. Pergi ke **Extensions > Apps Script**, padam kod asal, dan tampal kandungan `apps-script/Code.gs`.
3. Dalam editor, pilih fungsi `setup` dan tekan **Run**. Benarkan akses bila diminta. Ini cipta sheet `Permohonan` dan `Audit` beserta header.
4. Pergi ke **Project Settings > Script Properties**, tambah property:
   - Name: `TOKEN_PEGAWAI`
   - Value: rentetan rahsia pilihan awak (contoh: 20 aksara rawak)

## 2. Deploy sebagai Web App
1. Klik **Deploy > New deployment > Web app**.
2. Execute as: **Me**. Who has access: **Anyone**.
3. Salin URL yang berakhir dengan `/exec`.
4. Buka `index.html`, ganti `PASTE_APPS_SCRIPT_URL_HERE` dengan URL tadi, kemudian commit.

Setiap kali tukar `Code.gs`, buat **Manage deployments > Edit > New version**. Kalau tak, URL akan terus guna versi lama.

## 3. Aktifkan GitHub Pages
1. Di repo GitHub, pergi ke **Settings > Pages**.
2. Source: **Deploy from a branch**. Branch: `main`, folder: `/ (root)`.
3. Halaman akan ada di `https://maszbizzy.github.io/contoh_sistem_belajar/`.

## Nota keselamatan
- URL `/exec` ialah URL awam. Sesiapa yang ada URL boleh panggil API, jadi jangan letak data sensitif yang tak perlu.
- Tindakan pegawai dilindungi token. Token tu akan tersimpan dalam pelayar yang guna halaman ni, jadi guna token yang lain daripada kata laluan lain.
- Pemohon semak status dengan rujukan **dan** emel. Ini lebih baik daripada rujukan sahaja, tapi belum sekukuh login.
- Had pembetulan (2 kali) dan tempoh (14 hari) ialah andaian default. Ubah di bahagian atas `Code.gs`.
- Notifikasi guna `MailApp`, dan kuota emel Google akun biasa terhad setiap hari.

## Ujian yang dah dibuat
- Sintaks JavaScript dalam `Code.gs` dan `index.html` disemak dengan Node.
- Logik aliran sama dengan `../sistem_permohonan/workflow.py` (versi Python dan ujian unit).
- **Belum** diuji terhadap Google Sheet sebenar atau Apps Script. Ujian end-to-end patut dibuat selepas deploy.
