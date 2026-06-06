from rest_framework import serializers
from .models import StockTransaction
from specification.serializers import MaterialSerializer


class StockTransactionSerializer(serializers.ModelSerializer):
    material_detail = MaterialSerializer(source='material', read_only=True)
    type_display = serializers.CharField(source='get_type_display', read_only=True)

    class Meta:
        model = StockTransaction
        fields = ('id', 'date', 'material', 'material_detail', 'type',
                  'type_display', 'qty', 'stock_before', 'stock_after', 'reference')
        read_only_fields = ('stock_before', 'stock_after')
