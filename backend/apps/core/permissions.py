"""
Controle de Acesso Baseado em Papéis (RBAC) para o Cockpit de Pivôs.
Permissões seguras por padrão: nenhum dado agrícola privado é acessível anonimamente.
"""

from rest_framework import permissions

class IsAuthenticatedAndStaff(permissions.BasePermission):
    """Exige autenticação obrigatória para leitura e escrita."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

class IsAdminUserOnly(permissions.BasePermission):
    """Apenas Administradores do Sistema têm acesso a administração de contas e usuários."""
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.is_superuser or request.user.is_staff:
            return True
        profile = getattr(request.user, "profile", None)
        return bool(profile and profile.role == "ADMIN")

class IsAdminOrManager(permissions.BasePermission):
    """Apenas Administradores ou Gestores Agrícolas podem cadastrar/alterar infraestrutura."""
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.is_superuser or request.user.is_staff:
            return True
        profile = getattr(request.user, "profile", None)
        return bool(profile and profile.role in ["ADMIN", "GESTOR"])

class IsFieldOperatorOrAbove(permissions.BasePermission):
    """Operadores de campo, Gestores e Admins podem enviar comandos e apontamentos."""
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.is_superuser or request.user.is_staff:
            return True
        profile = getattr(request.user, "profile", None)
        return bool(profile and profile.role in ["ADMIN", "GESTOR", "OPERADOR"])
