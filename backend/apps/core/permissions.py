"""
Controle de Acesso Baseado em Papéis (RBAC) e Grupos de Permissões Granulares para o Cockpit de Pivôs.
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
        if profile and profile.grupo and profile.grupo.is_admin_padrao:
            return True
        return bool(profile and profile.role == "ADMIN")

class IsAdminOrManager(permissions.BasePermission):
    """Administradores ou Gestores Agrícolas podem gerenciar infraestrutura operacional."""
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.is_superuser or request.user.is_staff:
            return True
        profile = getattr(request.user, "profile", None)
        if profile and profile.grupo:
            if profile.grupo.is_admin_padrao:
                return True
            # Verifica se possui permissão de inclusão ou alteração no módulo correspondente
            modulo_target = getattr(view, "permission_module", None)
            if modulo_target:
                p = profile.grupo.permissoes.filter(modulo=modulo_target).first()
                if p and (p.pode_incluir or p.pode_alterar):
                    return True
        return bool(profile and profile.role in ["ADMIN", "GESTOR"])

class IsFieldOperatorOrAbove(permissions.BasePermission):
    """Operadores de campo, Gestores e Admins podem enviar comandos e apontamentos."""
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.is_superuser or request.user.is_staff:
            return True
        profile = getattr(request.user, "profile", None)
        if profile and profile.grupo and profile.grupo.is_admin_padrao:
            return True
        return bool(profile and profile.role in ["ADMIN", "GESTOR", "OPERADOR"])

def check_user_module_permission(user, modulo_slug: str, acao: str = "acessar_tela") -> bool:
    """Função utilitária para checar permissão granular do usuário em um módulo específico."""
    if not (user and user.is_authenticated):
        return False
    if user.is_superuser or user.is_staff:
        return True
    profile = getattr(user, "profile", None)
    if not profile or not profile.ativo:
        return False
    if profile.grupo and profile.grupo.is_admin_padrao:
        return True
    if not profile.grupo or not profile.grupo.ativo:
        return False

    perm = profile.grupo.permissoes.filter(modulo=modulo_slug).first()
    if not perm:
        return False

    field_map = {
        "acessar_tela": perm.pode_acessar_tela,
        "visualizar_completo": perm.pode_visualizar_completo,
        "incluir": perm.pode_incluir,
        "alterar": perm.pode_alterar,
        "excluir": perm.pode_excluir,
    }
    return bool(field_map.get(acao, False))
