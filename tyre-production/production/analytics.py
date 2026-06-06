import csv
import json
from datetime import date

from django.db.models import Sum, Avg, Count, F
from django.db.models.functions import TruncDate, TruncWeek, TruncMonth
from django.http import StreamingHttpResponse, HttpResponse
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema, OpenApiParameter
from drf_spectacular.types import OpenApiTypes

from specification.models import Material
from .models import DailyUsage, DailyUsageEntry

_DATE_PARAMS = [
    OpenApiParameter('from', OpenApiTypes.DATE, OpenApiParameter.QUERY,
                     description='Tanggal mulai (YYYY-MM-DD)', required=False),
    OpenApiParameter('to', OpenApiTypes.DATE, OpenApiParameter.QUERY,
                     description='Tanggal akhir (YYYY-MM-DD)', required=False),
]

_ANALYTICS_RESPONSE = {
    200: {
        'type': 'object',
        'properties': {
            'date_from': {'type': 'string', 'format': 'date'},
            'date_to':   {'type': 'string', 'format': 'date'},
            'results':   {'type': 'array', 'items': {'type': 'object'}},
        },
    }
}


def _parse_date(value, fallback):
    try:
        return date.fromisoformat(value)
    except (TypeError, ValueError):
        return fallback


@extend_schema(
    summary='Total pemakaian per material dalam rentang tanggal',
    tags=['Analytics'],
    parameters=_DATE_PARAMS + [
        OpenApiParameter('material_id', OpenApiTypes.INT, OpenApiParameter.QUERY,
                         description='Filter ke satu material', required=False),
    ],
    responses=_ANALYTICS_RESPONSE,
)
class MaterialUsageSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        date_from = _parse_date(request.query_params.get('from'), date(2000, 1, 1))
        date_to   = _parse_date(request.query_params.get('to'),   date.today())

        qs = DailyUsageEntry.objects.filter(
            daily_usage__date__gte=date_from,
            daily_usage__date__lte=date_to,
        )

        material_id = request.query_params.get('material_id')
        if material_id:
            qs = qs.filter(material_id=material_id)

        rows = (
            qs.values(
                'material__id',
                'material__kode',
                'material__name',
                'material__unit',
            )
            .annotate(
                total_qty=Sum('qty'),
                avg_qty_per_day=Avg('qty'),
                entry_count=Count('id'),
            )
            .order_by('material__kode')
        )

        return Response({
            'date_from': date_from,
            'date_to': date_to,
            'results': list(rows),
        })


@extend_schema(
    summary='Tren pemakaian per material (time-series untuk grafik & ML)',
    tags=['Analytics'],
    parameters=_DATE_PARAMS + [
        OpenApiParameter('group_by', OpenApiTypes.STR, OpenApiParameter.QUERY,
                         description='Granularitas: `day` (default), `week`, `month`',
                         enum=['day', 'week', 'month'], required=False),
        OpenApiParameter('material_id', OpenApiTypes.INT, OpenApiParameter.QUERY,
                         description='Filter ke satu material', required=False),
    ],
    responses={
        200: {
            'type': 'object',
            'properties': {
                'date_from': {'type': 'string', 'format': 'date'},
                'date_to':   {'type': 'string', 'format': 'date'},
                'group_by':  {'type': 'string'},
                'results':   {'type': 'array', 'items': {'type': 'object'}},
            },
        }
    },
)
class DailyTrendView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        date_from  = _parse_date(request.query_params.get('from'), date(2000, 1, 1))
        date_to    = _parse_date(request.query_params.get('to'),   date.today())
        group_by   = request.query_params.get('group_by', 'day')
        material_id = request.query_params.get('material_id')

        qs = DailyUsageEntry.objects.filter(
            daily_usage__date__gte=date_from,
            daily_usage__date__lte=date_to,
        )
        if material_id:
            qs = qs.filter(material_id=material_id)

        if group_by == 'day':
            # DateField → reference directly to avoid SQLite TruncDate timezone issue
            rows = (
                qs.annotate(period=F('daily_usage__date'))
                .values('period', 'material__kode', 'material__name', 'material__unit')
                .annotate(total_qty=Sum('qty'))
                .order_by('period', 'material__kode')
            )
        else:
            trunc_fn = TruncWeek if group_by == 'week' else TruncMonth
            rows = (
                qs.annotate(period=trunc_fn('daily_usage__date'))
                .values('period', 'material__kode', 'material__name', 'material__unit')
                .annotate(total_qty=Sum('qty'))
                .order_by('period', 'material__kode')
            )

        return Response({
            'date_from': date_from,
            'date_to': date_to,
            'group_by': group_by,
            'results': list(rows),
        })


