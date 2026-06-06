from django.contrib import admin
from .models import Material, TyreSpec, BOMItem


class BOMItemInline(admin.TabularInline):
    model = BOMItem
    extra = 1
    fields = ('material', 'qty', 'unit')


@admin.register(Material)
class MaterialAdmin(admin.ModelAdmin):
    list_display = ('kode', 'name', 'unit', 'roll_length', 'stock', 'safety_stock')
    list_filter = ('unit',)
    search_fields = ('kode', 'name')
    ordering = ('kode',)


@admin.register(TyreSpec)
class TyreSpecAdmin(admin.ModelAdmin):
    list_display = ('size', 'model', 'variant', 'is_custom')
    list_filter = ('is_custom', 'size')
    search_fields = ('size', 'model', 'variant')
    inlines = [BOMItemInline]


@admin.register(BOMItem)
class BOMItemAdmin(admin.ModelAdmin):
    list_display = ('tyre_spec', 'material', 'qty', 'unit', 'tyre_per_roll', 'roll_per_100_tyre')
    list_filter = ('tyre_spec__size',)
    search_fields = ('tyre_spec__model', 'material__kode')
