from rest_framework import serializers
from .models import Material, TyreSpec, BOMItem


class MaterialSerializer(serializers.ModelSerializer):
    locked_qty = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True, default=0)

    class Meta:
        model = Material
        fields = ('id', 'kode', 'name', 'category', 'unit', 'roll_length',
                  'stock', 'safety_stock', 'locked_qty', 'is_active')


class BOMItemSerializer(serializers.ModelSerializer):
    material_detail = MaterialSerializer(source='material', read_only=True)
    tyre_per_roll = serializers.FloatField(read_only=True, allow_null=True)
    roll_per_100_tyre = serializers.FloatField(read_only=True, allow_null=True)

    class Meta:
        model = BOMItem
        fields = ('id', 'material', 'material_detail', 'qty', 'unit',
                  'tyre_per_roll', 'roll_per_100_tyre')


class TyreSpecSerializer(serializers.ModelSerializer):
    bom_items = BOMItemSerializer(many=True, read_only=True)

    class Meta:
        model = TyreSpec
        fields = ('id', 'size', 'model', 'variant', 'is_custom', 'is_active', 'bom_items')


class TyreSpecListSerializer(serializers.ModelSerializer):
    """Serializer ringkas untuk list view (tanpa bom_items)."""
    class Meta:
        model = TyreSpec
        fields = ('id', 'size', 'model', 'variant', 'is_custom', 'is_active')
