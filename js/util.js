/* Utilitas umum: format Rupiah, tanggal WITA (Asia/Makassar), terbilang, HTML aman. */
(function (root) {
  const TZ = 'Asia/Makassar';
  const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const fmtAngka = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });
  const pad = n => (n < 10 ? '0' : '') + n;

  let fmtWita = null;
  function partsWita(d) {
    if (!fmtWita) fmtWita = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    const o = {};
    fmtWita.formatToParts(d).forEach(p => { o[p.type] = p.value; });
    return o;
  }

  const U = {
    TZ, BLN, BULAN, HARI,

    // ---------------- angka & uang
    angka: n => fmtAngka.format(Math.round(n || 0)),
    /** 'Rp 1.250.000'; opsi tanda: '+'/'−' di depan */
    rp(n, o) {
      o = o || {};
      n = Math.round(n || 0);
      const s = 'Rp ' + fmtAngka.format(Math.abs(n));
      if (n < 0) return '−' + s;
      if (o.tanda && n > 0) return '+' + s;
      return s;
    },
    /** 'Rp 1,85 jt' / 'Rp 936 rb' */
    rpPendek(n) {
      const a = Math.abs(n || 0), neg = n < 0 ? '−' : '';
      const f = (v, d) => v.toLocaleString('id-ID', { maximumFractionDigits: d });
      if (a >= 1e9) return neg + 'Rp ' + f(a / 1e9, 2) + ' M';
      if (a >= 1e6) return neg + 'Rp ' + f(a / 1e6, 2) + ' jt';
      if (a >= 1e3) return neg + 'Rp ' + f(a / 1e3, 0) + ' rb';
      return neg + 'Rp ' + f(a, 0);
    },
    sumbuRp(v) {
      const a = Math.abs(v);
      if (a >= 1e9) return (v / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' M';
      if (a >= 1e6) return (v / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' jt';
      if (a >= 1e3) return (v / 1e3).toLocaleString('id-ID', { maximumFractionDigits: 0 }) + ' rb';
      return String(v);
    },
    persen(x, d) { return (x === null || x === undefined || !isFinite(x)) ? '–' : x.toLocaleString('id-ID', { maximumFractionDigits: d === undefined ? 0 : d }) + '%'; },
    parseNominal(s) { const n = Number(String(s || '').replace(/\D/g, '')); return Number.isFinite(n) ? n : 0; },

    // ---------------- tanggal (string 'yyyy-MM-dd', aritmetika UTC murni)
    sekarang() {
      const p = partsWita(new Date());
      return { ymd: `${p.year}-${p.month}-${p.day}`, hm: `${p.hour}:${p.minute}`, iso: `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}` };
    },
    hariIni() { return U.sekarang().ymd; },
    keUTC(ymd) { const p = ymd.slice(0, 10).split('-').map(Number); return Date.UTC(p[0], p[1] - 1, p[2]); },
    dariUTC(ms) { const d = new Date(ms); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); },
    tambahHari(ymd, n) { return U.dariUTC(U.keUTC(ymd) + n * 864e5); },
    tambahBulan(ym, n) { const p = ym.split('-').map(Number); const d = new Date(Date.UTC(p[0], p[1] - 1 + n, 1)); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1); },
    hariDalam(ym) { const p = ym.split('-').map(Number); return new Date(Date.UTC(p[0], p[1], 0)).getUTCDate(); },
    selisihHari(a, b) { return Math.round((U.keUTC(b) - U.keUTC(a)) / 864e5); },
    hariMinggu(ymd) { return new Date(U.keUTC(ymd)).getUTCDay(); }, // 0 = Minggu
    tgl(ymd) { if (!ymd) return '–'; const p = ymd.slice(0, 10).split('-'); return Number(p[2]) + ' ' + BLN[Number(p[1]) - 1] + ' ' + p[0]; },
    tglPendek(ymd) { const p = ymd.slice(0, 10).split('-'); return Number(p[2]) + ' ' + BLN[Number(p[1]) - 1]; },
    tglHari(ymd) { return HARI[U.hariMinggu(ymd)] + ', ' + U.tgl(ymd); },
    tglJam(iso) { return iso ? U.tgl(iso) + ', ' + (iso.slice(11, 16) || '00:00') : '–'; },
    bulan(ym) { const p = ym.split('-'); return BLN[Number(p[1]) - 1] + ' ' + p[0]; },
    bulanPanjang(ym) { const p = ym.split('-'); return BULAN[Number(p[1]) - 1] + ' ' + p[0]; },
    bulanNama(ym) { return BLN[Number(ym.split('-')[1]) - 1]; },
    /** '2 jam lalu' / 'Kemarin' / '10 Nov' — iso WITA */
    relatif(iso) {
      if (!iso) return '';
      const s = U.sekarang();
      const d = iso.slice(0, 10);
      if (d === s.ymd) {
        const m = (Number(s.hm.slice(0, 2)) * 60 + Number(s.hm.slice(3))) - (Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16)));
        if (m < 1) return 'Baru saja';
        if (m < 60) return m + ' menit lalu';
        if (m < 24 * 60 && m > 0) return Math.floor(m / 60) + ' jam lalu';
        return 'Hari ini, ' + iso.slice(11, 16);
      }
      if (d === U.tambahHari(s.ymd, -1)) return 'Kemarin';
      if (d === U.tambahHari(s.ymd, 1)) return 'Besok';
      return U.tglPendek(d) + (d.slice(0, 4) !== s.ymd.slice(0, 4) ? ' ' + d.slice(0, 4) : '');
    },
    labelHari(ymd) {
      const h = U.hariIni();
      if (ymd === h) return 'Hari ini, ' + U.tgl(ymd);
      if (ymd === U.tambahHari(h, -1)) return 'Kemarin, ' + U.tgl(ymd);
      return U.tglHari(ymd);
    },

    // ---------------- terbilang (Indonesia)
    terbilang(n) {
      n = Math.floor(Math.abs(n || 0));
      if (!n) return '';
      const s = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];
      const t = x => {
        if (x < 12) return s[x];
        if (x < 20) return t(x - 10) + ' belas';
        if (x < 100) return t(Math.floor(x / 10)) + ' puluh' + (x % 10 ? ' ' + t(x % 10) : '');
        if (x < 200) return 'seratus' + (x - 100 ? ' ' + t(x - 100) : '');
        if (x < 1000) return t(Math.floor(x / 100)) + ' ratus' + (x % 100 ? ' ' + t(x % 100) : '');
        if (x < 2000) return 'seribu' + (x - 1000 ? ' ' + t(x - 1000) : '');
        if (x < 1e6) return t(Math.floor(x / 1000)) + ' ribu' + (x % 1000 ? ' ' + t(x % 1000) : '');
        if (x < 1e9) return t(Math.floor(x / 1e6)) + ' juta' + (x % 1e6 ? ' ' + t(x % 1e6) : '');
        if (x < 1e12) return t(Math.floor(x / 1e9)) + ' miliar' + (x % 1e9 ? ' ' + t(x % 1e9) : '');
        return t(Math.floor(x / 1e12)) + ' triliun' + (x % 1e12 ? ' ' + t(x % 1e12) : '');
      };
      const r = t(n) + ' rupiah';
      return r.charAt(0).toUpperCase() + r.slice(1);
    },

    // ---------------- lain-lain
    esc(s) {
      return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },
    inisial(nama) { const p = String(nama || '?').trim().split(/\s+/); return ((p[0] || '?')[0] + (p[1] ? p[1][0] : (p[0][1] || ''))).toUpperCase(); },
    debounce(fn, ms) { let t; return function () { const a = arguments, self = this; clearTimeout(t); t = setTimeout(() => fn.apply(self, a), ms); }; },
    tmpId() { return 'tmp-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); },
    qs(params) { return Object.keys(params).filter(k => params[k] !== undefined && params[k] !== '' && params[k] !== null).map(k => encodeURIComponent(k) + '=' + encodeURIComponent(params[k])).join('&'); },
    parseQs(s) { const o = {}; String(s || '').split('&').filter(Boolean).forEach(p => { const i = p.indexOf('='); o[decodeURIComponent(i < 0 ? p : p.slice(0, i))] = i < 0 ? '' : decodeURIComponent(p.slice(i + 1)); }); return o; },
    simpanLokal(k, v) { try { localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); return true; } catch (e) { return false; } },
    bacaLokal(k, json) { try { const v = localStorage.getItem(k); return json ? (v ? JSON.parse(v) : null) : v; } catch (e) { return null; } },
    hapusLokal(k) { try { localStorage.removeItem(k); } catch (e) { /* abaikan */ } }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = U; else root.U = U;
})(typeof window !== 'undefined' ? window : globalThis);
