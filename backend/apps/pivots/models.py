import uuid
from decimal import Decimal
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator

class Empresa(models.Model):
    """Empresa ou Organização controladora das unidades agrícolas."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    nome = models.CharField(max_length=150)
    cnpj = models.CharField(max_length=20, blank=True, default="")
    ativo = models.BooleanField(default=True)
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["nome"]
        verbose_name = "Empresa"
        verbose_name_plural = "Empresas"

    def __str__(self):
        return self.nome

class Fazenda(models.Model):
    """Unidade agrícola corporativa onde os pivôs estão alocados."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    empresa = models.ForeignKey(Empresa, on_delete=models.SET_NULL, null=True, blank=True, related_name="fazendas")
    nome = models.CharField(max_length=150)
    codigo = models.CharField(max_length=50, unique=True)
    municipio = models.CharField(max_length=100)
    uf = models.CharField(max_length=2)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    area_total_ha = models.DecimalField(max_digits=10, decimal_places=2, default=0.0)
    ativo = models.BooleanField(default=True)
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["nome"]
        verbose_name = "Fazenda"
        verbose_name_plural = "Fazendas"

    def __str__(self):
        return f"{self.nome} ({self.codigo})"

class Talhao(models.Model):
    """Subdivisão geográfica e agronômica da fazenda."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    fazenda = models.ForeignKey(Fazenda, on_delete=models.CASCADE, related_name="talhoes")
    codigo = models.CharField(max_length=50)
    nome = models.CharField(max_length=100)
    area_ha = models.DecimalField(max_digits=8, decimal_places=2)
    ativo = models.BooleanField(default=True)
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["codigo"]
        unique_together = ("fazenda", "codigo")
        verbose_name = "Talhão"
        verbose_name_plural = "Talhões"

    def __str__(self):
        return f"{self.fazenda.nome} - {self.codigo} ({self.nome})"

class PivoStatus(models.TextChoices):
    PARADO = "PARADO", "Parado / Desligado"
    IRRIGANDO = "IRRIGANDO", "Irrigando com Água"
    FERTIRRIGANDO = "FERTIRRIGANDO", "Fertirrigação Ativa"
    MANUTENCAO = "MANUTENCAO", "Em Manutenção"
    FALHA = "FALHA", "Falha Operacional / Interrompido"

class PivoSentido(models.TextChoices):
    HORARIO = "HORARIO", "Horário (Sentido dos Ponteiros)"
    ANTI_HORARIO = "ANTI_HORARIO", "Anti-Horário"
    ESTACIONARIO = "ESTACIONARIO", "Estacionário"

class Pivo(models.Model):
    """Pivô Central de Irrigação."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    fazenda = models.ForeignKey(Fazenda, on_delete=models.PROTECT, related_name="pivos")
    talhao = models.ForeignKey(Talhao, on_delete=models.SET_NULL, null=True, blank=True, related_name="pivos")
    codigo = models.CharField(max_length=50, help_text="Identificador único na fazenda, ex: PIV-01")
    nome = models.CharField(max_length=100, help_text="Nome descritivo, ex: Pivô Sede Norte")
    fabricante = models.CharField(max_length=80, blank=True, default="Lindsay Zimmatic")
    modelo = models.CharField(max_length=80, blank=True, default="Pivô Central Standard")
    
    # Coordenadas georreferenciadas do centro (base do pivô)
    latitude_centro = models.DecimalField(max_digits=9, decimal_places=6, default=-16.452300)
    longitude_centro = models.DecimalField(max_digits=9, decimal_places=6, default=-47.854200)
    
    # Parâmetros de Engenharia de Irrigação
    raio_metros = models.DecimalField(max_digits=7, decimal_places=2, default=450.00, help_text="Comprimento total da estrutura em metros")
    area_irrigada_ha = models.DecimalField(max_digits=8, decimal_places=2, default=63.62, help_text="Área irrigada total em hectares")
    vazao_nominal_m3h = models.DecimalField(max_digits=8, decimal_places=2, default=280.00, help_text="Vazão de projeto em m³/h")
    pressao_nominal_bar = models.DecimalField(max_digits=6, decimal_places=2, default=3.50, help_text="Pressão recomendada na base em bar")
    velocidade_100_percent_mh = models.DecimalField(max_digits=6, decimal_places=2, default=210.00, help_text="Velocidade da última torre a 100% (m/h)")

    # Limites angulares (pivôs setoriais ou circulares)
    angulo_inicial_graus = models.DecimalField(max_digits=5, decimal_places=2, default=0.00, validators=[MinValueValidator(Decimal("0.00")), MaxValueValidator(Decimal("360.00"))])
    angulo_final_graus = models.DecimalField(max_digits=5, decimal_places=2, default=360.00, validators=[MinValueValidator(Decimal("0.00")), MaxValueValidator(Decimal("360.00"))])
    
    # Status Operacional e Telemetria
    status_operacional = models.CharField(max_length=20, choices=PivoStatus.choices, default=PivoStatus.PARADO)
    angulo_atual_graus = models.DecimalField(max_digits=5, decimal_places=2, default=0.00, validators=[MinValueValidator(Decimal("0.00")), MaxValueValidator(Decimal("360.00"))])
    sentido_rotacao = models.CharField(max_length=20, choices=PivoSentido.choices, default=PivoSentido.ESTACIONARIO)
    percentimetro_atual = models.IntegerField(default=100, validators=[MinValueValidator(1), MaxValueValidator(100)])
    lamina_atual_mm = models.DecimalField(max_digits=6, decimal_places=2, default=0.00, help_text="Lâmina de água em mm aplicada no percentímetro atual")
    pressao_atual_bar = models.DecimalField(max_digits=6, decimal_places=2, default=0.00)
    tensao_eletrica_v = models.DecimalField(max_digits=6, decimal_places=2, default=380.00)
    
    ultima_comunicacao = models.DateTimeField(auto_now=True)
    ativo = models.BooleanField(default=True)
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["fazenda", "codigo"]
        unique_together = ("fazenda", "codigo")
        verbose_name = "Pivô Central"
        verbose_name_plural = "Pivôs Centrais"

    def __str__(self):
        return f"{self.codigo} - {self.nome} ({self.fazenda.nome})"
