from django.urls import path
from .views import ForecastView, ModelStatusView

urlpatterns = [
    path('forecast/',      ForecastView.as_view(),     name='ml-forecast'),
    path('model-status/',  ModelStatusView.as_view(),  name='ml-model-status'),
]
