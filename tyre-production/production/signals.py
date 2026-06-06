from decimal import Decimal
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.db import transaction
from .models import DailyUsageEntry
from inventory.models import StockTransaction
from specification.models import Material


@receiver(post_save, sender=DailyUsageEntry)
def auto_create_stock_transaction(sender, instance, created, raw=False, **kwargs):
    if not created or raw:
        return

    material = instance.material
    qty = Decimal(str(instance.qty))

    with transaction.atomic():
        mat = Material.objects.select_for_update().get(pk=material.pk)
        stock_before = mat.stock
        stock_after = stock_before - qty

        StockTransaction.objects.create(
            material=mat,
            type=StockTransaction.TYPE_AUTO,
            qty=qty,
            stock_before=stock_before,
            stock_after=stock_after,
            reference=f'DU-{instance.daily_usage_id}',
            date=instance.daily_usage.date,
        )

        Material.objects.filter(pk=mat.pk).update(stock=stock_after)
