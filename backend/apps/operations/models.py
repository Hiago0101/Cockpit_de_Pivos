import uuid
from django.db import models
from django.contrib.auth.models import User
from apps.pivots.models import Pivo, Fazenda, Talhao, Empresa

class Cultura(models.Model):
    """Culturas agrícolas cadastradas no sistema.
    Campos estritos:
      - ID do Sistema (id - UUIDField)
      - Fazenda / Filial (fazenda - ForeignKey Fazenda)
      - Talhão (talhao - ForeignKey Talhao, opcional)
      - Descrição completa da cultura (descricao - maiúsculo)
      - ID do PIMS (id_pims, opcional, único quando informado)
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    fazenda = models.ForeignKey(
        Fazenda,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="culturas",
        help_text="Fazenda / Filial vinculada"
    )
    descricao = models.CharField(max_length=255, blank=False, default="", help_text="Descrição completa da cultura")
    id_pims = models.CharField(max_length=50, blank=True, default="", help_text="Identificador no PIMS (opcional)")
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["descricao"]
        verbose_name = "Cultura"
        verbose_name_plural = "Culturas"
        constraints = [
            models.UniqueConstraint(
                fields=["id_pims"],
                name="unique_cultura_id_pims",
                condition=~models.Q(id_pims=""),
            ),
        ]

    @property
    def nome(self):
        """Propriedade para compatibilidade com código que acessa cultura.nome."""
        return self.descricao

    def save(self, *args, **kwargs):
        # 1. Forçar descrição em maiúsculo
        if self.descricao:
            self.descricao = self.descricao.strip().upper()

        # 2. Limpeza e validação de duplicidade do ID PIMS (quando informado)
        if self.id_pims:
            self.id_pims = self.id_pims.strip()
            if self.id_pims:
                qs_pims = Cultura.objects.filter(id_pims__iexact=self.id_pims)
                if self.id:
                    qs_pims = qs_pims.exclude(id=self.id)
                if qs_pims.exists():
                    conflito = qs_pims.first()
                    from django.core.exceptions import ValidationError
                    raise ValidationError({
                        "id_pims": f"Já existe uma cultura com o ID PIMS '{self.id_pims}' ({conflito.descricao})."
                    })

        super().save(*args, **kwargs)

    def __str__(self):
        return self.descricao

class Safra(models.Model):
    """Ano agrícola ou ciclo de safra/safrinha."""
    STATUS_CHOICES = [
        ("PLANEJADA", "Planejada"),
        ("EM_ANDAMENTO", "Em Andamento"),
        ("CONCLUIDA", "Concluída"),
        ("CANCELADA", "Cancelada"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    nome = models.CharField(max_length=100)  # ex: Safra 2024/2025 - Verão
    data_inicio = models.DateField()
    data_fim = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="EM_ANDAMENTO")
    ativa = models.BooleanField(default=True)
    observacoes = models.TextField(blank=True, default="")
    fazenda = models.ForeignKey(Fazenda, on_delete=models.SET_NULL, null=True, blank=True, related_name="safras")
    empresa = models.ForeignKey(Empresa, on_delete=models.SET_NULL, null=True, blank=True, related_name="safras")
    criado_em = models.DateTimeField(auto_now_add=True, null=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-data_inicio"]
        verbose_name = "Safra"
        verbose_name_plural = "Safras"

    def __str__(self):
        return self.nome

class PlanoOperacional(models.Model):
    """Planejamento agrícola que associa safra, cultura, fazenda, talhão e pivô."""
    STATUS_CHOICES = [
        ("RASCUNHO", "Rascunho"),
        ("PLANEJADO", "Planejado"),
        ("EM_ANDAMENTO", "Em Andamento"),
        ("CONCLUIDO", "Concluído"),
        ("CANCELADO", "Cancelado"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    safra = models.ForeignKey(Safra, on_delete=models.PROTECT, related_name="planos")
    cultura = models.ForeignKey(Cultura, on_delete=models.PROTECT, related_name="planos")
    fazenda = models.ForeignKey(Fazenda, on_delete=models.PROTECT, null=True, blank=True, related_name="planos_agricolas")
    talhao = models.ForeignKey(Talhao, on_delete=models.SET_NULL, null=True, blank=True, related_name="planos")
    pivo = models.ForeignKey(Pivo, on_delete=models.SET_NULL, null=True, blank=True, related_name="planos")
    
    data_plantio = models.DateField(help_text="Data prevista do plantio")
    data_colheita_prevista = models.DateField(help_text="Data prevista da colheita")
    data_plantio_real = models.DateField(null=True, blank=True, help_text="Data efetiva do plantio")
    data_colheita_real = models.DateField(null=True, blank=True, help_text="Data efetiva da colheita")
    area_planejada_ha = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    lamina_total_planejada_mm = models.DecimalField(max_digits=7, decimal_places=2, default=450.00)
    lamina_acumulada_realizada_mm = models.DecimalField(max_digits=7, decimal_places=2, default=0.00)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="PLANEJADO")
    permite_sobreposicao = models.BooleanField(default=False, help_text="Indica se eventual sobreposição de datas foi autorizada")
    justificativa_sobreposicao = models.TextField(blank=True, default="", help_text="Justificativa auditável para autorização de sobreposição")
    autorizado_por = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="planos_autorizados")
    observacoes = models.TextField(blank=True, default="")
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-data_plantio"]
        verbose_name = "Plano Operacional"
        verbose_name_plural = "Planos Operacionais"

    def save(self, *args, **kwargs):
        if not self.fazenda:
            if self.pivo:
                self.fazenda = self.pivo.fazenda
            elif self.talhao:
                self.fazenda = self.talhao.fazenda
        super().save(*args, **kwargs)

    def __str__(self):
        alvo = self.pivo.codigo if self.pivo else (self.talhao.codigo if self.talhao else (self.fazenda.nome if self.fazenda else "Área"))
        return f"{alvo} - {self.cultura.nome} ({self.safra.nome})"

class RegistroIrrigacao(models.Model):
    """Registro histórico de evento de irrigação com proteção por client_op_id."""
    ORIGEM_CHOICES = [
        ("WEB", "Aplicação Web"),
        ("MOBILE_OFFLINE", "Aplicativo Mobile (Offline Sync)"),
        ("TELEMETRIA", "Telemetria Automática"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    client_op_id = models.UUIDField(unique=True, null=True, blank=True, help_text="Chave de idempotência enviada pelo mobile")
    pivo = models.ForeignKey(Pivo, on_delete=models.CASCADE, related_name="irrigações")
    plano_operacional = models.ForeignKey(PlanoOperacional, on_delete=models.SET_NULL, null=True, blank=True, related_name="irrigações")
    operador = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="irrigações_operadas")
    
    inicio_em = models.DateTimeField()
    fim_em = models.DateTimeField(null=True, blank=True)
    percentimetro = models.PositiveSmallIntegerField(default=100)
    lamina_aplicada_mm = models.DecimalField(max_digits=6, decimal_places=2, default=0.00)
    angulo_inicial_graus = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    angulo_final_graus = models.DecimalField(max_digits=5, decimal_places=2, default=360.00)
    sentido = models.CharField(max_length=20, default="HORARIO")
    
    hidrometro_inicial_m3 = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    hidrometro_final_m3 = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    consumo_kwh = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    tarifa_aplicada = models.CharField(max_length=50, default="FORA_PONTA")
    origem = models.CharField(max_length=30, choices=ORIGEM_CHOICES, default="WEB")
    observacoes = models.TextField(blank=True, default="")
    
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-inicio_em"]
        verbose_name = "Registro de Irrigação"
        verbose_name_plural = "Registros de Irrigação"

    def __str__(self):
        return f"{self.pivo.codigo} - {self.lamina_aplicada_mm}mm em {self.inicio_em.strftime('%d/%m/%Y %H:%M')}"

class AlertaSeveridade(models.TextChoices):
    INFO = "INFO", "Informativo"
    ATENCAO = "ATENCAO", "Atenção Operacional"
    CRITICO = "CRITICO", "Crítico / Parada de Emergência"

class Alerta(models.Model):
    """Alertas operacionais do pivô (pressão, alinhamento, energia, lâmina)."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    pivo = models.ForeignKey(Pivo, on_delete=models.CASCADE, related_name="alertas")
    tipo = models.CharField(max_length=60, default="PRESSAO_ANORMAL")
    severidade = models.CharField(max_length=20, choices=AlertaSeveridade.choices, default=AlertaSeveridade.ATENCAO)
    titulo = models.CharField(max_length=150)
    mensagem = models.TextField()
    gerado_em = models.DateTimeField(auto_now_add=True)
    reconhecido_em = models.DateTimeField(null=True, blank=True)
    reconhecido_por = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="alertas_reconhecidos")
    resolvido_em = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-gerado_em"]
        verbose_name = "Alerta Operacional"
        verbose_name_plural = "Alertas Operacionais"

    def __str__(self):
        return f"[{self.severidade}] {self.pivo.codigo} - {self.titulo}"

