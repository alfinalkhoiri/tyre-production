from django.db.models import F
from django.utils import timezone
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema, extend_schema_view, OpenApiParameter
from drf_spectacular.types import OpenApiTypes
from accounts.audit import log
from accounts.models import AuditLog
from accounts.permissions import (
    ProductionOrderWritePermission,
    DailyUsageWritePermission,
    IsAdminOrManager,
    IsAdminOrManagerOrOperator,
)
from .models import (
    ProductionOrder, ProductionOrderItem,
    DailyUsage, DailyUsageEntry,
    MaterialShipment, TyreDelivery,
)
from .serializers import (
    ProductionOrderSerializer,
    ProductionOrderItemSerializer,
    DailyUsageSerializer, DailyUsageWriteSerializer,
    DailyUsageEntrySerializer,
    MaterialShipmentSerializer, MaterialShipmentWriteSerializer,
    TyreDeliverySerializer, TyreDeliveryWriteSerializer,
)
from .utils import aggregate_requirements


class ProductionOrderViewSet(viewsets.ModelViewSet):
    queryset = ProductionOrder.objects.prefetch_related(
        'items__tyre_spec__bom_items__material'
    )
    serializer_class = ProductionOrderSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'shift', 'date']
    search_fields = ['number', 'pic']
    ordering_fields = ['date', 'number']
    ordering = ['-date', 'shift']

    # Read-only actions accessible to all authenticated users
    _read_actions = {
        'list', 'retrieve', 'requirements', 'prod_stock',
        'pending_shipments', 'pending_counts', 'safety_suggestions',
        'progress', 'order_yield',
    }

    def get_permissions(self):
        if self.action in self._read_actions:
            return [IsAuthenticated()]
        if self.action in ('shipments', 'receive_material'):
            # GET is open; POST checked inside the action
            return [IsAuthenticated()]
        if self.action in ('deliveries',):
            # GET is open; POST checked inside the action
            return [IsAuthenticated()]
        # create/update/partial_update/destroy/confirm/start/done
        return [IsAdminOrManager()]

    def create(self, request, *args, **kwargs):
        ser = self.get_serializer(data=request.data)
        ser.is_valid(raise_exception=True)
        order = ser.save()
        for item in request.data.get('items', []):
            tyre_spec_id = item.get('tyre_spec')
            qty_plan = item.get('qty_plan')
            if tyre_spec_id and qty_plan:
                ProductionOrderItem.objects.create(
                    order=order, tyre_spec_id=tyre_spec_id, qty_plan=qty_plan
                )
        order.refresh_from_db()
        return Response(self.get_serializer(order).data, status=status.HTTP_201_CREATED)

    # ── Status transitions ────────────────────────────────────────────────────

    @action(detail=True, methods=['post'], url_path='confirm')
    def confirm(self, request, pk=None):
        order = self.get_object()
        if order.status != ProductionOrder.STATUS_DRAFT:
            return Response({'detail': 'Hanya order DRAFT yang bisa dikonfirmasi.'}, status=400)

        items = order.items.prefetch_related('tyre_spec__bom_items__material').all()
        reqs = aggregate_requirements(items)
        shortages = [
            {
                'kode': r['kode'], 'name': r['name'], 'unit': r['unit'],
                'required': r['qty_needed'],
                'available': r['stock'],
                'shortage': abs(r['shortage']),
            }
            for r in reqs if r['is_short']
        ]

        if shortages:
            return Response(
                {'detail': 'Stok material tidak mencukupi.', 'shortages': shortages},
                status=status.HTTP_400_BAD_REQUEST
            )

        order.status = ProductionOrder.STATUS_CONFIRMED
        order.save()
        log(request.user, AuditLog.ACTION_STATUS, 'ProductionOrder', order.pk,
            order.number, request=request, detail={'status': 'CONFIRMED'})
        return Response(ProductionOrderSerializer(order).data)

    @action(detail=True, methods=['get'], url_path='requirements')
    def requirements(self, request, pk=None):
        order = self.get_object()
        items = order.items.prefetch_related('tyre_spec__bom_items__material').all()
        reqs = aggregate_requirements(items)
        return Response({'requirements': reqs})

    @action(detail=True, methods=['post'], url_path='start')
    def start(self, request, pk=None):
        order = self.get_object()
        if order.status not in [ProductionOrder.STATUS_CONFIRMED, ProductionOrder.STATUS_MAT_SENT]:
            return Response({'detail': 'Order harus CONFIRMED atau MAT_SENT sebelum dimulai.'}, status=400)
        order.status = ProductionOrder.STATUS_IN_PROGRESS
        order.save()
        log(request.user, AuditLog.ACTION_STATUS, 'ProductionOrder', order.pk,
            order.number, request=request, detail={'status': 'IN_PROGRESS'})
        return Response(ProductionOrderSerializer(order).data)

    @action(detail=True, methods=['post'], url_path='done')
    def done(self, request, pk=None):
        order = self.get_object()
        if order.status not in [ProductionOrder.STATUS_IN_PROGRESS, ProductionOrder.STATUS_RESULT_SENT]:
            return Response({'detail': 'Order harus IN_PROGRESS atau RESULT_SENT sebelum diselesaikan.'}, status=400)
        order.status = ProductionOrder.STATUS_DONE
        order.save()
        log(request.user, AuditLog.ACTION_STATUS, 'ProductionOrder', order.pk,
            order.number, request=request, detail={'status': 'DONE'})
        return Response(ProductionOrderSerializer(order).data)

    # ── Material Shipments ────────────────────────────────────────────────────

    @action(detail=True, methods=['get', 'post'], url_path='shipments')
    def shipments(self, request, pk=None):
        order = self.get_object()

        if request.method == 'GET':
            qs = order.material_shipments.prefetch_related('entries__material').order_by('date')
            return Response(MaterialShipmentSerializer(qs, many=True).data)

        # POST — hanya admin, manager, atau inventory
        from accounts.permissions import get_role
        if get_role(request.user) not in ('admin', 'manager'):
            return Response({'detail': 'Tidak punya izin untuk mengirim material.'}, status=status.HTTP_403_FORBIDDEN)

        if order.status not in [ProductionOrder.STATUS_CONFIRMED, ProductionOrder.STATUS_MAT_SENT]:
            return Response({'detail': 'Order harus CONFIRMED atau MAT_SENT untuk mengirim material.'}, status=400)

        ser = MaterialShipmentWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        shipment = ser.save(order=order)

        # Deduct warehouse stock for each entry
        from specification.models import Material as MatModel
        for e in shipment.entries.all():
            MatModel.objects.filter(pk=e.material_id).update(stock=F('stock') - e.qty)

        order.refresh_from_db()
        return Response({
            'shipment': MaterialShipmentSerializer(shipment).data,
            'order_status': order.status,
        }, status=201)

    @action(detail=True, methods=['post'], url_path='receive-material')
    def receive_material(self, request, pk=None):
        from accounts.permissions import get_role
        if get_role(request.user) not in ('admin', 'manager', 'operator'):
            return Response({'detail': 'Tidak punya izin untuk konfirmasi penerimaan material.'}, status=status.HTTP_403_FORBIDDEN)

        order = self.get_object()
        shipment_id = request.data.get('shipment_id')
        if not shipment_id:
            return Response({'detail': 'shipment_id diperlukan.'}, status=400)
        try:
            shipment = order.material_shipments.get(pk=shipment_id)
        except MaterialShipment.DoesNotExist:
            return Response({'detail': 'Shipment tidak ditemukan.'}, status=404)
        if shipment.confirmed:
            return Response({'detail': 'Sudah dikonfirmasi.'}, status=400)

        shipment.confirmed = True
        shipment.confirmed_at = timezone.now()
        shipment.save()

        self._check_material_completion(order)
        order.refresh_from_db()

        # Auto-start: jika semua material sudah diterima, langsung mulai produksi
        if order.status == ProductionOrder.STATUS_MAT_SENT:
            order.status = ProductionOrder.STATUS_IN_PROGRESS
            order.save()
            order.refresh_from_db()

        return Response({
            'order_status': order.status,
            'shipment': MaterialShipmentSerializer(shipment).data,
        })

    def _check_material_completion(self, order):
        items = order.items.prefetch_related('tyre_spec__bom_items__material').all()
        required = {r['material_id']: r['qty_needed'] for r in aggregate_requirements(items)}

        # Only count CONFIRMED (received) shipments
        received: dict = {}
        for s in order.material_shipments.filter(confirmed=True).prefetch_related('entries').all():
            for e in s.entries.all():
                received[e.material_id] = received.get(e.material_id, 0) + float(e.qty)

        if required and all(received.get(mid, 0) >= qty for mid, qty in required.items()):
            if order.status == ProductionOrder.STATUS_CONFIRMED:
                order.status = ProductionOrder.STATUS_MAT_SENT
                order.save()

    # ── Tyre Deliveries ───────────────────────────────────────────────────────

    @action(detail=True, methods=['get', 'post'], url_path='deliveries')
    def deliveries(self, request, pk=None):
        order = self.get_object()

        if request.method == 'GET':
            qs = order.tyre_deliveries.prefetch_related('entries__tyre_spec').order_by('date')
            return Response(TyreDeliverySerializer(qs, many=True).data)

        # POST — hanya admin, manager, atau operator
        from accounts.permissions import get_role
        if get_role(request.user) not in ('admin', 'manager', 'operator'):
            return Response({'detail': 'Tidak punya izin untuk mengirim hasil produksi.'}, status=status.HTTP_403_FORBIDDEN)

        if order.status not in [ProductionOrder.STATUS_IN_PROGRESS, ProductionOrder.STATUS_RESULT_SENT]:
            return Response({'detail': 'Order harus IN_PROGRESS untuk mengirim hasil.'}, status=400)

        ser = TyreDeliveryWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        delivery = ser.save(order=order)

        self._check_delivery_completion(order)
        order.refresh_from_db()
        return Response({
            'delivery': TyreDeliverySerializer(delivery).data,
            'order_status': order.status,
        }, status=201)

    def _check_delivery_completion(self, order):
        planned: dict = {item.tyre_spec_id: item.qty_plan for item in order.items.all()}
        delivered: dict = {}
        for d in order.tyre_deliveries.prefetch_related('entries').all():
            for e in d.entries.all():
                delivered[e.tyre_spec_id] = delivered.get(e.tyre_spec_id, 0) + e.qty_actual

        if planned and all(delivered.get(sid, 0) >= qty for sid, qty in planned.items()):
            if order.status == ProductionOrder.STATUS_IN_PROGRESS:
                order.status = ProductionOrder.STATUS_RESULT_SENT
                order.save()

    # ── Production stock summary ──────────────────────────────────────────────

    @action(detail=False, methods=['get'], url_path='prod-stock')
    def prod_stock(self, request):
        from .models import MaterialShipmentEntry, DailyUsageEntry
        from django.db.models import Sum
        from specification.models import Material as MatModel

        received_map = {
            r['material']: float(r['total'])
            for r in MaterialShipmentEntry.objects
                .filter(shipment__confirmed=True)
                .values('material').annotate(total=Sum('qty'))
        }
        used_map = {
            r['material']: float(r['total'])
            for r in DailyUsageEntry.objects.values('material').annotate(total=Sum('qty'))
        }

        result = [
            {
                'material_id': m.id, 'kode': m.kode, 'name': m.name, 'unit': m.unit,
                'received': received_map.get(m.id, 0),
                'used': used_map.get(m.id, 0),
                'balance': round(received_map.get(m.id, 0) - used_map.get(m.id, 0), 2),
            }
            for m in MatModel.objects.all()
        ]
        return Response(result)

    @action(detail=False, methods=['get'], url_path='pending-shipments')
    def pending_shipments(self, request):
        from .models import MaterialShipment as ShipmentModel
        qs = (
            ShipmentModel.objects
            .filter(confirmed=False)
            .prefetch_related('entries__material')
            .select_related('order')
            .order_by('-date')
        )
        return Response(MaterialShipmentSerializer(qs, many=True).data)

    @action(detail=False, methods=['get'], url_path='pending-counts')
    def pending_counts(self, request):
        from .models import MaterialShipment as ShipmentModel
        return Response({
            'pending_shipments': ShipmentModel.objects.filter(confirmed=False).count(),
            'result_sent': ProductionOrder.objects.filter(status=ProductionOrder.STATUS_RESULT_SENT).count(),
        })

    @action(detail=True, methods=['get'], url_path='yield')
    def order_yield(self, request, pk=None):
        import math
        from django.db.models import Sum
        from .models import DailyUsageEntry

        order = self.get_object()

        # Actual tyres delivered per tyre_spec
        actual_delivered = {}
        for d in order.tyre_deliveries.prefetch_related('entries').all():
            for e in d.entries.all():
                actual_delivered[e.tyre_spec_id] = actual_delivered.get(e.tyre_spec_id, 0) + e.qty_actual

        # BOM-expected usage based on actual delivered (fallback to planned)
        bom_expected = {}
        for item in order.items.prefetch_related('tyre_spec__bom_items__material').all():
            qty = actual_delivered.get(item.tyre_spec_id, item.qty_plan)
            for bom in item.tyre_spec.bom_items.select_related('material').all():
                mat = bom.material
                mid = mat.id
                if mat.roll_length and bom.unit == 'm':
                    exp_qty = math.ceil(float(bom.qty) * qty / float(mat.roll_length))
                    unit = 'ROLL'
                else:
                    exp_qty = float(bom.qty) * qty
                    unit = mat.unit
                if mid not in bom_expected:
                    bom_expected[mid] = {'kode': mat.kode, 'name': mat.name, 'unit': unit, 'expected': 0}
                bom_expected[mid]['expected'] += exp_qty

        # Actual usage linked to this order via DailyUsage.order FK
        actual_usage = {
            r['material']: float(r['total'])
            for r in DailyUsageEntry.objects
                .filter(daily_usage__order=order)
                .values('material')
                .annotate(total=Sum('qty'))
        }

        rows = []
        for mid, exp in bom_expected.items():
            actual = actual_usage.get(mid, 0)
            expected = round(exp['expected'], 2)
            waste = round(actual - expected, 2)
            yield_pct = round((expected / actual * 100) if actual > 0 else 0.0, 1)
            rows.append({
                'material_id': mid,
                'kode': exp['kode'],
                'name': exp['name'],
                'unit': exp['unit'],
                'expected': expected,
                'actual': round(actual, 2),
                'waste': waste,
                'yield_pct': yield_pct,
                'has_data': actual > 0,
            })

        rows.sort(key=lambda r: (-r['waste'], r['kode']))

        total_planned = sum(item.qty_plan for item in order.items.all())
        total_delivered = int(sum(actual_delivered.values()))
        delivery_rate = round((total_delivered / total_planned * 100) if total_planned > 0 else 0.0, 1)

        rows_with_data = [r for r in rows if r['has_data']]
        if rows_with_data:
            overall_yield = round(
                sum(r['expected'] for r in rows_with_data) /
                sum(r['actual'] for r in rows_with_data) * 100, 1
            )
        else:
            overall_yield = 0.0

        return Response({
            'order_id': order.id,
            'order_number': order.number,
            'total_planned': total_planned,
            'total_delivered': total_delivered,
            'delivery_rate': delivery_rate,
            'overall_yield': overall_yield,
            'has_usage_data': bool(rows_with_data),
            'materials': rows,
        })

    @action(detail=False, methods=['get'], url_path='safety-suggestions')
    def safety_suggestions(self, request):
        import math
        from datetime import date, timedelta
        from django.db.models import Sum
        from .models import DailyUsageEntry
        from specification.models import Material as MatModel

        days = int(request.query_params.get('days', 30))
        lead_time = int(request.query_params.get('lead_time', 7))
        z_score = 1.65  # 95% service level

        cutoff = date.today() - timedelta(days=days)

        entries = (
            DailyUsageEntry.objects
            .filter(daily_usage__date__gte=cutoff)
            .values('material', 'daily_usage__date')
            .annotate(day_qty=Sum('qty'))
        )

        usage_by_mat = {}
        for e in entries:
            mid = e['material']
            if mid not in usage_by_mat:
                usage_by_mat[mid] = []
            usage_by_mat[mid].append(float(e['day_qty']))

        results = []
        for mat in MatModel.objects.all():
            daily_qtys = usage_by_mat.get(mat.id, [])
            if daily_qtys:
                # avg over full period (incl. zero-usage days)
                avg = sum(daily_qtys) / days
                mean_active = sum(daily_qtys) / len(daily_qtys)
                variance = sum((q - mean_active) ** 2 for q in daily_qtys) / len(daily_qtys)
                std = math.sqrt(variance)
            else:
                avg = 0.0
                std = 0.0

            suggested = math.ceil(avg * lead_time + z_score * std * math.sqrt(lead_time))
            results.append({
                'material_id': mat.id,
                'kode': mat.kode,
                'name': mat.name,
                'unit': mat.unit,
                'category': mat.category,
                'current_safety_stock': float(mat.safety_stock),
                'avg_daily': round(avg, 2),
                'std_daily': round(std, 2),
                'suggested_safety_stock': max(suggested, 0),
                'has_data': bool(daily_qtys),
                'diff': round(max(suggested, 0) - float(mat.safety_stock), 2),
            })

        results.sort(key=lambda r: (-abs(r['diff']), r['kode']))

        return Response({
            'days_analyzed': days,
            'lead_time_days': lead_time,
            'service_level': '95%',
            'suggestions': results,
        })

    # ── Progress summary ──────────────────────────────────────────────────────

    @action(detail=True, methods=['get'], url_path='progress')
    def progress(self, request, pk=None):
        order = self.get_object()

        # Material progress — units in ROLL or PCE (same as requirements)
        items_qs = order.items.prefetch_related('tyre_spec__bom_items__material').all()
        reqs_map = {r['material_id']: r for r in aggregate_requirements(items_qs)}

        shipped: dict = {}
        received: dict = {}
        for s in order.material_shipments.prefetch_related('entries').all():
            for e in s.entries.all():
                shipped[e.material_id] = shipped.get(e.material_id, 0) + float(e.qty)
                if s.confirmed:
                    received[e.material_id] = received.get(e.material_id, 0) + float(e.qty)

        mat_progress = [
            {
                'kode': r['kode'], 'name': r['name'], 'unit': r['unit'],
                'required': r['qty_needed'],
                'shipped': round(shipped.get(mid, 0), 2),
                'received': round(received.get(mid, 0), 2),
            }
            for mid, r in reqs_map.items()
        ]

        # Tyre delivery progress
        planned = {item.tyre_spec_id: {'size': item.tyre_spec.size, 'model': item.tyre_spec.model,
                                        'variant': item.tyre_spec.variant, 'planned': item.qty_plan, 'delivered': 0}
                   for item in order.items.select_related('tyre_spec').all()}

        for d in order.tyre_deliveries.prefetch_related('entries').all():
            for e in d.entries.all():
                if e.tyre_spec_id in planned:
                    planned[e.tyre_spec_id]['delivered'] += e.qty_actual

        return Response({
            'material_progress': mat_progress,
            'tyre_progress': list(planned.values()),
        })


