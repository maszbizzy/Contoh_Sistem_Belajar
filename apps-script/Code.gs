// Backend permohonan: Google Sheet sebagai database.
// Sheet "Permohonan" dan "Audit" dicipta oleh fungsi setup().
// Token pegawai disimpan dalam Script Properties dengan nama TOKEN_PEGAWAI.

const SH_PERMOHONAN = 'Permohonan';
const SH_AUDIT = 'Audit';
const MAX_PEMBETULAN = 2;   // [ANDAIAN]
const TEMPOH_HARI = 14;     // [ANDAIAN]
const LAJUR = ['rujukan', 'nama', 'emel', 'jenis', 'butiran', 'status',
               'bil_pembetulan', 'tarikh_akhir', 'dikemaskini', 'pegawai', 'nota'];

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SH_PERMOHONAN) || ss.insertSheet(SH_PERMOHONAN);
  if (sh.getLastRow() === 0) sh.appendRow(LAJUR);
  sh.setFrozenRows(1);
  let au = ss.getSheetByName(SH_AUDIT) || ss.insertSheet(SH_AUDIT);
  if (au.getLastRow() === 0) au.appendRow(['masa', 'rujukan', 'tindakan', 'pelaku', 'dari', 'ke', 'nota']);
  au.setFrozenRows(1);
}

function doGet(e) {
  return jawab_(e.parameter);
}

function doPost(e) {
  return jawab_(JSON.parse(e.postData.contents));
}

function jawab_(p) {
  const lock = LockService.getScriptLock();
  let out;
  try {
    lock.waitLock(15000);
    out = { ok: true, data: laksana_(p) };
  } catch (err) {
    out = { ok: false, error: err.message };
  } finally {
    lock.releaseLock();
  }
  return ContentService.createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

function laksana_(p) {
  switch (p.action) {
    case 'hantar': return hantar_(p);
    case 'semak_status': return semakStatus_(p);
    case 'senarai': sahkanPegawai_(p); return baca_();
    case 'ambil':
      sahkanPegawai_(p);
      return tukar_(p.rujukan, ['DIHANTAR'], 'DISEMAK', 'AMBIL_SEMAKAN', p.pegawai, '', {});
    case 'semak': return semak_(p);
    case 'betulkan': return betulkan_(p);
    case 'luluskan': return luluskan_(p);
    default: throw new Error('Tindakan tak dikenali');
  }
}

function hantar_(p) {
  const nama = String(p.nama || '').trim();
  const emel = String(p.emel || '').trim();
  const butiran = String(p.butiran || '').trim();
  if (!nama || !emel.includes('@') || !butiran) throw new Error('Nama, emel dan butiran wajib diisi');

  const tarikh = Utilities.formatDate(new Date(), 'Asia/Kuala_Lumpur', 'yyyyMMdd');
  const bil = baca_().length + 1;
  const rujukan = 'PMH-' + tarikh + '-' + String(bil).padStart(4, '0');

  const sh = sheet_(SH_PERMOHONAN);
  const data = { rujukan, nama, emel, jenis: p.jenis || '', butiran, status: 'DIHANTAR',
                 bil_pembetulan: 0, tarikh_akhir: '', dikemaskini: masa_(), pegawai: '', nota: '' };
  sh.appendRow(LAJUR.map(k => data[k]));
  log_(rujukan, 'HANTAR', nama, null, 'DIHANTAR', '');
  notis_(emel, 'Permohonan diterima', 'Nombor rujukan anda: ' + rujukan);
  return { rujukan };
}

function semakStatus_(p) {
  const r = cari_(p.rujukan);
  if (String(r.data.emel).toLowerCase() !== String(p.emel || '').trim().toLowerCase()) {
    throw new Error('Rujukan atau emel tak sepadan');
  }
  return { rujukan: r.data.rujukan, status: r.data.status,
           tarikh_akhir: r.data.tarikh_akhir, nota: r.data.nota };
}

function semak_(p) {
  sahkanPegawai_(p);
  const r = cari_(p.rujukan);
  if (r.data.status !== 'DISEMAK') throw new Error('Tindakan tak dibenarkan untuk status ' + r.data.status);

  if (p.lengkap === true || p.lengkap === 'true') {
    return tukar_(p.rujukan, ['DISEMAK'], 'MENUNGGU_LULUS', 'SEMAK_LENGKAP', p.pegawai, '', {});
  }
  const bil = Number(r.data.bil_pembetulan || 0);
  if (bil >= MAX_PEMBETULAN) {
    return tukar_(p.rujukan, ['DISEMAK'], 'DITUTUP', 'TUTUP_HAD_PEMBETULAN', p.pegawai, 'Had pembetulan dicapai', {});
  }
  const tarikhAkhir = new Date(Date.now() + TEMPOH_HARI * 86400000).toISOString();
  const nota = String(p.senarai_kurang || '');
  const hasil = tukar_(p.rujukan, ['DISEMAK'], 'DIKEMBALIKAN', 'KEMBALI_PEMOHON', p.pegawai, nota,
                       { bil_pembetulan: bil + 1, tarikh_akhir: tarikhAkhir });
  notis_(r.data.emel, 'Permohonan perlu dibetulkan',
         'Rujukan ' + p.rujukan + '. Kekurangan: ' + nota +
         '. Sila betulkan sebelum ' + new Date(tarikhAkhir).toLocaleDateString('ms-MY'));
  return hasil;
}

function betulkan_(p) {
  const r = cari_(p.rujukan);
  if (String(r.data.emel).toLowerCase() !== String(p.emel || '').trim().toLowerCase()) {
    throw new Error('Rujukan atau emel tak sepadan');
  }
  if (r.data.status !== 'DIKEMBALIKAN') throw new Error('Tindakan tak dibenarkan untuk status ' + r.data.status);
  if (new Date() > new Date(r.data.tarikh_akhir)) {
    tukar_(p.rujukan, ['DIKEMBALIKAN'], 'DITUTUP', 'TUTUP_TAMAT_TEMPOH', 'sistem', '', {});
    throw new Error('Tempoh pembetulan dah tamat');
  }
  return tukar_(p.rujukan, ['DIKEMBALIKAN'], 'DIHANTAR', 'PEMBETULAN_DIHANTAR', r.data.nama, String(p.nota || ''), {});
}

function luluskan_(p) {
  sahkanPegawai_(p);
  const lulus = p.lulus === true || p.lulus === 'true';
  const nota = String(p.nota || '');
  if (!lulus && !nota.trim()) throw new Error('Alasan wajib bila tolak');
  const ke = lulus ? 'DILULUSKAN' : 'DITOLAK';
  const hasil = tukar_(p.rujukan, ['MENUNGGU_LULUS'], ke, lulus ? 'LULUS' : 'TOLAK', p.pegawai, nota, {});
  const r = cari_(p.rujukan);
  notis_(r.data.emel, 'Keputusan permohonan', 'Rujukan ' + p.rujukan + ': ' + ke + (nota ? '. ' + nota : ''));
  return hasil;
}

// ---- helper ----

function tukar_(rujukan, dibenarkan, ke, tindakan, pelaku, nota, tambahan) {
  const r = cari_(rujukan);
  if (!dibenarkan.includes(r.data.status)) throw new Error('Tindakan tak dibenarkan untuk status ' + r.data.status);
  const dari = r.data.status;
  const medan = Object.assign({ status: ke, dikemaskini: masa_(), pegawai: pelaku, nota: nota }, tambahan);
  Object.keys(medan).forEach(k => setMedan_(r.row, k, medan[k]));
  log_(rujukan, tindakan, pelaku, dari, ke, nota);
  return { rujukan, status: ke };
}

function sahkanPegawai_(p) {
  const token = PropertiesService.getScriptProperties().getProperty('TOKEN_PEGAWAI');
  if (!token || p.token !== token) throw new Error('Token pegawai tak sah');
}

function sheet_(nama) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nama);
  if (!sh) throw new Error('Sheet ' + nama + ' tak wujud. Jalankan setup() dulu');
  return sh;
}

