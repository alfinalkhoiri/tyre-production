from decimal import Decimal
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.db import transaction
from rest_framework.exceptions import ValidationError
from .models import DailyUsageEntry
from inventory.models import StockTransaction
from specification.models import Material

# Signal Django = fungsi yang otomatis "nyala" setiap kali suatu event terjadi
# di ORM, tanpa perlu dipanggil manual dari views.py. Di sini: SETIAP KALI ada
# baris DailyUsageEntry baru dibuat (operator input pemakaian harian), fungsi
# di bawah ini otomatis jalan untuk memotong stok gudang material tersebut.
#
# Kenapa pakai signal, bukan langsung ditulis di view/serializer?
# Supaya potongan stok terjadi konsisten dari mana pun DailyUsageEntry dibuat
# (lewat DailyUsageViewSet ATAU DailyUsageEntryViewSet), tidak perlu diulang
# logikanya di 2 tempat berbeda.


@receiver(post_save, sender=DailyUsageEntry)
def auto_create_stock_transaction(sender, instance, created, raw=False, **kwargs):
    # `created` True hanya saat INSERT baru (bukan update baris yang sudah ada) —
    # jadi meng-edit qty sebuah entry TIDAK memicu potongan stok lagi (mencegah
    # stok terpotong dobel). `raw` True saat data di-load dari fixture (loaddata),
    # bukan aksi user sungguhan — juga diabaikan.
    if not created or raw:
        return

    material = instance.material
    qty = Decimal(str(instance.qty))

    # select_for_update() mengunci baris Material ini sampai transaksi selesai,
    # supaya kalau ada 2 request barengan yang sama-sama mengurangi stok
    # material yang sama, mereka antre (tidak balapan baca nilai stok lama
    # yang sama-sama lalu jadi salah hitung — race condition).
    with transaction.atomic():
        mat = Material.objects.select_for_update().get(pk=material.pk)
        stock_before = mat.stock
        stock_after = stock_before - qty

        # Guard anti-stok-minus: kalau pemakaian yang diminta melebihi stok
        # yang benar-benar ada, tolak (raise error) alih-alih diam-diam
        # membiarkan stock jadi negatif di database.
        if stock_after < 0:
            raise ValidationError({
                'detail': f'Stok {mat.kode} tidak cukup (tersedia {stock_before}, diminta {qty}).'
            })

        # Catat jejak transaksinya (untuk riwayat/audit di halaman Stok Material,
        # tab "Riwayat") sebelum benar-benar mengubah angka stok.
        StockTransaction.objects.create(
            material=mat,
            type=StockTransaction.TYPE_AUTO,   # 'AUTO' = otomatis dari pemakaian, beda dari 'IN' (penerimaan manual)
            qty=qty,
            stock_before=stock_before,
            stock_after=stock_after,
            reference=f'DU-{instance.daily_usage_id}',   # DU = Daily Usage, biar gampang ditelusuri asalnya
            date=instance.daily_usage.date,
        )

        # Baru di sini angka stock Material benar-benar dikurangi.
        Material.objects.filter(pk=mat.pk).update(stock=stock_after)
