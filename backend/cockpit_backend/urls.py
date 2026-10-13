"""
URL configuration for cockpit_backend.
Rotas sob /api/v1/ com OpenAPI e Swagger.
"""

from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView

def api_health(request):
    """Health check seguro para proxies reversos e monitoramento de conectividade."""
    from django.db import connection
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        return JsonResponse({"status": "healthy"})
    except Exception:
        return JsonResponse({"status": "unhealthy"}, status=503)

urlpatterns = [
    path("admin/", admin.site.urls),
    
    # Health check
    path("api/v1/health/", api_health, name="api-health"),
    
    # OpenAPI Schema & Docs
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
    
    # Apps API v1
    path("api/v1/core/", include("apps.core.urls")),
    path("api/v1/pivots/", include("apps.pivots.urls")),
    path("api/v1/operations/", include("apps.operations.urls")),
    path("api/v1/sync/", include("apps.sync.urls")),
]
