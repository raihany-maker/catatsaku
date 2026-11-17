# Panduan Instalasi Catatsaku

Catatsaku adalah aplikasi pencatatan keuangan pribadi (pemasukan, pengeluaran, transfer, anggaran, target tabungan, tagihan, laporan).
Paket ini berisi semua yang Anda perlukan untuk memasang Catatsaku **dengan akun Anda sendiri** — data keuangan Anda tersimpan di Google Drive Anda, bukan milik orang lain.

```
Browser  ──►  Situs web (GitHub Pages / Vercel)  ──fetch JSON──►  Google Apps Script  ──►  Google Sheets di Drive Anda
              folder 2-frontend-web/                              folder 1-backend-apps-script/
```

**Yang Anda perlukan:** akun Google (Gmail), akun GitHub (gratis), dan Git di komputer. Waktu pemasangan ±30 menit.

---

## 0. Isi paket

| Folder / berkas | Untuk apa | Dipasang ke mana |
|---|---|---|
| `PANDUAN-INSTALASI.md` | Panduan ini | Dibaca saja |
| `1-backend-apps-script/` — `Kode.gs`, `Keamanan.gs`, `Data.gs`, `Transaksi.gs`, `Jadwal.gs`, `appsscript.json` | Server (API, keamanan, jadwal otomatis) | **Disalin-tempel** ke editor Google Apps Script |
| `2-frontend-web/` — `index.html`, `css/`, `js/`, `img/` | Tampilan aplikasi | **GitHub** (lalu GitHub Pages atau Vercel) — folder inilah yang di-`git init` |

> ⚠️ Berkas `.gs` **tidak boleh** masuk repository GitHub. Folder `2-frontend-web/` sudah bersih dari berkas backend.

Urutan pemasangan **wajib**: backend dulu (Langkah 1), baru frontend (Langkah 2) — karena frontend membutuhkan URL backend.

---

## 1. Pasang backend (Google Apps Script)

1. Buka <https://script.google.com> → **Proyek baru** → ganti nama proyek menjadi `Catatsaku`.
2. **Project Settings** (ikon roda gigi di kiri) → centang **Show "appsscript.json" manifest file in editor**.
3. Kembali ke **Editor** (ikon `< >`), buka `appsscript.json` → hapus semua isinya → tempel isi `1-backend-apps-script/appsscript.json`.
4. Ganti nama `Code.gs` menjadi `Kode`, hapus isinya, lalu tempel isi `1-backend-apps-script/Kode.gs`.
5. Klik **+ → Script** untuk membuat 4 berkas berikut, lalu tempel isinya masing-masing:
   `Keamanan`, `Data`, `Transaksi`, `Jadwal` (cukup ketik namanya, `.gs` otomatis ditambahkan; urutan bebas).
6. Klik 💾 **Simpan**.
7. Di dropdown fungsi (sebelah tombol Run), pilih **`setupAppEnvironment`** → **▶ Run** → **Review permissions** → pilih akun Google Anda → **Advanced → Go to Catatsaku (unsafe)** → **Allow**.
   > Peringatan "unsafe" muncul karena skrip ini buatan Anda sendiri dan belum diverifikasi Google. Skrip berjalan di akun Anda dan hanya mengakses Drive/Sheets/Gmail Anda.
8. Buka **Execution log** (muncul di bawah) dan **catat kode aktivasi** — Anda membutuhkannya untuk membuat PIN pertama:
   ```
   ✅ Setup selesai.
      Spreadsheet : https://docs.google.com/spreadsheets/d/…
      Folder Drive: https://drive.google.com/drive/folders/…
   🔐 KODE AKTIVASI PIN (catat sekarang, sekali pakai): ABCD2345
   ```
   Setup membuat folder Drive `Catatsaku` (Struk, Backup, Laporan), spreadsheet database, sheet + header, 14 kategori awal, pengaturan bawaan, dan 4 jadwal otomatis. **Aman dijalankan ulang** — tidak menimpa data, PIN, atau rahasia.
9. **Deploy → New deployment** → ikon roda gigi di samping "Select type" → **Web app**:
   - Description: `Catatsaku v1.0.0`
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Klik **Deploy** → salin **Web app URL** (berakhiran `/exec`). Simpan di Notes — dipakai di Langkah 2.
10. Uji: buka URL `/exec` itu di browser → harus tampil `{"success":true,"app":"Catatsaku API","v":"1.0.0"}`.

> **Kenapa "Anyone"?** Situs web memanggil Apps Script dari domain lain; mode "Only myself" akan memblokirnya. Keamanan tetap dijaga di server: PIN 6 digit yang di-hash dan disimpan di Script Properties, kunci 15 menit setelah 5× salah, token sesi yang kedaluwarsa otomatis, dan PIN pertama hanya bisa dibuat dengan kode aktivasi dari log editor Anda — orang lain yang menemukan URL tidak bisa mendahului Anda.

