from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema, OpenApiParameter
from drf_spectacular.types import OpenApiTypes

from .forecast import estimate_all, estimate_material, DEFAULT_HORIZON


@extend_schema(
    summary='Estimasi kebutuhan semua material (ADC)',
    description=(
        'Mengembalikan estimasi kebutuhan seluruh material berdasarkan '
        'Average Daily Consumption (ADC) dari riwayat pemakaian harian. '
        'Murni aritmetika — bukan prediksi ML. '
        'Parameter opsional: ?horizon=N (hari, default 7).'
    ),
    tags=['Estimasi Kebutuhan'],
    parameters=[
        OpenApiParameter('horizon', OpenApiTypes.INT, description='Horizon proyeksi dalam hari (1-90, default 7)'),
    ],
    responses={200: OpenApiTypes.OBJECT},
)
class ForecastView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            horizon = int(request.query_params.get('horizon', DEFAULT_HORIZON))
            horizon = max(1, min(horizon, 90))
        except (ValueError, TypeError):
            horizon = DEFAULT_HORIZON

        estimates = estimate_all(horizon=horizon)
        perlu_pesan = [e for e in estimates if e['status'] == 'perlu_pesan']
        return Response({
            'horizon':      horizon,
            'total':        len(estimates),
            'perlu_pesan':  len(perlu_pesan),
            'estimates':    estimates,
        })


@extend_schema(
    summary='Estimasi kebutuhan per material',
    description='Kembalikan estimasi ADC untuk satu material.',
    tags=['Estimasi Kebutuhan'],
    parameters=[
        OpenApiParameter('horizon', OpenApiTypes.INT, description='Horizon proyeksi dalam hari (default 7)'),
    ],
    responses={200: OpenApiTypes.OBJECT, 404: OpenApiTypes.OBJECT},
)
class MaterialForecastView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, material_id):
        from django.db.models import Sum
        from production.models import DailyUsageEntry
        from specification.models import Material

        try:
            mat = Material.objects.get(pk=material_id)
        except Material.DoesNotExist:
            return Response({'detail': 'Material tidak ditemukan.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            horizon = int(request.query_params.get('horizon', DEFAULT_HORIZON))
            horizon = max(1, min(horizon, 90))
        except (ValueError, TypeError):
            horizon = DEFAULT_HORIZON

        rows = (
            DailyUsageEntry.objects
            .filter(material_id=material_id)
            .values('daily_usage__date')
            .annotate(day_qty=Sum('qty'))
            .order_by('daily_usage__date')
        )
        daily_series = [(r['daily_usage__date'], float(r['day_qty'])) for r in rows]

        return Response(estimate_material(mat, daily_series, horizon))