class TipoOportunidade(models.TextChoices):
    TARIFA_NOTURNA = "TARIFA_NOTURNA", "Tarifa Fora de Ponta Noturna"
    PLANTIO_IDEAL = "PLANTIO_IDEAL", "Janela Ideal de Plantio"
    IRRIGACAO_OTIMA = "IRRIGACAO_OTIMA", "Janela Ótima de Irrigação"
    COLHEITA_PREVISTA = "COLHEITA_PREVISTA", "Janela de Colheita Estimada"
    MANUTENCAO_PREVENTIVA = "MANUTENCAO_PREVENTIVA", "Manutenção Preventiva"
    OUTRO = "OUTRO", "Operacional / Outro"

class PrioridadeOportunidade(models.TextChoices):
    BAIXA = "BAIXA", "Baixa"
    MEDIA = "MEDIA", "Média"
    ALTA = "ALTA", "Alta"
    CRITICA = "CRITICA", "Crítica"

class SituacaoOportunidade(models.TextChoices):
    DETECTADA = "DETECTADA", "Detectada"
    RECONHECIDA = "RECONHECIDA", "Reconhecida"
    RESOLVIDA = "RESOLVIDA", "Resolvida"
    DESCARTADA = "DESCARTADA", "Descartada"

class OrigemOportunidade(models.TextChoices):
    MANUAL = "MANUAL", "Registro Manual"
    REGRA_INTERNA = "REGRA_INTERNA", "Regra Interna do Sistema"
    INTEGRACAO_EXTERNA = "INTEGRACAO_EXTERNA", "Integração Externa"