---

## 2. Pasang frontend (situs web)

### 2a. Isi URL backend

Buka `2-frontend-web/js/config.js` dengan editor teks (TextEdit di Mac, Notepad di Windows), lalu ganti URL contoh dengan URL `/exec` dari Langkah 1.9:

```js
window.CATATSAKU_CONFIG = { GAS_URL: 'https://script.google.com/macros/s/AKfy…/exec' };
```

Pastikan tanda kutip `'…'` tetap ada, lalu simpan. Kalau langkah ini terlewat, situs akan menampilkan layar **"URL backend belum diisi"**.

### 2b. Siapkan Git (sekali saja per komputer)

- **Mac:** buka Terminal, ketik `git --version`. Kalau belum terpasang, macOS akan menawarkan instalasi otomatis.
- **Windows:** unduh dari <https://git-scm.com/download/win>, pasang dengan pengaturan bawaan, lalu buka **PowerShell**.

Lalu atur identitas (nama bebas, email sebaiknya sama dengan akun GitHub):
```bash
git config --global user.name "Nama Anda"
```
```bash
git config --global user.email "email-akun-github@contoh.com"
```

### 2c. Buat repository di GitHub

Di <https://github.com>: **+ → New repository** → nama mis. `catatsaku` → pilih **Public** → **jangan** centang README / .gitignore / license → **Create repository**. Biarkan halamannya tetap terbuka.

### 2d. Masuk ke folder yang BENAR

> ⚠️ Folder kerja untuk semua perintah Git adalah **`2-frontend-web`** — bukan folder induk `Catatsaku-Paket-Deploy`, dan bukan `1-backend-apps-script`. Salah folder di sini membuat situs 404 tanpa satu pun pesan error.

Mac (sesuaikan lokasi tempat Anda mengekstrak paket):
```bash
cd ~/Downloads/Catatsaku-Paket-Deploy/2-frontend-web
```
Windows (PowerShell):
```powershell
cd "$HOME\Downloads\Catatsaku-Paket-Deploy\2-frontend-web"
```
> 💡 Cara cepat di Windows: buka folder `2-frontend-web` di File Explorer, klik address bar, ketik `powershell`, Enter.

Periksa isinya:
```bash
ls
```
(Windows: `dir`.) **Wajib** terlihat: `README.md  css  img  index.html  js` (plus `PANDUAN-INSTALASI.md`). Kalau yang muncul justru `1-backend-apps-script` dan `2-frontend-web`, Anda satu folder terlalu tinggi — jalankan `cd 2-frontend-web` dulu.

### 2e. Kirim ke GitHub (jalankan satu per satu)

```bash
git init
```
```bash
git add .
```
(Perhatikan **titik** di akhir.)
```bash
git commit -m "Upload pertama Catatsaku"
```
```bash
git branch -M main
```
```bash
git remote add origin https://github.com/USERNAME/catatsaku.git
```
(Ganti `USERNAME` dengan username GitHub Anda.)
```bash
git push -u origin main
```

Saat diminta **password**, tempel **Personal Access Token**, bukan password akun GitHub:
<https://github.com/settings/tokens> → **Generate new token (classic)** → centang **repo** → **Generate** → salin token `ghp_…` (hanya tampil sekali).
Layar memang **tidak menampilkan apa pun** saat token ditempel — itu normal, tekan Enter saja.

Tanda berhasil: muncul `Writing objects: 100%` dan `* [new branch] main -> main`.

