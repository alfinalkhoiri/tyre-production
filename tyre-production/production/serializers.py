from django.db import transaction
from django.db.models import F
from rest_framework import serializers
from .models import (
    ProductionOrder, ProductionOrderItem,
    DailyUsage, DailyUsageEntry,
    MaterialShipment, MaterialShipmentEntry,
    TyreDelivery, TyreDeliveryEntry,
)
from specification.serializers import TyreSpecSerializer, MaterialSerializer

# Serializer di Django REST Framework = "penerjemah" antara objek Python/model
# database <-> JSON yang dikirim/diterima lewat API. Setiap model penting di
# sini biasanya punya SEPASANG serializer:
#   - "...Serializer"       -> dipakai saat MEMBACA data (GET), boleh sertakan
#                              field turunan/nested detail untuk ditampilkan.
#   - "...WriteSerializer"  -> dipakai saat MENULIS data (POST/PUT), lebih
#                              ketat (cuma field yang boleh diisi user), dan
#                              berisi logika `create()`/`update()` custom kalau
#                              perlu simpan beberapa tabel sekaligus (header +
#                              baris detail dalam satu request).


class ProductionOrderItemSerializer(serializers.ModelSerializer):
    # `tyre_spec_detail` = field tambahan yang tidak ada di model, isinya hasil
    # serialize objek TyreSpec terkait secara lengkap — supaya frontend tidak
    # perlu request terpisah untuk tahu ukuran/model ban dari sekadar ID.
    tyre_spec_detail = TyreSpecSerializer(source='tyre_spec', read_only=True)

    class Meta:
        model = ProductionOrderItem
        fields = ('id', 'tyre_spec', 'tyre_spec_detail', 'qty_plan')


class ProductionOrderSerializer(serializers.ModelSerializer):
    items          = ProductionOrderItemSerializer(many=True, read_only=True)
    # get_status_display() adalah method bawaan Django untuk field `choices`:
    # otomatis mengubah 'DRAFT' (value tersimpan) jadi 'Draft' (label rapi).
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    shift_display  = serializers.CharField(source='get_shift_display',  read_only=True)

    class Meta:
        model = ProductionOrder
        fields = ('id', 'number', 'date', 'shift', 'shift_display',
                  'pic', 'status', 'status_display', 'items')


# ── Daily Usage (Pemakaian Harian) ────────────────────────────────────────────

class DailyUsageEntrySerializer(serializers.ModelSerializer):
    material_detail = MaterialSerializer(source='material', read_only=True)

    class Meta:
        model = DailyUsageEntry
        fields = ('id', 'material', 'material_detail', 'qty')


class DailyUsageSerializer(serializers.ModelSerializer):
    # entries di-nest di sini: satu response DailyUsage langsung membawa semua
    # baris pemakaiannya sekaligus, tidak perlu request terpisah per entry.
    entries      = DailyUsageEntrySerializer(many=True, read_only=True)
    shift_display = serializers.CharField(source='get_shift_display', read_only=True)
    order_number  = serializers.CharField(source='order.number', read_only=True)

    class Meta:
        model = DailyUsage
        fields = ('id', 'date', 'shift', 'shift_display', 'order', 'order_number', 'note', 'entries')


