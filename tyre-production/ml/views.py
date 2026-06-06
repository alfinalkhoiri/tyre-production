from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema, OpenApiParameter
from drf_spectacular.types import OpenApiTypes

from specification.models import Material
from .data import load_usage_dataframe
from .model import predict_future, get_training_meta, load_model
from .serializers import ForecastRequestSerializer, ForecastItemSerializer, TrainingMetricsSerializer


@extend_schema(
    summary='Forecast pemakaian material untuk N hari ke depan',
    description=(
        'Model RandomForest per-material dilatih dari DailyUsageEntry historis. '
        'Kembalikan prediksi qty per hari per shift beserta 95% confidence interval. '
        'Jalankan `python manage.py train_forecast` sebelum memanggil endpoint ini.'
    ),
    tags=['ML Forecast'],
    request=ForecastRequestSerializer,
    responses={
        200: {
            'type': 'object',
            'properties': {
                'material_id':   {'type': 'integer'},
                'material_kode': {'type': 'string'},
                'forecast_days': {'type': 'integer'},
                'predictions':   {'type': 'array', 'items': {'type': 'object'}},
            },
        },
        400: OpenApiTypes.OBJECT,
        404: OpenApiTypes.OBJECT,
    },
)
class ForecastView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        ser = ForecastRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        material_id   = ser.validated_data['material_id']
        forecast_days = ser.validated_data['forecast_days']

        try:
            material = Material.objects.get(pk=material_id)
        except Material.DoesNotExist:
            return Response({'detail': 'Material tidak ditemukan.'}, status=status.HTTP_404_NOT_FOUND)

        if load_model(material_id) is None:
            return Response(
                {'detail': f'Model untuk material {material.kode} belum dilatih. '
                           f'Jalankan: python manage.py train_forecast'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        df = load_usage_dataframe()
        history = df[df['material_id'] == material_id] if not df.empty else df

        predictions = predict_future(material_id, history, forecast_days)

        return Response({
            'material_id':   material_id,
            'material_kode': material.kode,
            'material_name': material.name,
            'unit':          material.unit,
            'forecast_days': forecast_days,
            'predictions':   predictions,
        })


@extend_schema(
    summary='Status model yang sudah dilatih & metrik evaluasi',
    description='Mengembalikan informasi model terakhir yang dilatih per material.',
    tags=['ML Forecast'],
    responses={200: {'type': 'object'}},
)
class ModelStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        meta = get_training_meta()
        if not meta:
            return Response({
                'status': 'belum ada model',
                'detail': 'Jalankan: python manage.py train_forecast',
            })

        return Response({
            'trained_materials': meta.get('trained_materials', []),
            'feature_cols':      meta.get('feature_cols', []),
            'metrics':           meta.get('results', {}),
        })
