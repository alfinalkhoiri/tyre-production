# TyreProd — Backend API

Sistem Manajemen Produksi Ban berbasis Django REST Framework. Mengelola siklus produksi ban subcon dari izin produksi, pengiriman material, pemakaian harian, hingga pengiriman hasil ke gudang.

## Tech Stack

| Komponen     | Teknologi                                 |
| ------------ | ----------------------------------------- |
| Framework    | Django 6.0.5 + Django REST Framework 3.17 |
| Auth         | JWT via `djangorestframework-simplejwt`   |
| Database     | SQLite (dev) / PostgreSQL (production)    |
| Estimasi     | pandas (ADC — Average Daily Consumption)  |
| API Docs     | drf-spectacular (Swagger/ReDoc)           |
| Static Files | WhiteNoise                                |
| Server       | Gunicorn (production)                     |

## Prasyarat

- Python 3.11+
- pip

## Instalasi (Development)

```bash
# 1. Clone dan masuk ke direktori
cd tyre-production

# 2. Buat virtual environment
python -m venv venv
source venv/bin/activate       # Linux/Mac
venv\Scripts\activate          # Windows

# 3. Install dependencies
pip install -r requirements/development.txt

# 4. Buat file .env
cp .env.example .env
# Edit .env — minimal set SECRET_KEY

# 5. Jalankan migrasi
python manage.py migrate

# 6. Buat superuser (admin)
python manage.py createsuperuser

# 7. Jalankan server
python manage.py runserver
```

Server berjalan di: `http://localhost:8000`

## Konfigurasi Environment (`.env`)

| Variable               | Wajib   | Keterangan                                                                                                             |
| ---------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------- |
| `SECRET_KEY`           | ✅      | Generate: `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"` |
| `DEBUG`                | -       | `True` (dev) / `False` (prod). Default: `True`                                                                         |
| `ALLOWED_HOSTS`        | ✅ prod | Domain yang diizinkan, pisah koma                                                                                      |
| `CORS_ALLOWED_ORIGINS` | -       | URL frontend, pisah koma. Default: `localhost:3000,localhost:5173`                                                     |
| `DB_NAME`              | ✅ prod | Nama database PostgreSQL. Jika kosong, pakai SQLite                                                                    |
| `DB_USER`              | ✅ prod | User PostgreSQL                                                                                                        |
| `DB_PASSWORD`          | ✅ prod | Password PostgreSQL                                                                                                    |
| `DB_HOST`              | -       | Host PostgreSQL. Default: `localhost`                                                                                  |
| `DB_PORT`              | -       | Port PostgreSQL. Default: `5432`                                                                                       |
| `SECURE_SSL_REDIRECT`  | -       | Default `True` saat `DEBUG=False`                                                                                      |
| `SECURE_HSTS_SECONDS`  | -       | Default `31536000` (1 tahun) saat `DEBUG=False`                                                                        |

## Role & Akses

| Role         | Deskripsi          | Akses                                              |
| ------------ | ------------------ | -------------------------------------------------- |
| `admin`      | Administrator      | Full CRUD semua endpoint + audit log               |
| `purchasing` | Admin Purchasing   | Kelola order produksi, material, stok, spesifikasi |
| `operator`   | Operator Produksi  | Daily usage, terima material, kirim hasil          |
| `viewer`     | Read-only          | Hanya GET di semua endpoint                        |

## API Endpoints

### Auth (`/api/auth/`)

| Method         | Endpoint            | Akses  | Keterangan                     |
| -------------- | ------------------- | ------ | ------------------------------ |
| POST           | `/login/`           | Public | Login, returns JWT + user info |
| POST           | `/token/refresh/`   | Public | Refresh access token           |
| POST           | `/logout/`          | Auth   | Blacklist refresh token        |
| GET/PUT        | `/me/`              | Auth   | Profile sendiri                |
| POST           | `/change-password/` | Auth   | Ganti password                 |
| POST           | `/register/`        | Admin  | Buat user baru                 |
| GET            | `/users/`           | Admin  | List semua user                |
| GET/PUT/DELETE | `/users/{id}/`      | Admin  | Kelola user                    |
| GET            | `/audit-logs/`      | Admin  | Riwayat aktivitas sistem       |

### Spesifikasi (`/api/spec/`)