@extend_schema(
    summary='Rata-rata dan total pemakaian dikelompokkan per shift',
    tags=['Analytics'],
    parameters=_DATE_PARAMS,
    responses=_ANALYTICS_RESPONSE,
)
class ShiftSummaryView(APIView):
    """
    Rata-rata dan total pemakaian per shift.
    GET /api/analytics/shift-summary/?from=YYYY-MM-DD&to=YYYY-MM-DD
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        date_from = _parse_date(request.query_params.get('from'), date(2000, 1, 1))
        date_to   = _parse_date(request.query_params.get('to'),   date.today())

        rows = (
            DailyUsageEntry.objects
            .filter(
                daily_usage__date__gte=date_from,
                daily_usage__date__lte=date_to,
            )
            .values(
                'daily_usage__shift',
                'material__kode',
                'material__name',
                'material__unit',
            )
            .annotate(
                total_qty=Sum('qty'),
                avg_qty=Avg('qty'),
                entry_count=Count('id'),
            )
            .order_by('daily_usage__shift', 'material__kode')
        )

        return Response({
            'date_from': date_from,
            'date_to': date_to,
            'results': list(rows),
        })


# ── Export helpers ─────────────────────────────────────────────────────────────

def _build_export_qs(params):
    date_from = _parse_date(params.get('from'), date(2000, 1, 1))
    date_to   = _parse_date(params.get('to'),   date.today())
    shift     = params.get('shift')
    material_id = params.get('material_id')

    qs = DailyUsageEntry.objects.select_related(
        'daily_usage', 'daily_usage__order', 'material'
    ).filter(
        daily_usage__date__gte=date_from,
        daily_usage__date__lte=date_to,
    )
    if shift:
        qs = qs.filter(daily_usage__shift=shift)
    if material_id:
        qs = qs.filter(material_id=material_id)

    return qs.order_by('daily_usage__date', 'daily_usage__shift', 'material__kode')


class _Echo:
    """Pseudo-buffer untuk StreamingHttpResponse."""
    def write(self, value):
        return value


_EXPORT_PARAMS = _DATE_PARAMS + [
    OpenApiParameter('shift', OpenApiTypes.STR, OpenApiParameter.QUERY,
                     description='Filter shift (1/2/3)', enum=['1', '2', '3'], required=False),
    OpenApiParameter('material_id', OpenApiTypes.INT, OpenApiParameter.QUERY,
                     description='Filter material', required=False),
]


@extend_schema(
    summary='Export DailyUsage ke CSV (streaming)',
    description='Kolom: `date`, `shift`, `order_number`, `material_kode`, `material_name`, `unit`, `qty`.',
    tags=['Analytics / Export'],
    parameters=_EXPORT_PARAMS,
    responses={(200, 'text/csv'): OpenApiTypes.BINARY},
)
class ExportCSVView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = _build_export_qs(request.query_params)

        header = ['date', 'shift', 'order_number', 'material_kode',
                  'material_name', 'unit', 'qty']

        def row_generator():
            writer = csv.writer(_Echo())
            yield writer.writerow(header)
            for entry in qs.iterator(chunk_size=500):
                yield writer.writerow([
                    entry.daily_usage.date,
                    entry.daily_usage.shift,
                    entry.daily_usage.order.number if entry.daily_usage.order else '',
                    entry.material.kode,
                    entry.material.name,
                    entry.material.unit,
                    entry.qty,
                ])

        response = StreamingHttpResponse(row_generator(), content_type='text/csv')
        filename = f'daily_usage_{date.today()}.csv'
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response


@extend_schema(
    summary='Export DailyUsage ke NDJSON (newline-delimited, untuk ML pipeline)',
    description='Satu JSON object per baris. Langsung bisa di-load dengan `pandas.read_json(..., lines=True)`.',
    tags=['Analytics / Export'],
    parameters=_EXPORT_PARAMS,
    responses={(200, 'application/x-ndjson'): OpenApiTypes.BINARY},
)
class ExportJSONView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = _build_export_qs(request.query_params)

        def row_generator():
            for entry in qs.iterator(chunk_size=500):
                yield json.dumps({
                    'date':          str(entry.daily_usage.date),
                    'shift':         entry.daily_usage.shift,
                    'order_number':  entry.daily_usage.order.number if entry.daily_usage.order else None,
                    'material_kode': entry.material.kode,
                    'material_name': entry.material.name,
                    'unit':          entry.material.unit,
                    'qty':           float(entry.qty),
                }, ensure_ascii=False) + '\n'

        response = StreamingHttpResponse(row_generator(), content_type='application/x-ndjson')
        filename = f'daily_usage_{date.today()}.ndjson'
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response
