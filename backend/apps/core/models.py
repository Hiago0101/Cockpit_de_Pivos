import uuid
from django.db import models
from django.contrib.auth.models import User

class UserRole(models.TextChoices):
    ADMIN = "ADMIN", "Administrador do Sistema"
    GESTOR = "GESTOR", "Gestor Agrícola"
    OPERADOR = "OPERADOR", "Operador de Campo"
    CONSULTOR = "CONSULTOR", "Auditor / Consulta"

class ModuloSistema(models.TextChoices):
    COCKPIT = "cockpit", "Cockpit / Dashboard"
    PLANEJAMENTO = "planejamento", "Planejamento de Safras"
    SAFRAS = "safras", "Cadastro de Safras"
    FAZENDAS = "fazendas", "Cadastro de Fazendas"
    TALHOES = "talhoes", "Cadastro de Talhões"
    CULTURAS = "culturas", "Catálogo de Culturas"
    IRRIGACAO = "irrigacao", "Operação de Irrigação / Pivôs"
    JANELAS = "janelas", "Janelas de Oportunidade"
    CALENDARIO = "calendario", "Calendário Agrícola"
    MAPA = "mapa", "Mapa de Pivôs"
    OPERACOES = "operacoes", "Histórico de Operações"
    ALERTAS = "alertas", "Central de Alertas"
    INDICADORES = "indicadores", "Indicadores & KPIs"
    USUARIOS_GRUPOS = "usuarios_grupos", "Usuários e Permissões"
    SISTEMA = "sistema", "Status do Sistema"

class GrupoPermissao(models.Model):
    """Grupo de permissões para controle de acesso granular (RBAC) no Cockpit de Pivôs."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    nome = models.CharField(max_length=100, unique=True, verbose_name="Nome do Grupo")
    descricao = models.TextField(blank=True, default="", verbose_name="Descrição")
    is_admin_padrao = models.BooleanField(
        default=False,
        verbose_name="Administrador Padrão",
        help_text="Possui acesso irrestrito a todos os módulos e ações do sistema."
    )
    ativo = models.BooleanField(default=True, verbose_name="Ativo")
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["nome"]
        verbose_name = "Grupo de Permissões"
        verbose_name_plural = "Grupos de Permissões"

    def __str__(self):
        return self.nome

class PermissaoModulo(models.Model):
    """Regras de permissão granular por tela e cadastro para um grupo."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    grupo = models.ForeignKey(
        GrupoPermissao,
        on_delete=models.CASCADE,
        related_name="permissoes",
        verbose_name="Grupo de Permissão"
    )
    modulo = models.CharField(
        max_length=50,
        choices=ModuloSistema.choices,
        verbose_name="Módulo / Tela"
    )
    pode_acessar_tela = models.BooleanField(default=True, verbose_name="Acessar Tela")
    pode_visualizar_completo = models.BooleanField(default=True, verbose_name="Visualizar Completo")
    pode_incluir = models.BooleanField(default=False, verbose_name="Pode Incluir")
    pode_alterar = models.BooleanField(default=False, verbose_name="Pode Alterar")
    pode_excluir = models.BooleanField(default=False, verbose_name="Pode Excluir")

    class Meta:
        unique_together = ("grupo", "modulo")
        verbose_name = "Permissão de Módulo"
        verbose_name_plural = "Permissões de Módulos"

    def __str__(self):
        return f"{self.grupo.nome} -> {self.get_modulo_display()}"

class UserProfile(models.Model):
    """Extensão do perfil de usuário corporativo integrado ao Microsoft 365 / Azure AD."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    grupo = models.ForeignKey(
        GrupoPermissao,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="usuarios",
        verbose_name="Grupo de Permissões"
    )
    role = models.CharField(max_length=20, choices=UserRole.choices, default=UserRole.OPERADOR)
    ad_oid = models.CharField(max_length=64, blank=True, default="", verbose_name="Azure AD OID")
    ad_upn = models.CharField(max_length=255, blank=True, default="", verbose_name="Azure UserPrincipalName")
    cargo = models.CharField(max_length=150, blank=True, default="", verbose_name="Cargo")
    empresa_nome = models.CharField(max_length=150, blank=True, default="Grupo Farroupilha", verbose_name="Empresa")
    telefone = models.CharField(max_length=30, blank=True, default="")
    departamento = models.CharField(max_length=100, blank=True, default="Operações Agrícolas")
    fazendas = models.ManyToManyField("pivots.Fazenda", blank=True, related_name="usuarios_autorizados")
    ativo = models.BooleanField(default=True)
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    def __str__(self):
        grupo_nome = self.grupo.nome if self.grupo else self.get_role_display()
        return f"{self.user.username} ({grupo_nome})"

class AuditLog(models.Model):
    """Trilha de auditoria para operações críticas em fazendas e pivôs centrais."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tabela = models.CharField(max_length=100, db_index=True)
    entidade_id = models.CharField(max_length=64, db_index=True)
    acao = models.CharField(max_length=20)  # CREATE, UPDATE, DELETE, SYNC
    detalhes = models.JSONField(default=dict, blank=True)
    usuario = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="audit_logs")
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    criado_em = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-criado_em"]
        verbose_name = "Registro de Auditoria"
        verbose_name_plural = "Registros de Auditoria"

    def __str__(self):
        return f"[{self.criado_em}] {self.acao} em {self.tabela} ({self.entidade_id})"
