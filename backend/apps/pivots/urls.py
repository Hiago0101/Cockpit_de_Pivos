from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import EmpresaViewSet, FazendaViewSet, TalhaoViewSet, PivoViewSet

router = DefaultRouter()
router.register("empresas", EmpresaViewSet, basename="empresa")
router.register("fazendas", FazendaViewSet, basename="fazenda")
router.register("talhoes", TalhaoViewSet, basename="talhao")
router.register("pivos", PivoViewSet, basename="pivo")

urlpatterns = [
    path("", include(router.urls)),
]
