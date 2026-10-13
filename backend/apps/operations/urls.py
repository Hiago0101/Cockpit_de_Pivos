from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CulturaViewSet,
    SafraViewSet,
    PlanoOperacionalViewSet,
    RegistroIrrigacaoViewSet,
    AlertaViewSet,
    JanelaOportunidadeViewSet,
    cockpit_resumo,
)

router = DefaultRouter()
router.register("culturas", CulturaViewSet, basename="cultura")
router.register("safras", SafraViewSet, basename="safra")
router.register("planos", PlanoOperacionalViewSet, basename="plano")
router.register("irrigacoes", RegistroIrrigacaoViewSet, basename="irrigacao")
router.register("alertas", AlertaViewSet, basename="alerta")
router.register("janelas", JanelaOportunidadeViewSet, basename="janela")

urlpatterns = [
    path("cockpit-resumo/", cockpit_resumo, name="cockpit-resumo"),
    path("", include(router.urls)),
]
