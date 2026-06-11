from django.urls import path
from .views import ForecastView, MaterialForecastView

urlpatterns = [
    path('forecast/',                    ForecastView.as_view(),         name='ml-forecast'),
    path('forecast/<int:material_id>/',  MaterialForecastView.as_view(), name='ml-forecast-detail'),
]