function baca_() {
  const v = sheet_(SH_PERMOHONAN).getDataRange().getValues();
  const kepala = v[0];
  return v.slice(1).filter(b => b[0] !== '').map(b => {
    const o = {};
    kepala.forEach((k, i) => o[k] = b[i]);
    return o;
  });
}

function cari_(rujukan) {
  const v = sheet_(SH_PERMOHONAN).getDataRange().getValues();
  const idx = v.findIndex((b, i) => i > 0 && b[0] === rujukan);
  if (idx < 0) throw new Error('Rujukan ' + rujukan + ' tak wujud');
  const o = {};
  v[0].forEach((k, i) => o[k] = v[idx][i]);
  return { row: idx + 1, data: o };
}

function setMedan_(row, nama, nilai) {
  const kepala = sheet_(SH_PERMOHONAN).getRange(1, 1, 1, LAJUR.length).getValues()[0];
  const col = kepala.indexOf(nama);
  if (col >= 0) sheet_(SH_PERMOHONAN).getRange(row, col + 1).setValue(nilai);
}

function log_(rujukan, tindakan, pelaku, dari, ke, nota) {
  sheet_(SH_AUDIT).appendRow([masa_(), rujukan, tindakan, pelaku, dari || '', ke || '', nota || '']);
}

function notis_(emel, subjek, mesej) {
  try {
    MailApp.sendEmail(emel, subjek, mesej);
  } catch (err) {
    log_('-', 'NOTIS_GAGAL', 'sistem', null, null, err.message);
  }
}

function masa_() {
  return Utilities.formatDate(new Date(), 'Asia/Kuala_Lumpur', "yyyy-MM-dd'T'HH:mm:ss");
}
