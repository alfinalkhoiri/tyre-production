# TyreProd — Sistem Manajemen Produksi Ban

Sistem manajemen produksi ban subcon berbasis web. Mengelola siklus produksi dari izin produksi, pengiriman material, pemakaian harian, hingga pengiriman hasil ke gudang.

## Struktur Repositori

```
TyreProd/
├── tyre-production/          # Backend — Django REST Framework
└── tyre-production-frontend/ # Frontend — React + TypeScript + Vite
```

- [Backend README](tyre-production/README.md)
- [Frontend README](tyre-production-frontend/README.md)

## Tech Stack

| Layer    | Teknologi                                              |
| -------- | ------------------------------------------------------ |
| Backend  | Django 6 + Django REST Framework + JWT Authentication  |
| Frontend | React 18 + TypeScript + Vite + TanStack React Query    |
| Database | SQLite (dev) / PostgreSQL (production)                 |
| Estimasi | ADC — Average Daily Consumption (pandas)               |

## Fitur Utama

- **Izin Produksi** — buat dan kelola production order dengan alur status lengkap
- **Stok Material** — penerimaan material, reservasi otomatis saat order dikonfirmasi
- **Kirim Material** — gudang mengirim material ke lantai produksi
- **Pemakaian Harian** — operator input pemakaian per shift
- **Kirim Hasil** — operator kirim tyre hasil produksi ke gudang
- **Spesifikasi Tyre** — CRUD ukuran ban + Bill of Materials dengan kalkulasi roll
- **Dashboard Cerdas** — alert stok kritis sinkron dengan izin produksi aktif
- **Analitik** — grafik pemakaian & produksi mingguan/bulanan
- **Estimasi Kebutuhan** — proyeksi stok berbasis ADC dengan saran pemesanan
- **Audit Log** — riwayat semua aktivitas sistem

## Alur Status Production Order

```
DRAFT → CONFIRMED → MAT_SENT → IN_PROGRESS → RESULT_SENT → DONE
```

## Role & Akses

| Role         | Akses                                                              |
| ------------ | ------------------------------------------------------------------ |
| `admin`      | Full akses + audit log + manajemen user                            |
| `purchasing` | Order produksi, stok material, spesifikasi, analitik, estimasi     |
| `operator`   | Pemakaian harian, terima material, kirim hasil produksi            |
| `viewer`     | Read-only — dashboard, spesifikasi, analitik                       |

## Quick Start

```bash
# Backend
cd tyre-production
python -m venv .venv && source .venv/bin/activate
pip install -r requirements/development.txt
cp .env.example .env   # set SECRET_KEY
python manage.py migrate
python manage.py seed_data   # data awal material & spec
python manage.py runserver

# Frontend (terminal baru)
cd tyre-production-frontend
npm install
npm run dev
```

Aplikasi berjalan di `http://localhost:5173` · API di `http://localhost:8000/api/`

## Lisensi

Proyek tugas kuliah — President University, Advanced Database.
