from rest_framework import serializers


class ForecastRequestSerializer(serializers.Serializer):
    material_id   = serializers.IntegerField(min_value=1)
    forecast_days = serializers.IntegerField(min_value=1, max_value=90, default=7)


class ForecastItemSerializer(serializers.Serializer):
    date          = serializers.DateField()
    shift         = serializers.IntegerField()
    predicted_qty = serializers.FloatField()
    lower_bound   = serializers.FloatField()
    upper_bound   = serializers.FloatField()


class TrainingMetricsSerializer(serializers.Serializer):
    material_id   = serializers.IntegerField()
    material_kode = serializers.CharField()
    n_samples     = serializers.IntegerField()
    mae_cv        = serializers.FloatField()
    mae_train     = serializers.FloatField()
    rmse_train    = serializers.FloatField()
    r2_train      = serializers.FloatField()
    feature_importance = serializers.DictField(child=serializers.FloatField())
