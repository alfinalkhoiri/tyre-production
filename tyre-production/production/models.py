from django.db import models
from specification.models import TyreSpec, Material


class ProductionOrder(models.Model):
    STATUS_DRAFT        = 'DRAFT'
    STATUS_CONFIRMED    = 'CONFIRMED'
    STATUS_MAT_SENT     = 'MAT_SENT'
    STATUS_IN_PROGRESS  = 'IN_PROGRESS'
    STATUS_RESULT_SENT  = 'RESULT_SENT'
    STATUS_DONE         = 'DONE'
    STATUS_CHOICES = [
        ('DRAFT',        'Draft'),
        ('CONFIRMED',    'Dikonfirmasi'),
        ('MAT_SENT',     'Material Dikirim'),
        ('IN_PROGRESS',  'Sedang Diproduksi'),
        ('RESULT_SENT',  'Hasil Dikirim'),
        ('DONE',         'Selesai'),
    ]

    SHIFT_1 = '1'
    SHIFT_2 = '2'
    SHIFT_3 = '3'
    SHIFT_CHOICES = [
        ('1', 'Shift 1'),
        ('2', 'Shift 2'),
        ('3', 'Shift 3'),
    ]

    number = models.CharField(max_length=50, unique=True)
    date   = models.DateField()
    shift  = models.CharField(max_length=1, choices=SHIFT_CHOICES)
    pic    = models.CharField(max_length=100)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_DRAFT)

    class Meta:
        ordering = ['-date', 'shift']
        verbose_name = 'Production Order'
        verbose_name_plural = 'Production Orders'

    def __str__(self):
        return f'{self.number} — {self.date} Shift {self.shift}'


class ProductionOrderItem(models.Model):
    order      = models.ForeignKey(ProductionOrder, on_delete=models.CASCADE, related_name='items')
    tyre_spec  = models.ForeignKey(TyreSpec, on_delete=models.PROTECT, related_name='order_items')
    qty_plan   = models.PositiveIntegerField()

    class Meta:
        ordering = ['order', 'tyre_spec']
        unique_together = [('order', 'tyre_spec')]

    def __str__(self):
        return f'{self.order.number} — {self.tyre_spec} x{self.qty_plan}'


class DailyUsage(models.Model):
    SHIFT_CHOICES = [('1', 'Shift 1'), ('2', 'Shift 2'), ('3', 'Shift 3')]

    date  = models.DateField()
    shift = models.CharField(max_length=1, choices=SHIFT_CHOICES)
    order = models.ForeignKey(
        ProductionOrder, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='daily_usages'
    )
    note  = models.TextField(blank=True)

    class Meta:
        ordering = ['-date', 'shift']
        unique_together = [('date', 'shift')]

    def __str__(self):
        return f'{self.date} Shift {self.shift}'


class DailyUsageEntry(models.Model):
    daily_usage = models.ForeignKey(DailyUsage, on_delete=models.CASCADE, related_name='entries')
    material    = models.ForeignKey(Material, on_delete=models.PROTECT, related_name='daily_usage_entries')
    qty         = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        ordering = ['daily_usage', 'material']
        unique_together = [('daily_usage', 'material')]

    def __str__(self):
        return f'{self.daily_usage} — {self.material.kode} x{self.qty}'


# ── Material Shipment (Gudang → Produksi) ────────────────────────────────────

class MaterialShipment(models.Model):
    """Pengiriman material dari gudang ke lantai produksi (bisa per hari)."""
    order        = models.ForeignKey(ProductionOrder, on_delete=models.CASCADE, related_name='material_shipments')
    date         = models.DateField()
    note         = models.TextField(blank=True)
    confirmed    = models.BooleanField(default=False)
    confirmed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['order', 'date']

    def __str__(self):
        return f'{self.order.number} — Kirim Material {self.date}'


class MaterialShipmentEntry(models.Model):
    shipment = models.ForeignKey(MaterialShipment, on_delete=models.CASCADE, related_name='entries')
    material = models.ForeignKey(Material, on_delete=models.PROTECT)
    qty      = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        unique_together = [('shipment', 'material')]


# ── Tyre Delivery (Produksi → Gudang) ────────────────────────────────────────

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
    delivery   = models.ForeignKey(TyreDelivery, on_delete=models.CASCADE, related_name='entries')
    tyre_spec  = models.ForeignKey(TyreSpec, on_delete=models.PROTECT)
    qty_actual = models.PositiveIntegerField()

    class Meta:
        unique_together = [('delivery', 'tyre_spec')]
