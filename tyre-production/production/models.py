from django.db import models
from specification.models import TyreSpec, Material

# ═══════════════════════════════════════════════════════════════════════════
# ALUR UTAMA "IZIN PRODUKSI" (ProductionOrder)
#
# Satu ProductionOrder mewakili satu izin untuk memproduksi sejumlah ban.
# Statusnya bergerak melalui state machine berikut (lihat STATUS_CHOICES):
#
#   DRAFT ──confirm()──> CONFIRMED ──(kirim material pertama)──> MAT_SENT
#     │                                                              │
#     └──reject()──> REJECTED                            (mulai produksi)
#                                                                     ▼
#                                                              IN_PROGRESS
#                                                                     │
#                                                     (kirim hasil pertama)
#                                                                     ▼
#                                                              RESULT_SENT
#                                                                     │
#                                                        (klik "Tandai Selesai")
#                                                                     ▼
#                                                                   DONE
#
# Catatan penting (hasil beberapa kali perbaikan bug):
# - MAT_SENT dan RESULT_SENT berpindah begitu ada KIRIMAN PERTAMA, bukan
#   menunggu 100% kebutuhan terpenuhi — karena material & hasil produksi
#   bisa dikirim bertahap. Order tetap bisa terima kiriman susulan setelah
#   status ini berubah.
# - DONE baru boleh terjadi kalau hasil produksi SUDAH benar-benar 100%
#   sesuai qty_plan (dicek di production/views.py, action `done`).
# ═══════════════════════════════════════════════════════════════════════════


class ProductionOrder(models.Model):
    """Satu izin produksi = satu nomor order + target beberapa jenis ban (items)."""

    # Konstanta status, dipakai di seluruh app (views.py, serializers.py, frontend)
    # supaya tidak ada typo string status yang tercecer di banyak tempat.
    STATUS_DRAFT        = 'DRAFT'
    STATUS_CONFIRMED    = 'CONFIRMED'
    STATUS_MAT_SENT     = 'MAT_SENT'
    STATUS_IN_PROGRESS  = 'IN_PROGRESS'
    STATUS_RESULT_SENT  = 'RESULT_SENT'
    STATUS_DONE         = 'DONE'
    STATUS_REJECTED     = 'REJECTED'
    STATUS_CHOICES = [
        ('DRAFT',        'Draft'),
        ('CONFIRMED',    'Dikonfirmasi'),
        ('MAT_SENT',     'Material Dikirim'),
        ('IN_PROGRESS',  'Sedang Diproduksi'),
        ('RESULT_SENT',  'Hasil Dikirim'),
        ('DONE',         'Selesai'),
        ('REJECTED',     'Ditolak'),
    ]

    SHIFT_1 = '1'
    SHIFT_2 = '2'
    SHIFT_3 = '3'
    SHIFT_CHOICES = [
        ('1', 'Shift 1'),
        ('2', 'Shift 2'),
        ('3', 'Shift 3'),
    ]

    number = models.CharField(max_length=50, unique=True)   # nomor izin, mis. "S-730"
    date   = models.DateField()
    shift  = models.CharField(max_length=1, choices=SHIFT_CHOICES)
    pic    = models.CharField(max_length=100)                # nama penanggung jawab
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_DRAFT)

    class Meta:
        ordering = ['-date', 'shift']  # tampil terbaru dulu di list
        verbose_name = 'Production Order'
        verbose_name_plural = 'Production Orders'

    def __str__(self):
        return f'{self.number} — {self.date} Shift {self.shift}'


class ProductionOrderItem(models.Model):
    """Satu baris target dalam izin produksi: "buat ban X sebanyak qty_plan"."""
    order      = models.ForeignKey(ProductionOrder, on_delete=models.CASCADE, related_name='items')
    tyre_spec  = models.ForeignKey(TyreSpec, on_delete=models.PROTECT, related_name='order_items')
    qty_plan   = models.PositiveIntegerField()  # target jumlah ban untuk spec ini

    class Meta:
        ordering = ['order', 'tyre_spec']
        unique_together = [('order', 'tyre_spec')]  # 1 spec cuma boleh 1 baris per order

    def __str__(self):
        return f'{self.order.number} — {self.tyre_spec} x{self.qty_plan}'


# ── Pemakaian Harian (dicatat operator di lantai produksi) ───────────────────
# Ini yang jadi dasar perhitungan "Stok Produksi" (berapa material yang sudah
# dipakai dari yang diterima) dan estimasi kebutuhan (ml/forecast.py).

