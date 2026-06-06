from django.contrib import admin
from .models import StockTransaction


@admin.register(StockTransaction)
class StockTransactionAdmin(admin.ModelAdmin):
    list_display = ('date', 'material', 'type', 'qty', 'stock_before', 'stock_after', 'reference')
    list_filter = ('type', 'date', 'material')
    search_fields = ('material__kode', 'material__name', 'reference')
    ordering = ('-date', '-id')
    readonly_fields = ('stock_before', 'stock_after')
