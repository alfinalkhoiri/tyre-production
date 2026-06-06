from django.db import models


class Material(models.Model):
    name = models.CharField(max_length=200)
    kode = models.CharField(max_length=50, unique=True)
    category = models.CharField(max_length=100, default='Umum')
    unit = models.CharField(max_length=20)
    roll_length = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    stock = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    safety_stock = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    class Meta:
        ordering = ['kode']
        verbose_name = 'Material'
        verbose_name_plural = 'Materials'

    def __str__(self):
        return f'[{self.kode}] {self.name}'


class TyreSpec(models.Model):
    size = models.CharField(max_length=50)
    model = models.CharField(max_length=100)
    variant = models.CharField(max_length=100, blank=True)
    is_custom = models.BooleanField(default=False)

    class Meta:
        ordering = ['size', 'model']
        verbose_name = 'Tyre Specification'
        verbose_name_plural = 'Tyre Specifications'
        unique_together = [('size', 'model', 'variant')]

    def __str__(self):
        parts = [self.size, self.model]
        if self.variant:
            parts.append(self.variant)
        return ' - '.join(parts)


class BOMItem(models.Model):
    tyre_spec = models.ForeignKey(
        TyreSpec, on_delete=models.CASCADE, related_name='bom_items'
    )
    material = models.ForeignKey(
        Material, on_delete=models.PROTECT, related_name='bom_items'
    )
    qty = models.DecimalField(max_digits=10, decimal_places=4)
    unit = models.CharField(max_length=20)

    class Meta:
        ordering = ['tyre_spec', 'material']
        verbose_name = 'BOM Item'
        verbose_name_plural = 'BOM Items'
        unique_together = [('tyre_spec', 'material')]

    def __str__(self):
        return f'{self.tyre_spec} — {self.material.kode} x{self.qty}'

    @property
    def tyre_per_roll(self):
        if not self.qty or self.qty == 0 or not self.material.roll_length:
            return None
        return float(self.material.roll_length) / float(self.qty)

    @property
    def roll_per_100_tyre(self):
        tpr = self.tyre_per_roll
        if not tpr or tpr == 0:
            return None
        return 100 / tpr
