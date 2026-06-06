from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import (
    ProductionOrderViewSet, ProductionOrderItemViewSet,
    DailyUsageViewSet, DailyUsageEntryViewSet,
)
from .analytics import (
    MaterialUsageSummaryView, DailyTrendView,
    ShiftSummaryView, ExportCSVView, ExportJSONView,
)

router = DefaultRouter()
router.register('orders', ProductionOrderViewSet, basename='productionorder')
router.register('order-items', ProductionOrderItemViewSet, basename='productionorderitem')
router.register('daily-usages', DailyUsageViewSet, basename='dailyusage')
router.register('daily-usage-entries', DailyUsageEntryViewSet, basename='dailyusageentry')

urlpatterns = router.urls + [
    path('analytics/material-usage/', MaterialUsageSummaryView.as_view(), name='analytics-material-usage'),
    path('analytics/daily-trend/',    DailyTrendView.as_view(),           name='analytics-daily-trend'),
    path('analytics/shift-summary/',  ShiftSummaryView.as_view(),         name='analytics-shift-summary'),
    path('analytics/export/csv/',     ExportCSVView.as_view(),            name='analytics-export-csv'),
    path('analytics/export/json/',    ExportJSONView.as_view(),           name='analytics-export-json'),
]