> Kesulitan dengan terminal? Pakai **GitHub Desktop** (<https://desktop.github.com>): login lewat browser → **File → Add Local Repository** → pilih folder `2-frontend-web` → **Publish repository** (hilangkan centang "Keep this code private").

### 2f. Online-kan situs — pilih salah satu

**Pilihan A — GitHub Pages**
1. Di repository GitHub: **Settings → Pages**.
2. Source **Deploy from a branch** → Branch **main** · **/ (root)** → **Save** → centang **Enforce HTTPS**.
3. Tunggu 1–2 menit → buka `https://USERNAME.github.io/catatsaku/`.

**Pilihan B — Vercel** (alamat lebih pendek, mis. `catatsaku-anda.vercel.app`)
1. Daftar di <https://vercel.com> dengan **Continue with GitHub**.
2. **Add New… → Project** → pilih repository `catatsaku` → **Import**.
3. Framework Preset: **Other**. Kosongkan Build Command & Output Directory → **Deploy**.
4. Setelah selesai, buka alamat yang diberikan Vercel. Setiap `git push` berikutnya akan memperbarui situs otomatis.

Sebelum lanjut, buka repository di github.com dan pastikan `index.html` terlihat **langsung di halaman depan repo** (bukan di dalam folder), serta folder `css/` dan `js/` ada.

---

## 3. Pertama kali memakai

1. Buka situs → layar **Buat PIN Baru** → isi **kode aktivasi** (dari Langkah 1.8) + PIN 6 digit (bukan berurutan / angka sama semua) → **Simpan PIN**.
2. **Dompet → Tambah Dompet**: rekening bank, e-wallet, tunai, dan dompet bertipe **Tabungan** (untuk target) beserta saldo awal & tanggalnya.
3. **+ Catat Transaksi** untuk mencatat pemasukan, pengeluaran, atau transfer.
4. Opsional: **Anggaran**, **Target Tabungan**, **Tagihan** (draf dibuat otomatis beberapa hari sebelum jatuh tempo), **Pengaturan → Parameter Keuangan** (alokasi pemasukan, email notifikasi).

**Lupa PIN** → di editor Apps Script jalankan fungsi **`resetPin`** → salin kode aktivasi baru dari log → muat ulang aplikasi → Buat PIN.

> Data terakhir disimpan di perangkat agar aplikasi langsung tampil saat dibuka. Di perangkat bersama, gunakan menu **Keluar** untuk menghapusnya.

---

## 4. Memperbarui aplikasi

**Backend** (setelah mengubah berkas `.gs`): Simpan → **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**.
Jangan memilih *New deployment* — URL akan berubah dan `config.js` harus diisi ulang.
Bila versi baru menambah kolom/sheet, jalankan `setupAppEnvironment` sekali lagi — ia hanya **menambah** yang belum ada, tidak pernah menghapus data.

**Frontend**: naikkan angka `?v=1.0.6` di `index.html` (agar browser tidak memakai versi lama), lalu dari folder `2-frontend-web`:
```bash
git add .
```
```bash
git commit -m "Perbarui Catatsaku"
```
```bash
git push
```
Setelah 1–2 menit, tekan **Ctrl+Shift+R** (Windows) / **Cmd+Shift+R** (Mac).

---

## 5. Fungsi di editor Apps Script (dijalankan manual)

| Fungsi | Kegunaan |
|---|---|
| `setupAppEnvironment` | Setup awal / migrasi aman (boleh diulang) |
| `resetPin` | Lupa PIN — hapus PIN, cabut semua sesi, buat kode aktivasi baru |
| `bukaKunciPin` | Buka penguncian setelah 5× salah PIN |
| `rotasiSecretSesi` | Paksa semua perangkat memasukkan PIN lagi |
| `pasangTrigger` | Pasang ulang 4 jadwal otomatis |
| `matikanKeepWarm` / `nyalakanKeepWarm` | Matikan/nyalakan jadwal jaga-hangat 10 menit |
| `cekPerforma` | Status cache, jadwal, dan backup terakhir |

**Jadwal otomatis:** draf tagihan & pengingat harian 06:00 · backup mingguan Minggu 02:00 (menyimpan 12 terakhir) · ringkasan email tanggal 1 pukul 08:00 · jaga cache tetap hangat tiap 10 menit (jauh di bawah kuota harian akun Gmail).

> **Zona waktu:** aplikasi memakai **WITA (Asia/Makassar, GMT+8)** untuk tanggal, jadwal, dan laporan. Pengguna di zona WIB/WIT tetap bisa memakainya; jam jadwal di atas mengikuti WITA.

---

## 6. Kendala umum

| Gejala | Penyebab & solusi |
|---|---|
| Layar "URL backend belum diisi" | Isi `GAS_URL` di `js/config.js` (Langkah 2a), lalu `git add .` → `git commit -m "isi url"` → `git push` |
| "Koneksi ke server bermasalah" | URL salah / akses deployment bukan **Anyone** / lupa **New version** setelah mengubah `.gs` |
| "Database belum disiapkan" | Jalankan `setupAppEnvironment` di editor Apps Script |
| "Kode aktivasi belum ada" / kode hilang | Jalankan `resetPin`, ambil kode baru dari log |
| Terkunci 15 menit | Tunggu, atau jalankan `bukaKunciPin` |
| Data di layar beda dengan sheet setelah edit manual | Pengaturan → Integrasi Google → **Segarkan data dari Sheets** |
| Situs 404 dan di repo GitHub terlihat folder `2-frontend-web` atau `1-backend-apps-script` | `git init` dijalankan di folder induk. Masuk ke `2-frontend-web`, ulangi 2e, lalu `git push -u origin main --force` (menimpa isi repo yang salah) |
| Halaman tanpa warna/tata letak (CSS/JS 404) | Berkas diunggah lewat web GitHub sehingga folder hilang — selalu kirim lewat terminal/GitHub Desktop |
| `Password authentication is not supported` | Gunakan Personal Access Token, bukan password akun (lihat 2e) |
| `remote origin already exists` | Lewati langkah itu, lanjut `git push -u origin main` |
| Tampilan versi lama setelah push | Naikkan `?v=` di `index.html`, lalu Ctrl/Cmd+Shift+R |
| Email tidak terkirim | Isi email di Pengaturan → Parameter Keuangan; cek kuota Gmail harian |
