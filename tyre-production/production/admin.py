from django.contrib import admin
from .models import ProductionOrder, ProductionOrderItem, DailyUsage, DailyUsageEntry


class ProductionOrderItemInline(admin.TabularInline):
    model = ProductionOrderItem
    extra = 1
    fields = ('tyre_spec', 'qty_plan')


class DailyUsageEntryInline(admin.TabularInline):
    model = DailyUsageEntry
    extra = 1
    fields = ('material', 'qty')


@admin.register(ProductionOrder)
class ProductionOrderAdmin(admin.ModelAdmin):
    list_display = ('number', 'date', 'shift', 'pic', 'status')
    list_filter = ('status', 'shift', 'date')
    search_fields = ('number', 'pic')
    ordering = ('-date', 'shift')
    inlines = [ProductionOrderItemInline]


@admin.register(ProductionOrderItem)
class ProductionOrderItemAdmin(admin.ModelAdmin):
    list_display = ('order', 'tyre_spec', 'qty_plan')
    list_filter = ('tyre_spec__size',)
    search_fields = ('order__number', 'tyre_spec__model')


@admin.register(DailyUsage)
class DailyUsageAdmin(admin.ModelAdmin):
    list_display = ('date', 'shift', 'order', 'note')
    list_filter = ('shift', 'date')
    search_fields = ('order__number', 'note')
    ordering = ('-date', 'shift')
    inlines = [DailyUsageEntryInline]


@admin.register(DailyUsageEntry)
class DailyUsageEntryAdmin(admin.ModelAdmin):
    list_display = ('daily_usage', 'material', 'qty')
    search_fields = ('material__kode', 'daily_usage__order__number')
