# TyreProd — Frontend

Antarmuka web untuk sistem manajemen produksi ban. Dibangun dengan React + TypeScript + Vite, terhubung ke [TyreProd Backend API](../tyre-production/README.md).

## Tech Stack

| Komponen | Teknologi |
|---|---|
| Framework | React 18 + TypeScript |
| Build Tool | Vite 4 |
| Styling | Tailwind CSS + CSS Variables |
| HTTP Client | Axios (dengan interceptor JWT auto-refresh) |
| Server State | TanStack React Query v4 |
| Routing | React Router v6 |
| UI Components | Radix UI (Dialog, Toast, Select, Dropdown) |
| Charts | Recharts |
| Icons | Lucide React |

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

| Variable | Keterangan |
|---|---|
| `VITE_API_BASE_URL` | URL backend untuk production. Kosongkan untuk dev (pakai Vite proxy) |

Contoh `.env.production`:
```
VITE_API_BASE_URL=https://api.tyreprod.com
```

## Login

| Username | Password | Role |
|---|---|---|
| `admin` | (set via `createsuperuser`) | Admin — full akses |

Role baru dibuat oleh admin via halaman Register di sistem.

## Role & Tampilan

| Role | Halaman yang Bisa Diakses |
|---|---|
| `admin` | Semua halaman + Audit Log |
| `manager` | Dashboard, Spesifikasi, Stok Material, Izin Produksi, Terima Hasil, Analitik, Forecast |
| `operator` | Dashboard, Spesifikasi, Stok Produksi, Material, Kirim Hasil |
| `viewer` | Dashboard, Spesifikasi, Analitik, Forecast |

## Fitur Utama

### Dashboard
- Ringkasan metrik sesuai role (Gudang vs Produksi)
- Alert stok kritis dan material minus
- Tabel order aktif dan status real-time

### Izin Produksi (Manager)
- Buat production order dengan item tyre spec
- Alur status: Draft → Konfirmasi → Kirim Material → Produksi → Selesai
- Cek ketersediaan stok otomatis saat konfirmasi
- Kirim material ke lantai produksi
- Pantau progress material dan tyre per order
- Analisis yield (expected vs actual material usage)

### Stok Material (Manager)
- Tampilan stok per kategori dengan progress bar
- Penerimaan material (PO) batch — semua material sekaligus
- Riwayat transaksi dengan pagination
- Saran safety stock dinamis berbasis data historis (formula statistik)

### Produksi — Material & Pengiriman (Operator)
- Terima material yang dikirim gudang
- Input pemakaian harian per shift
- Kirim hasil produksi (tyre) ke gudang

### Spesifikasi
- CRUD tyre spec (ukuran, model, varian)
- Bill of Materials per spec dengan kalkulasi roll

### Analitik & Forecast
- Grafik tren pemakaian material harian
- Forecast kebutuhan material dengan ML (RandomForest)
- Status model ML

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
│   ├── analytics.ts
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

| Command | Keterangan |
|---|---|
| `npm run dev` | Dev server dengan hot-reload |
| `npm run build` | Production build ke `dist/` |
| `npm run preview` | Preview production build lokal |
| `npm run lint` | ESLint check |

## Lisensi

Proyek tugas kuliah — President University, Advanced Database.
