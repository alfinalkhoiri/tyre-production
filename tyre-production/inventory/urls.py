from rest_framework.routers import DefaultRouter
from .views import StockTransactionViewSet

router = DefaultRouter()
router.register('transactions', StockTransactionViewSet, basename='stocktransaction')

urlpatterns = router.urls
