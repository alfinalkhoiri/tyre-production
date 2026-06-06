from rest_framework import serializers
from .models import (
    ProductionOrder, ProductionOrderItem,
    DailyUsage, DailyUsageEntry,
    MaterialShipment, MaterialShipmentEntry,
    TyreDelivery, TyreDeliveryEntry,
)
from specification.serializers import TyreSpecSerializer, MaterialSerializer


class ProductionOrderItemSerializer(serializers.ModelSerializer):
    tyre_spec_detail = TyreSpecSerializer(source='tyre_spec', read_only=True)

    class Meta:
        model = ProductionOrderItem
        fields = ('id', 'tyre_spec', 'tyre_spec_detail', 'qty_plan')


class ProductionOrderSerializer(serializers.ModelSerializer):
    items          = ProductionOrderItemSerializer(many=True, read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    shift_display  = serializers.CharField(source='get_shift_display',  read_only=True)

    class Meta:
        model = ProductionOrder
        fields = ('id', 'number', 'date', 'shift', 'shift_display',
                  'pic', 'status', 'status_display', 'items')


# ── Daily Usage ───────────────────────────────────────────────────────────────

class DailyUsageEntrySerializer(serializers.ModelSerializer):
    material_detail = MaterialSerializer(source='material', read_only=True)

    class Meta:
        model = DailyUsageEntry
        fields = ('id', 'material', 'material_detail', 'qty')


class DailyUsageSerializer(serializers.ModelSerializer):
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
        entries_data = validated_data.pop('entries')
        daily_usage = DailyUsage.objects.create(**validated_data)
        for entry in entries_data:
            DailyUsageEntry.objects.create(daily_usage=daily_usage, **entry)
        return daily_usage

    def update(self, instance, validated_data):
        entries_data = validated_data.pop('entries', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if entries_data is not None:
            instance.entries.all().delete()
            for entry in entries_data:
                DailyUsageEntry.objects.create(daily_usage=instance, **entry)
        return instance


# ── Material Shipment ─────────────────────────────────────────────────────────

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
        fields = ('date', 'note', 'entries')

    def create(self, validated_data):
        entries_data = validated_data.pop('entries')
        shipment = MaterialShipment.objects.create(**validated_data)
        for e in entries_data:
            MaterialShipmentEntry.objects.create(shipment=shipment, **e)
        return shipment


# ── Tyre Delivery ─────────────────────────────────────────────────────────────

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
        fields = ('date', 'note', 'entries')

    def create(self, validated_data):
        entries_data = validated_data.pop('entries')
        delivery = TyreDelivery.objects.create(**validated_data)
        for e in entries_data:
            TyreDeliveryEntry.objects.create(delivery=delivery, **e)
        return delivery
