import uuid
from django.db import models
from django.contrib.auth.models import User

class UserRole(models.TextChoices):
    ADMIN = "ADMIN", "Administrador do Sistema"
    GESTOR = "GESTOR", "Gestor Agrícola"
    OPERADOR = "OPERADOR", "Operador de Campo"
    CONSULTOR = "CONSULTOR", "Auditor / Consulta"

class UserProfile(models.Model):
    """Extensão do perfil de usuário corporativo com papel e permissões por fazenda."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    role = models.CharField(max_length=20, choices=UserRole.choices, default=UserRole.OPERADOR)
    telefone = models.CharField(max_length=30, blank=True, default="")
    departamento = models.CharField(max_length=100, blank=True, default="Operações Agrícolas")
    fazendas = models.ManyToManyField("pivots.Fazenda", blank=True, related_name="usuarios_autorizados")
    ativo = models.BooleanField(default=True)
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username} ({self.get_role_display()})"

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