class DailyUsageWriteSerializer(serializers.ModelSerializer):
    entries = DailyUsageEntrySerializer(many=True)

    class Meta:
        model = DailyUsage
        fields = ('id', 'date', 'shift', 'order', 'note', 'entries')

    def create(self, validated_data):
        # DRF secara default tidak tahu cara menyimpan field nested (`entries`)
        # otomatis — makanya create() di-override manual: pisahkan dulu data
        # entries dari data header, simpan header-nya, baru loop simpan tiap
        # entry satu-satu sambil ditautkan ke header yang baru dibuat.
        entries_data = validated_data.pop('entries')
        # transaction.atomic() = semua query di dalam blok ini dianggap SATU
        # unit: kalau salah satu entry gagal disimpan (mis. gara-gara sinyal
        # anti-stok-minus di signals.py melempar error), SEMUA yang sudah
        # sempat tersimpan di blok ini ikut dibatalkan (rollback) — supaya
        # tidak ada laporan pemakaian yang "setengah tersimpan".
        with transaction.atomic():
            daily_usage = DailyUsage.objects.create(**validated_data)
            for entry in entries_data:
                # Setiap .create() di sini memicu signal post_save di
                # production/signals.py yang otomatis memotong stok material.
                DailyUsageEntry.objects.create(daily_usage=daily_usage, **entry)
        return daily_usage

    def update(self, instance, validated_data):
        entries_data = validated_data.pop('entries', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if entries_data is not None:
            from specification.models import Material
            with transaction.atomic():
                # Kembalikan dulu stok dari entries lama sebelum dihapus, supaya
                # edit (bukan hanya create) tidak memotong stok gudang dua kali.
                # (Signal di signals.py cuma memotong stok saat entry BARU
                # dibuat — jadi kalau entry lama langsung dihapus lalu entry
                # baru dibuat, stok akan terpotong 2x untuk pemakaian yang
                # sama kalau baris di bawah ini tidak ada.)
                for old_entry in instance.entries.all():
                    Material.objects.filter(pk=old_entry.material_id).update(
                        stock=F('stock') + old_entry.qty
                    )
                instance.entries.all().delete()
                for entry in entries_data:
                    DailyUsageEntry.objects.create(daily_usage=instance, **entry)
        return instance


# ── Material Shipment (Gudang → Produksi) ─────────────────────────────────────

class MaterialShipmentEntrySerializer(serializers.ModelSerializer):
    material_detail = MaterialSerializer(source='material', read_only=True)

    class Meta:
        model = MaterialShipmentEntry
        fields = ('id', 'material', 'material_detail', 'qty')


class MaterialShipmentSerializer(serializers.ModelSerializer):
    entries = MaterialShipmentEntrySerializer(many=True, read_only=True)
    order_number = serializers.CharField(source='order.number', read_only=True)

    class Meta:
        model = MaterialShipment
        fields = ('id', 'order', 'order_number', 'date', 'note', 'confirmed', 'confirmed_at', 'entries')


class MaterialShipmentWriteSerializer(serializers.ModelSerializer):
    entries = MaterialShipmentEntrySerializer(many=True)

    class Meta:
        model = MaterialShipment
        # `order` sengaja TIDAK ada di sini — order-nya di-set dari luar
        # (lihat production/views.py, action `shipments`: `ser.save(order=order)`)
        # karena order-nya sudah pasti dari URL (/orders/<id>/shipments/),
        # bukan dari body request.
        fields = ('date', 'note', 'entries')

    def create(self, validated_data):
        # Catatan: create() di sini HANYA menyimpan data pengiriman & baris-
        # barisnya. Logika memotong stok gudang & melepas StockReservation
        # sengaja TIDAK ditaruh di sini — itu terjadi di production/views.py
        # (action `shipments`) supaya bisa divalidasi dulu (cek stok cukup)
        # SEBELUM data ini disimpan, dalam satu transaction yang sama.
        entries_data = validated_data.pop('entries')
        shipment = MaterialShipment.objects.create(**validated_data)
        for e in entries_data:
            MaterialShipmentEntry.objects.create(shipment=shipment, **e)
        return shipment


# ── Tyre Delivery (Produksi → Gudang) ─────────────────────────────────────────

class TyreDeliveryEntrySerializer(serializers.ModelSerializer):
    tyre_spec_detail = TyreSpecSerializer(source='tyre_spec', read_only=True)

    class Meta:
        model = TyreDeliveryEntry
        fields = ('id', 'tyre_spec', 'tyre_spec_detail', 'qty_actual')


class TyreDeliverySerializer(serializers.ModelSerializer):
    entries = TyreDeliveryEntrySerializer(many=True, read_only=True)

    class Meta:
        model = TyreDelivery
        fields = ('id', 'order', 'date', 'note', 'entries')


class TyreDeliveryWriteSerializer(serializers.ModelSerializer):
    entries = TyreDeliveryEntrySerializer(many=True)

    class Meta:
        model = TyreDelivery
        fields = ('date', 'note', 'entries')  # `order` juga di-set dari URL, sama seperti MaterialShipment

    def create(self, validated_data):
        entries_data = validated_data.pop('entries')
        delivery = TyreDelivery.objects.create(**validated_data)
        for e in entries_data:
            TyreDeliveryEntry.objects.create(delivery=delivery, **e)
        return delivery
