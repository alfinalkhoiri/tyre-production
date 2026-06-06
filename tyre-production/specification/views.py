from django.db.models import F
from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema, extend_schema_view, OpenApiParameter
from drf_spectacular.types import OpenApiTypes
from accounts.permissions import SpecificationWritePermission
from .models import Material, TyreSpec, BOMItem
from .serializers import (
    MaterialSerializer, TyreSpecSerializer, TyreSpecListSerializer, BOMItemSerializer
)


@extend_schema_view(
    list=extend_schema(
        summary='List semua material',
        description='Mendukung filter `unit`, pencarian `kode`/`name`, dan ordering.',
        tags=['Specification'],
    ),
    retrieve=extend_schema(summary='Detail material', tags=['Specification']),
    create=extend_schema(summary='Tambah material baru', tags=['Specification']),
    update=extend_schema(summary='Update material (full)', tags=['Specification']),
    partial_update=extend_schema(summary='Update material (partial)', tags=['Specification']),
    destroy=extend_schema(summary='Hapus material', tags=['Specification']),
)
class MaterialViewSet(viewsets.ModelViewSet):
    queryset = Material.objects.all()
    serializer_class = MaterialSerializer
    permission_classes = [SpecificationWritePermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['unit']
    search_fields = ['kode', 'name']
    ordering_fields = ['kode', 'name', 'stock']
    ordering = ['kode']

    @extend_schema(
        summary='Material dengan stok di bawah safety stock',
        description='Mengembalikan semua material yang `stock <= safety_stock`.',
        tags=['Specification'],
        responses=MaterialSerializer(many=True),
    )
    @action(detail=False, methods=['get'], url_path='low-stock')
    def low_stock(self, request):
        qs = Material.objects.filter(stock__lte=F('safety_stock'))
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)


@extend_schema_view(
    list=extend_schema(
        summary='List tyre specification',
        description='Mengembalikan list ringkas (tanpa BOM). Filter: `size`, `is_custom`.',
        tags=['Specification'],
        responses=TyreSpecListSerializer(many=True),
    ),
    retrieve=extend_schema(
        summary='Detail tyre spec + BOM items',
        tags=['Specification'],
        responses=TyreSpecSerializer,
    ),
    create=extend_schema(summary='Tambah tyre spec baru', tags=['Specification']),
    update=extend_schema(summary='Update tyre spec (full)', tags=['Specification']),
    partial_update=extend_schema(summary='Update tyre spec (partial)', tags=['Specification']),
    destroy=extend_schema(summary='Hapus tyre spec', tags=['Specification']),
)
class TyreSpecViewSet(viewsets.ModelViewSet):
    queryset = TyreSpec.objects.prefetch_related('bom_items__material')
    permission_classes = [SpecificationWritePermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['size', 'is_custom']
    search_fields = ['size', 'model', 'variant']
    ordering_fields = ['size', 'model']
    ordering = ['size', 'model']

    def get_serializer_class(self):
        return TyreSpecSerializer


@extend_schema_view(
    list=extend_schema(
        summary='List BOM items',
        description='Filter berdasarkan `tyre_spec` atau `material`.',
        tags=['Specification'],
    ),
    retrieve=extend_schema(summary='Detail BOM item', tags=['Specification']),
    create=extend_schema(summary='Tambah BOM item', tags=['Specification']),
    update=extend_schema(summary='Update BOM item (full)', tags=['Specification']),
    partial_update=extend_schema(summary='Update BOM item (partial)', tags=['Specification']),
    destroy=extend_schema(summary='Hapus BOM item', tags=['Specification']),
)
class BOMItemViewSet(viewsets.ModelViewSet):
    queryset = BOMItem.objects.select_related('tyre_spec', 'material')
    serializer_class = BOMItemSerializer
    permission_classes = [SpecificationWritePermission]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['tyre_spec', 'material']
