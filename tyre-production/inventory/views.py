from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db import transaction
from drf_spectacular.utils import extend_schema, extend_schema_view, OpenApiParameter
from drf_spectacular.types import OpenApiTypes
from accounts.audit import log
from accounts.models import AuditLog
from accounts.permissions import InventoryWritePermission
from .models import StockTransaction
from .serializers import StockTransactionSerializer
from specification.models import Material


@extend_schema_view(
    list=extend_schema(
        summary='List transaksi stok',
        description='Filter: `type` (IN/AUTO), `material`, `date`. Terurut terbaru lebih dulu.',
        tags=['Inventory'],
    ),
    retrieve=extend_schema(summary='Detail transaksi', tags=['Inventory']),
    create=extend_schema(
        summary='Catat transaksi stok',
        description=(
            '`stock_before` dan `stock_after` dihitung otomatis dari stok material saat ini. '
            'Tipe `IN` menambah stok, `AUTO` mengurangi stok.'
        ),
        tags=['Inventory'],
    ),
    update=extend_schema(summary='Update transaksi (full)', tags=['Inventory']),
    partial_update=extend_schema(summary='Update transaksi (partial)', tags=['Inventory']),
    destroy=extend_schema(summary='Hapus transaksi', tags=['Inventory']),
)
class StockTransactionViewSet(viewsets.ModelViewSet):
    queryset = StockTransaction.objects.select_related('material')
    serializer_class = StockTransactionSerializer
    permission_classes = [InventoryWritePermission]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['type', 'material', 'date']
    search_fields = ['material__kode', 'material__name', 'reference']
    ordering_fields = ['date', 'material__kode']
    ordering = ['-date', '-id']

    @transaction.atomic
    def perform_create(self, serializer):
        material = serializer.validated_data['material']
        qty = serializer.validated_data['qty']
        tx_type = serializer.validated_data['type']

        stock_before = material.stock
        if tx_type == StockTransaction.TYPE_IN:
            stock_after = stock_before + qty
        else:
            stock_after = stock_before - qty

        instance = serializer.save(stock_before=stock_before, stock_after=stock_after)
        Material.objects.filter(pk=material.pk).update(stock=stock_after)
        log(self.request.user, AuditLog.ACTION_CREATE, 'StockTransaction', instance.pk,
            f'{tx_type} {material.kode} qty={qty}', request=self.request,
            detail={'type': tx_type, 'material': material.kode, 'qty': float(qty),
                    'stock_before': float(stock_before), 'stock_after': float(stock_after)})

    @extend_schema(
        summary='Riwayat transaksi per material',
        tags=['Inventory'],
        parameters=[
            OpenApiParameter('material_id', OpenApiTypes.INT, OpenApiParameter.PATH,
                             description='ID material'),
        ],
        responses=StockTransactionSerializer(many=True),
    )
    @action(detail=False, methods=['get'], url_path='by-material/(?P<material_id>[^/.]+)')
    def by_material(self, request, material_id=None):
        qs = self.get_queryset().filter(material_id=material_id)
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)
