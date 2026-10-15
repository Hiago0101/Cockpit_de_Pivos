from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    LoginView,
    LogoutView,
    MeView,
    UserViewSet,
    AuditLogViewSet,
    GrupoPermissaoViewSet,
    AzureLoginView,
    AzureLookupUserView,
    AzureConfigStatusView,
)

router = DefaultRouter()
router.register("users", UserViewSet, basename="user")
router.register("grupos-permissao", GrupoPermissaoViewSet, basename="grupo-permissao")
router.register("audit-logs", AuditLogViewSet, basename="audit-log")

urlpatterns = [
    # Autenticação Microsoft 365 e Sessão
    path("auth/azure/", AzureLoginView.as_view(), name="auth-azure"),
    path("auth/login/", LoginView.as_view(), name="auth-login"),
    path("auth/logout/", LogoutView.as_view(), name="auth-logout"),
    path("auth/me/", MeView.as_view(), name="auth-me"),
    
    # Integração Microsoft Graph / Azure AD
    path("azure/lookup-user/", AzureLookupUserView.as_view(), name="azure-lookup-user"),
    path("azure/status/", AzureConfigStatusView.as_view(), name="azure-status"),
    
    # Recursos REST
    path("", include(router.urls)),
]
