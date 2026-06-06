from django.db import models
from specification.models import Material


class StockTransaction(models.Model):
    TYPE_IN = 'IN'
    TYPE_AUTO = 'AUTO'
    TRANSACTION_TYPE_CHOICES = [
        (TYPE_IN, 'Penerimaan'),
        (TYPE_AUTO, 'Pemakaian Otomatis'),
    ]

    material = models.ForeignKey(
        Material, on_delete=models.PROTECT, related_name='transactions'
    )
    type = models.CharField(max_length=10, choices=TRANSACTION_TYPE_CHOICES)
    qty = models.DecimalField(max_digits=12, decimal_places=2)
    stock_before = models.DecimalField(max_digits=12, decimal_places=2)
    stock_after = models.DecimalField(max_digits=12, decimal_places=2)
    reference = models.CharField(max_length=100, blank=True)
    date = models.DateField()

    class Meta:
        ordering = ['-date', '-id']
        verbose_name = 'Stock Transaction'
        verbose_name_plural = 'Stock Transactions'

    def __str__(self):
        return f'{self.date} | {self.get_type_display()} | {self.material.kode} | {self.qty}'
