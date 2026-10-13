import uuid
from django.db import models

class ProcessedOperation(models.Model):
    """Registro de idempotência para operações despachadas pelo aplicativo mobile."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    client_op_id = models.UUIDField(unique=True, db_index=True)
    client_device_id = models.CharField(max_length=100, blank=True, default="")
    entity = models.CharField(max_length=60)
    action = models.CharField(max_length=20)
    server_entity_id = models.CharField(max_length=64, blank=True, default="")
    status = models.CharField(max_length=20, default="SUCCESS")
    response_payload = models.JSONField(default=dict, blank=True)
    processed_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-processed_at"]
        verbose_name = "Operação Sincronizada"
        verbose_name_plural = "Operações Sincronizadas"

    def __str__(self):
        return f"{self.entity} [{self.action}] - Op {self.client_op_id} ({self.status})"
