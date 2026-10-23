# BIVDA — aplikasi terstruktur

## Isi folder

- `index.html` — tampilan aplikasi.
- `styles.css` — gaya tambahan.
- `app.js` — login, formulir, tampilan, dan aksi aplikasi.
- `firebase.js` — konfigurasi Firebase, login persisten, dan cache Firestore.
- `data-store.js` — migrasi, simpan, hapus, dan sinkronisasi data.
- `firestore.rules` — aturan akses per akun.
- `firebase.json`, `.firebaserc`, `firestore.indexes.json` — konfigurasi untuk Firebase CLI.

## Penyimpanan dan sinkronisasi

Kategori, pembeli, transaksi, dan kerugian disimpan sebagai dokumen terpisah di Cloud Firestore. Jalurnya berada di bawah `artifacts/bivda-app/users/{UID}`. UID berasal dari akun Firebase yang sedang masuk. Saat masuk dengan akun yang sama di perangkat lain, aplikasi membaca perubahan Cloud secara langsung. Cache Firestore juga diaktifkan untuk refresh dan penggunaan sementara tanpa internet.

Data versi lama yang tersimpan sebagai array pada dokumen akun dimigrasikan otomatis ke koleksi masing-masing pada login pertama setelah aturan Firestore yang baru dipasang. Dokumen lama tetap dibiarkan sebagai cadangan.

## Menjalankan di komputer ini

Jangan membuka `index.html` langsung dengan alamat `file:///`. File aplikasi kini dipisah sebagai JavaScript module dan browser harus membacanya lewat HTTP. Jalankan `start-app.cmd`, biarkan jendela server tetap terbuka, lalu buka `http://localhost:5173`.

## Langkah wajib di Firebase

Kode aplikasi tidak bisa membuka akses Cloud dengan aman jika Firestore Rules menolak akun. Aturan di `firestore.rules` hanya mengizinkan pengguna masuk membaca dan mengubah data dengan UID miliknya sendiri. Dari folder ini, jalankan:

```powershell
firebase deploy --only firestore:rules --project musicgo-d7c61
```

Untuk menerbitkan aplikasi agar bisa dibuka dari perangkat lain, jalankan dari folder ini:

```powershell
firebase deploy --only hosting,firestore:rules --project musicgo-d7c61
```

Perintah itu harus dijalankan dari Firebase CLI yang sudah masuk ke akun pemilik proyek. Jangan gunakan aturan publik yang mengizinkan semua orang membaca/menulis database.

Setelah hosting aktif, buka alamat HTTPS Firebase Hosting yang dilaporkan CLI pada setiap perangkat dan masuk memakai akun BIVDA yang sama. Data tersimpan di Cloud Firestore; berkas HTML saja tidak membawa data akun.

## Catatan migrasi

Folder `backup` berisi salinan `index.html` sebelum refaktor. Tetap gunakan `index.html` di folder utama untuk aplikasi versi baru. Jika status aplikasi menunjukkan `permission-denied`, aturan Firestore belum terpasang atau akun tidak memiliki akses ke proyek tersebut.