| Method        | Endpoint                   | Write Access          | Keterangan                                                       |
| ------------- | -------------------------- | --------------------- | ---------------------------------------------------------------- |
| GET/POST      | `/materials/`              | Admin, Purchasing     | CRUD material (hanya `is_active=True`)                           |
| GET           | `/materials/low-stock/`    | Auth                  | Material stok kritis                                             |
| PATCH         | `/materials/{id}/`         | Admin, Purchasing     | Non-aktifkan: `{"is_active": false}` — ditolak jika ada FK aktif |
| GET/POST      | `/tyre-specs/`             | Admin, Purchasing     | CRUD spesifikasi tyre (hanya `is_active=True`)                   |
| PATCH         | `/tyre-specs/{id}/`        | Admin, Purchasing     | Non-aktifkan: `{"is_active": false}`                             |
| GET/POST      | `/bom-items/`              | Admin, Purchasing     | CRUD Bill of Materials                                           |

> **Catatan Hapus Master Data:**
> - `TyreSpec` tidak dapat dihapus permanen jika sudah dipakai di production order — sistem hanya menonaktifkan (`is_active=False`).
> - `Material` tidak dapat dihapus jika direferensikan di BOM, transaksi stok, pemakaian harian, atau reservasi stok. API mengembalikan `400` dengan pesan error; gunakan PATCH `is_active=false` sebagai gantinya.
> - List endpoint secara default hanya mengembalikan data aktif (`is_active=True`).

### Inventori (`/api/inventory/`)

| Method   | Endpoint                          | Write Access      | Keterangan               |
| -------- | --------------------------------- | ----------------- | ------------------------ |
| GET/POST | `/transactions/`                  | Admin, Purchasing | Transaksi stok (IN/AUTO) |
| GET      | `/transactions/by-material/{id}/` | Auth              | Riwayat per material     |

### Produksi (`/api/production/`)

| Method   | Endpoint                         | Write Access                  | Keterangan                            |
| -------- | -------------------------------- | ----------------------------- | ------------------------------------- |
| GET/POST | `/orders/`                       | Admin, Purchasing             | CRUD production order                 |
| POST     | `/orders/{id}/confirm/`          | Admin, Purchasing             | DRAFT → CONFIRMED (kunci stok otomatis) |
| POST     | `/orders/{id}/start/`            | Admin, Purchasing             | CONFIRMED → IN_PROGRESS               |
| POST     | `/orders/{id}/done/`             | Admin, Purchasing             | IN_PROGRESS → DONE                    |
| GET/POST | `/orders/{id}/shipments/`        | Admin, Purchasing             | Kirim material ke produksi            |
| POST     | `/orders/{id}/receive-material/` | Admin, Purchasing, Operator   | Konfirmasi terima material            |
| GET/POST | `/orders/{id}/deliveries/`       | Admin, Purchasing, Operator   | Kirim hasil produksi                  |
| GET      | `/orders/{id}/progress/`         | Auth                          | Progress material & tyre              |
| GET      | `/orders/{id}/yield/`            | Auth                          | Analisis yield order                  |
| GET      | `/orders/{id}/requirements/`     | Auth                          | Kebutuhan material + stok dikunci     |
| GET/POST | `/daily-usages/`                 | Admin, Purchasing, Operator   | Pemakaian material harian             |
| GET      | `/orders/pending-counts/`        | Auth                          | Jumlah pending shipment & result      |
| GET      | `/orders/prod-stock/`            | Auth                          | Stok material di lantai produksi      |
| GET      | `/orders/safety-suggestions/`    | Auth                          | Saran safety stock dinamis            |
| GET      | `/orders/purchasing-alerts/`     | Auth                          | Alert material perlu dipesan          |
| GET      | `/orders/analytics/`             | Auth                          | Analitik produksi & pemakaian         |

### Estimasi Kebutuhan — ADC (`/api/ml/`)

| Method | Endpoint               | Keterangan                                             |
| ------ | ---------------------- | ------------------------------------------------------ |
| GET    | `/forecast/`           | Estimasi kebutuhan semua material (`?horizon=7`)        |
| GET    | `/forecast/{id}/`      | Estimasi kebutuhan per material                        |

Estimasi berbasis **ADC (Average Daily Consumption)** — rata-rata tertimbang pemakaian 7, 14, dan 30 hari:

