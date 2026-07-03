# TyreProd — Frontend

Antarmuka web untuk sistem manajemen produksi ban. Dibangun dengan React + TypeScript + Vite, terhubung ke [TyreProd Backend API](../tyre-production/README.md).

## Tech Stack

| Komponen      | Teknologi                                   |
| ------------- | ------------------------------------------- |
| Framework     | React 18 + TypeScript                       |
| Build Tool    | Vite 4                                      |
| Styling       | Tailwind CSS + CSS Variables                |
| HTTP Client   | Axios (dengan interceptor JWT auto-refresh) |
| Server State  | TanStack React Query v4                     |
| Routing       | React Router v6                             |
| UI Components | Radix UI (Dialog, Toast, Select, Dropdown)  |
| Icons         | Lucide React                                |

## Prasyarat

- Node.js 16+
- npm

## Instalasi (Development)

```bash
# 1. Masuk ke direktori
cd tyre-production-frontend

# 2. Install dependencies
npm install

# 3. Pastikan backend berjalan di localhost:8000

# 4. Jalankan dev server
npm run dev
```

Aplikasi berjalan di: `http://localhost:5173`

Semua request ke `/api/*` otomatis di-proxy ke `http://localhost:8000` (konfigurasi di `vite.config.ts`).

## Konfigurasi Environment

Buat file `.env` di root frontend (opsional untuk dev):

```bash
cp .env.example .env
```

| Variable            | Keterangan                                                           |
| ------------------- | -------------------------------------------------------------------- |
| `VITE_API_BASE_URL` | URL backend untuk production. Kosongkan untuk dev (pakai Vite proxy) |

Contoh `.env.production`:

```
VITE_API_BASE_URL=https://api.tyreprod.com
```

## Login

| Username | Password                    | Role               |
| -------- | --------------------------- | ------------------ |
| `admin`  | (set via `createsuperuser`) | Admin — full akses |

Role baru dibuat oleh admin via halaman Register di sistem.

## Role & Tampilan

| Role         | Halaman yang Bisa Diakses                                                                        |
| ------------ | ------------------------------------------------------------------------------------------------ |
| `admin`      | Semua halaman + Audit Log                                                                        |
| `purchasing` | Dashboard, Spesifikasi, Stok Material, Izin Produksi, Terima Hasil, Analitik, Estimasi Kebutuhan |
| `operator`   | Dashboard, Spesifikasi, Stok Produksi, Material, Kirim Hasil, Analitik                           |
| `viewer`     | Dashboard, Spesifikasi, Analitik, Estimasi Kebutuhan                                             |

## Fitur Utama

### Dashboard

- Ringkasan metrik sesuai role (Gudang vs Produksi)
- **Alert cerdas sinkron dengan metrik:**
  - Alert stok produksi kritis menampilkan nama material lengkap (kode · nama · sisa stok)
  - Jika ada izin produksi aktif → alert menampilkan nomor izin + daftar material yang perlu dikirim
  - Jika tidak ada izin produksi aktif → alert mengingatkan untuk membuat izin terlebih dahulu
  - Metrik "Stok Kritis" dan "Stok Rendah" sinkron langsung dengan data `purchasing-alerts` API
- Tabel order aktif dan status real-time

### Izin Produksi (Purchasing)

- Buat production order dengan item tyre spec
- Alur status: Draft → Konfirmasi → Kirim Material → Produksi → Selesai
- Cek ketersediaan stok otomatis saat konfirmasi — stok dikunci per order
- Kirim material ke lantai produksi
- Pantau progress material dan tyre per order
- Analisis yield (expected vs actual material usage)

### Stok Material (Purchasing)

- Tampilan stok per kategori: Stok Gudang, Dikunci (🔒), Tersedia
- Penerimaan material (PO) batch — semua material sekaligus
- Riwayat transaksi dengan pagination
- Saran safety stock dinamis berbasis data historis

### Produksi — Material & Pengiriman (Operator)

- Terima material yang dikirim gudang
- Input pemakaian harian per shift
- Kirim hasil produksi (tyre) ke gudang

### Spesifikasi

- CRUD tyre spec (ukuran, model, varian)
- Bill of Materials per spec dengan kalkulasi roll
- **Non-Aktif** menggantikan "Hapus" — spesifikasi tidak dihapus permanen, hanya disembunyikan (`is_active=false`); konfirmasi sebelum aksi

### Analitik

- Grafik pemakaian material mingguan (8 minggu terakhir)
- Grafik produksi ban bulanan (6 bulan terakhir)
- Top 10 material paling banyak dipakai (30 hari terakhir)
- Ringkasan status semua izin produksi

### Estimasi Kebutuhan

- Estimasi kebutuhan material berbasis ADC (Average Daily Consumption)
- Rata-rata tertimbang: 50% × 7 hari + 30% × 14 hari + 20% × 30 hari
- Status "Perlu Pesan" jika proyeksi stok tidak mencukupi dalam horizon
- Filter horizon: 7, 14, atau 30 hari ke depan
- Saran jumlah pemesanan per material

### Audit Log (Admin)

- Riwayat semua aktivitas: login, logout, ubah order, transaksi stok
- Filter by aksi, model, dan search
- Pagination

## Struktur Direktori

```
src/
├── api/              # Axios API calls per domain
│   ├── client.ts     # Axios instance + JWT interceptor
│   ├── auth.ts
│   ├── audit.ts
│   ├── spec.ts
│   ├── inventory.ts
│   ├── production.ts
│   └── ml.ts
├── components/
│   ├── layout/       # AppLayout, Header, TabBar
│   ├── ui/           # Button, Card, Badge, Input
│   │                 # ConfirmDialog, Pagination, Skeleton
│   ├── ErrorBoundary.tsx
│   └── ProtectedRoute.tsx
├── context/
│   ├── AuthContext.tsx   # JWT auth + role management
│   └── ToastContext.tsx  # Global toast notifications
├── pages/            # Halaman-halaman utama
│   ├── LoginPage.tsx
│   ├── DashboardPage.tsx
│   ├── IzinPage.tsx
│   ├── StokPage.tsx
│   ├── SpecPage.tsx
│   ├── MaterialPage.tsx
│   ├── KirimHasil.tsx
│   ├── TerimaHasil.tsx
│   ├── StokProdPage.tsx
│   ├── AnalyticsPage.tsx
│   ├── ForecastPage.tsx
│   └── AuditLogPage.tsx
├── types/
│   └── index.ts      # TypeScript interfaces
├── App.tsx           # Routing + code splitting (React.lazy)
└── main.tsx          # Entry point + providers
```

## Build untuk Production

```bash
npm run build
```

Output berada di folder `dist/`. Deploy sebagai static files ke:

- Nginx / Apache (serve `dist/`, proxy `/api` ke backend)
- Vercel / Netlify (set `VITE_API_BASE_URL` di environment variable)
- Atau serve dari Django melalui WhiteNoise (copy `dist/` ke `staticfiles/`)

### Konfigurasi Nginx (contoh)

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Frontend static files
    root /var/www/tyre-frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API ke Django
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

## Scripts

| Command           | Keterangan                     |
| ----------------- | ------------------------------ |
| `npm run dev`     | Dev server dengan hot-reload   |
| `npm run build`   | Production build ke `dist/`    |
| `npm run preview` | Preview production build lokal |
| `npm run lint`    | ESLint check                   |

## Lisensi

Proyek tugas kuliah — President University