class JanelaOportunidade(models.Model):
    """Recomendações e janelas operacionais agrícolas (tarifárias, plantio, lâmina, colheita)."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    titulo = models.CharField(max_length=150, default="Oportunidade Operacional")
    descricao = models.TextField(blank=True, default="")
    tipo = models.CharField(max_length=40, choices=TipoOportunidade.choices, default=TipoOportunidade.TARIFA_NOTURNA)
    prioridade = models.CharField(max_length=20, choices=PrioridadeOportunidade.choices, default=PrioridadeOportunidade.MEDIA)
    status = models.CharField(max_length=20, choices=SituacaoOportunidade.choices, default=SituacaoOportunidade.DETECTADA)
    origem = models.CharField(max_length=30, choices=OrigemOportunidade.choices, default=OrigemOportunidade.REGRA_INTERNA)
    
    inicio_previsto = models.DateTimeField()
    fim_previsto = models.DateTimeField()
    
    # Vínculos com entidades estruturais e agrícolas
    empresa = models.ForeignKey(Empresa, on_delete=models.SET_NULL, null=True, blank=True, related_name="janelas_oportunidade")
    fazenda = models.ForeignKey(Fazenda, on_delete=models.PROTECT, null=True, blank=True, related_name="janelas_oportunidade")
    talhao = models.ForeignKey(Talhao, on_delete=models.SET_NULL, null=True, blank=True, related_name="janelas_oportunidade")
    pivo = models.ForeignKey(Pivo, on_delete=models.CASCADE, null=True, blank=True, related_name="janelas_oportunidade")
    cultura = models.ForeignKey(Cultura, on_delete=models.SET_NULL, null=True, blank=True, related_name="janelas_oportunidade")
    safra = models.ForeignKey(Safra, on_delete=models.SET_NULL, null=True, blank=True, related_name="janelas_oportunidade")
    plano_operacional = models.ForeignKey(PlanoOperacional, on_delete=models.SET_NULL, null=True, blank=True, related_name="janelas_oportunidade")
    
    # Justificativas técnicas e rastreabilidade
    justificativa = models.TextField(blank=True, default="", help_text="Evidência ou justificativa técnica da oportunidade")
    motivo_descarte = models.TextField(blank=True, default="", help_text="Motivo caso a oportunidade seja descartada")
    
    # Campos legados mantidos para compatibilidade
    motivo = models.CharField(max_length=150, blank=True, default="Tarifa Fora de Ponta Noturna")
    tarifa_vigente = models.CharField(max_length=50, blank=True, default="REDUZIDA_NOTURNA")
    economia_estimada_reais = models.DecimalField(max_digits=8, decimal_places=2, default=0.00)
    recomendacao = models.TextField(blank=True, default="")
    aproveitada = models.BooleanField(default=False)
    
    # Autoria e ciclo de vida
    autor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="oportunidades_criadas")
    reconhecido_por = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="oportunidades_reconhecidas")
    reconhecido_em = models.DateTimeField(null=True, blank=True)
    resolvido_por = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="oportunidades_resolvidas")
    resolvido_em = models.DateTimeField(null=True, blank=True)
    descartado_por = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="oportunidades_descartadas")
    descartado_em = models.DateTimeField(null=True, blank=True)
    
    criado_em = models.DateTimeField(auto_now_add=True, null=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-prioridade", "inicio_previsto"]
        verbose_name = "Janela de Oportunidade"
        verbose_name_plural = "Janelas de Oportunidade"

    def __str__(self):
        alvo = self.pivo.codigo if self.pivo else (self.talhao.codigo if self.talhao else (self.fazenda.nome if self.fazenda else "Área"))
        return f"[{self.get_prioridade_display()}] {self.titulo} ({alvo})"

    @property
    def is_vencida(self):
        from django.utils import timezone
        return (
            bool(self.fim_previsto)
            and self.fim_previsto < timezone.now()
            and self.status in [SituacaoOportunidade.DETECTADA, SituacaoOportunidade.RECONHECIDA]
        )

    def clean(self):
        super().clean()
        from django.core.exceptions import ValidationError
        
        if self.inicio_previsto and self.fim_previsto:
            if self.fim_previsto < self.inicio_previsto:
                raise ValidationError({"fim_previsto": "A data/hora de término da janela não pode ser anterior ao início."})
        
        # Dedução automática de contexto hierárquico
        if self.pivo and not self.fazenda:
            self.fazenda = self.pivo.fazenda
        if self.talhao and not self.fazenda:
            self.fazenda = self.talhao.fazenda
        if self.plano_operacional and not self.fazenda:
            self.fazenda = self.plano_operacional.fazenda
        if self.fazenda and not self.empresa:
            self.empresa = self.fazenda.empresa
            
        if self.plano_operacional:
            if not self.cultura:
                self.cultura = self.plano_operacional.cultura
            if not self.safra:
                self.safra = self.plano_operacional.safra
            if not self.pivo and self.plano_operacional.pivo:
                self.pivo = self.plano_operacional.pivo
            if not self.talhao and self.plano_operacional.talhao:
                self.talhao = self.plano_operacional.talhao
                
        # Consistência entre fazenda e outras entidades
        if self.fazenda:
            if self.pivo and self.pivo.fazenda_id != self.fazenda_id:
                raise ValidationError({"pivo": f"O pivô '{self.pivo.codigo}' pertence à fazenda '{self.pivo.fazenda.nome}', incompatível com a fazenda vinculada."})
            if self.talhao and self.talhao.fazenda_id != self.fazenda_id:
                raise ValidationError({"talhao": f"O talhão '{self.talhao.codigo}' pertence à fazenda '{self.talhao.fazenda.nome}', incompatível com a fazenda vinculada."})
            if self.plano_operacional and self.plano_operacional.fazenda_id and self.plano_operacional.fazenda_id != self.fazenda_id:
                raise ValidationError({"plano_operacional": "O plano operacional selecionado pertence a outra fazenda."})
            if self.safra and self.safra.fazenda_id and self.safra.fazenda_id != self.fazenda_id:
                raise ValidationError({"safra": "A safra selecionada é restrita a outra fazenda."})
                
        if self.empresa and self.fazenda and self.fazenda.empresa_id:
            if self.fazenda.empresa_id != self.empresa_id:
                raise ValidationError({"empresa": "A fazenda selecionada não pertence à empresa informada."})

    def save(self, *args, **kwargs):
        if not self.titulo or self.titulo == "Oportunidade Operacional":
            if self.motivo and self.motivo != "Tarifa Fora de Ponta Noturna":
                self.titulo = self.motivo
            else:
                self.titulo = f"Janela: {self.get_tipo_display()}"
        if not self.motivo:
            self.motivo = self.titulo
        self.aproveitada = (self.status == SituacaoOportunidade.RESOLVIDA)
        self.clean()
        super().save(*args, **kwargs)