class DailyUsage(models.Model):
    """Header laporan pemakaian material harian: 1 tanggal + 1 shift = 1 laporan."""
    SHIFT_CHOICES = [('1', 'Shift 1'), ('2', 'Shift 2'), ('3', 'Shift 3')]

    date  = models.DateField()
    shift = models.CharField(max_length=1, choices=SHIFT_CHOICES)
    order = models.ForeignKey(
        ProductionOrder, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='daily_usages'
    )  # opsional: dikaitkan ke izin produksi tertentu untuk hitung yield-nya
    note  = models.TextField(blank=True)

    class Meta:
        ordering = ['-date', 'shift']
        unique_together = [('date', 'shift')]  # satu shift cuma boleh 1 laporan/hari

    def __str__(self):
        return f'{self.date} Shift {self.shift}'


class DailyUsageEntry(models.Model):
    """Satu baris: material apa dan berapa banyak dipakai pada laporan itu.

    PENTING: setiap kali baris ini dibuat, signal di production/signals.py
    OTOMATIS mengurangi Material.stock sebesar qty (lihat file signals.py
    untuk penjelasan lengkap alur pengurangan stok + validasi anti-minus).
    """
    daily_usage = models.ForeignKey(DailyUsage, on_delete=models.CASCADE, related_name='entries')
    material    = models.ForeignKey(Material, on_delete=models.PROTECT, related_name='daily_usage_entries')
    qty         = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        ordering = ['daily_usage', 'material']
        unique_together = [('daily_usage', 'material')]

    def __str__(self):
        return f'{self.daily_usage} — {self.material.kode} x{self.qty}'


# ── Material Shipment (Gudang → Produksi) ────────────────────────────────────
# Ini bagian "Kirim Material" di halaman Izin Produksi (gudang) dan "Material"
# (produksi, untuk konfirmasi terima). Boleh dikirim bertahap/beberapa kali
# untuk satu order yang sama.

class MaterialShipment(models.Model):
    """Pengiriman material dari gudang ke lantai produksi (bisa per hari)."""
    order        = models.ForeignKey(ProductionOrder, on_delete=models.CASCADE, related_name='material_shipments')
    date         = models.DateField()
    note         = models.TextField(blank=True)
    confirmed    = models.BooleanField(default=False)        # sudah dikonfirmasi diterima produksi?
    confirmed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['order', 'date']

    def __str__(self):
        return f'{self.order.number} — Kirim Material {self.date}'


class MaterialShipmentEntry(models.Model):
    """Satu baris: material apa dan berapa banyak dalam satu pengiriman."""
    shipment = models.ForeignKey(MaterialShipment, on_delete=models.CASCADE, related_name='entries')
    material = models.ForeignKey(Material, on_delete=models.PROTECT)
    qty      = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        unique_together = [('shipment', 'material')]  # 1 material cuma 1 baris per pengiriman


# ── Tyre Delivery (Produksi → Gudang) ────────────────────────────────────────
# Kebalikan dari MaterialShipment: ban jadi dikirim BALIK dari lantai produksi
# ke gudang. Ini juga boleh bertahap ("Kirim Hasil" bisa dilakukan berkali-kali
# sampai qty_actual totalnya menyamai qty_plan di ProductionOrderItem).

class TyreDelivery(models.Model):
    """Pengiriman hasil tyre dari lantai produksi ke gudang (bisa per hari)."""
    order = models.ForeignKey(ProductionOrder, on_delete=models.CASCADE, related_name='tyre_deliveries')
    date  = models.DateField()
    note  = models.TextField(blank=True)

    class Meta:
        ordering = ['order', 'date']

    def __str__(self):
        return f'{self.order.number} — Kirim Hasil {self.date}'


class TyreDeliveryEntry(models.Model):
    """Satu baris: ban jenis apa dan berapa banyak dalam satu pengiriman hasil."""
    delivery   = models.ForeignKey(TyreDelivery, on_delete=models.CASCADE, related_name='entries')
    tyre_spec  = models.ForeignKey(TyreSpec, on_delete=models.PROTECT)
    qty_actual = models.PositiveIntegerField()

    class Meta:
        unique_together = [('delivery', 'tyre_spec')]


# ── Stock Reservation (Lock) ──────────────────────────────────────────────────
# Supaya 2 izin produksi yang aktif bersamaan tidak "berebut" material yang
# sama secara silang, stok yang dibutuhkan sebuah order langsung "dikunci"
# begitu order di-confirm(). Baris ini dihapus lagi begitu material yang
# dikunci sudah benar-benar dikirim (lihat production/views.py: shipments()),
# atau saat order selesai/dihapus (dibersihkan di action `done` / `perform_destroy`).

class StockReservation(models.Model):
    """Stok gudang yang dikunci untuk izin produksi yang sudah dikonfirmasi."""
    order        = models.ForeignKey(ProductionOrder, on_delete=models.CASCADE, related_name='stock_reservations')
    material     = models.ForeignKey(Material, on_delete=models.PROTECT, related_name='stock_reservations')
    qty_reserved = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        unique_together = [('order', 'material')]

    def __str__(self):
        return f'{self.order.number} — lock {self.material.kode} x{self.qty_reserved}'