```
adc = 0.5 × adc_7  +  0.3 × adc_14  +  0.2 × adc_30
```

Status `perlu_pesan` muncul jika:
- Sisa stok ≤ lead time × ADC (default lead time 7 hari), **atau**
- Proyeksi stok di akhir horizon < safety stock

### Dokumentasi API

- Swagger UI: `http://localhost:8000/api/docs/`
- ReDoc: `http://localhost:8000/api/redoc/`
- OpenAPI JSON: `http://localhost:8000/api/schema/`

> Docs dilindungi autentikasi saat `DEBUG=False` (production)

## Master Data — Soft Delete (`is_active`)

`Material` dan `TyreSpec` mendukung **soft delete** melalui field `is_active`:

| Model       | Perilaku DELETE / Non-Aktif                                                                 |
| ----------- | ------------------------------------------------------------------------------------------- |
| `TyreSpec`  | Tidak bisa dihapus permanen jika ada `ProductionOrderItem` yang merujuk. Selalu soft-delete via PATCH `is_active=false`. |
| `Material`  | Ditolak (HTTP 400) jika ada FK aktif di BOMItem, StockTransaction, DailyUsageEntry, MaterialShipmentEntry, atau StockReservation. Jika tidak ada referensi, boleh dihapus permanen. |

Migrasi terkait: `specification/migrations/0004_add_is_active_to_material_and_tyrespec.py`

## Stok Dikunci (StockReservation)

Saat production order dikonfirmasi, sistem **mengunci stok** material yang dibutuhkan secara otomatis (`StockReservation`). Stok yang dikunci tidak tersedia untuk order lain sampai order selesai atau dibatalkan.

- **Stok Gudang** = total stok fisik
- **Dikunci** = total reservasi aktif dari order yang sedang berjalan
- **Tersedia** = Stok Gudang − Dikunci

## Alur Status Production Order

```
DRAFT → CONFIRMED → MAT_SENT → IN_PROGRESS → RESULT_SENT → DONE
```

| Status        | Arti                                   |
| ------------- | -------------------------------------- |
| `DRAFT`       | Order dibuat, belum dikonfirmasi       |
| `CONFIRMED`   | Dikonfirmasi, stok dikunci             |
| `MAT_SENT`    | Material dikirim ke lantai produksi    |
| `IN_PROGRESS` | Produksi berjalan                      |
| `RESULT_SENT` | Hasil dikirim ke gudang                |
| `DONE`        | Order selesai, reservasi stok dilepas  |

## Management Commands

| Command                              | Keterangan                                       |
| ------------------------------------ | ------------------------------------------------ |
| `python manage.py migrate`           | Jalankan migrasi database                        |
| `python manage.py createsuperuser`   | Buat akun admin pertama                          |
| `python manage.py forecast_preview`  | Tampilkan tabel estimasi ADC di terminal         |

## Deploy ke Production

```bash
# 1. Install production dependencies
pip install -r requirements/production.txt

# 2. Set .env (DEBUG=False, SECRET_KEY, DB_*, ALLOWED_HOSTS)

# 3. Migrasi & static files
python manage.py migrate
python manage.py collectstatic --no-input

# 4. Jalankan dengan Gunicorn
gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 3
```

### Catatan PostgreSQL

Aktifkan dengan menambahkan variabel ini ke `.env`:

```
DB_NAME=tyre_production
DB_USER=tyre_user
DB_PASSWORD=...
```

Jika `DB_NAME` tidak diset, sistem otomatis menggunakan SQLite.

## Struktur Direktori

```
tyre-production/
├── accounts/          # Auth, UserProfile, AuditLog
├── config/            # Settings, URLs
├── inventory/         # StockTransaction
├── ml/                # Estimasi ADC (forecast.py, views.py, tests.py)
├── production/        # ProductionOrder, DailyUsage, Shipment, Delivery, StockReservation
├── specification/     # Material, TyreSpec, BOMItem
├── requirements/
│   ├── base.txt       # Shared dependencies
│   ├── development.txt
│   └── production.txt # + gunicorn, whitenoise, psycopg2
├── .env.example
└── manage.py
```

## Lisensi

Proyek tugas kuliah — President University, Advanced Database.
