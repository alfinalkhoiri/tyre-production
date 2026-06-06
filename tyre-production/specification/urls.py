from rest_framework.routers import DefaultRouter
from .views import MaterialViewSet, TyreSpecViewSet, BOMItemViewSet

router = DefaultRouter()
router.register('materials', MaterialViewSet, basename='material')
router.register('tyre-specs', TyreSpecViewSet, basename='tyrespec')
router.register('bom-items', BOMItemViewSet, basename='bomitem')

urlpatterns = router.urls