class ProductionOrderItemViewSet(viewsets.ModelViewSet):
    queryset = ProductionOrderItem.objects.select_related('order', 'tyre_spec')
    serializer_class = ProductionOrderItemSerializer
    permission_classes = [ProductionOrderWritePermission]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['order', 'tyre_spec']


class DailyUsageViewSet(viewsets.ModelViewSet):
    queryset = DailyUsage.objects.prefetch_related('entries__material').select_related('order')
    permission_classes = [DailyUsageWritePermission]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['date', 'shift', 'order']
    ordering_fields = ['date', 'shift']
    ordering = ['-date', 'shift']

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return DailyUsageWriteSerializer
        return DailyUsageSerializer

    @action(detail=False, methods=['get'], url_path='range')
    def date_range(self, request):
        date_from = request.query_params.get('from')
        date_to   = request.query_params.get('to')
        qs = self.get_queryset()
        if date_from:
            qs = qs.filter(date__gte=date_from)
        if date_to:
            qs = qs.filter(date__lte=date_to)
        return Response(DailyUsageSerializer(qs, many=True).data)


class DailyUsageEntryViewSet(viewsets.ModelViewSet):
    queryset = DailyUsageEntry.objects.select_related('daily_usage', 'material')
    serializer_class = DailyUsageEntrySerializer
    permission_classes = [DailyUsageWritePermission]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['daily_usage', 'material']
