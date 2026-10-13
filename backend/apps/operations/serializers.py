from decimal import Decimal
from rest_framework import serializers
from drf_spectacular.utils import extend_schema_field
from .models import Cultura, Safra, PlanoOperacional, RegistroIrrigacao, Alerta, JanelaOportunidade
from .services import validar_transicao_status

class CulturaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Cultura
        fields = [
            "id",
            "nome",
            "codigo",
            "variedade",
            "descricao",
            "dias_ciclo_estimado",
            "coeficiente_kc_padrao",
            "ativo",
            "observacoes",
            "criado_em",
            "atualizado_em",
        ]

    def validate_nome(self, value):
        val = value.strip()
        if not val:
            raise serializers.ValidationError("O nome da cultura é obrigatório.")
        qs = Cultura.objects.filter(nome__iexact=val)
        if self.instance:
            qs = qs.exclude(id=self.instance.id)
        if qs.exists():
            raise serializers.ValidationError("Já existe uma cultura cadastrada com este nome.")
        return val

    def validate_codigo(self, value):
        val = value.strip().upper() if value else ""
        if val:
            qs = Cultura.objects.filter(codigo__iexact=val)
            if self.instance:
                qs = qs.exclude(id=self.instance.id)
            if qs.exists():
                raise serializers.ValidationError("Já existe uma cultura com este código identificador.")
        return val

class SafraSerializer(serializers.ModelSerializer):
    fazenda_nome = serializers.ReadOnlyField(source="fazenda.nome")
    empresa_nome = serializers.ReadOnlyField(source="empresa.nome")
    planos_count = serializers.IntegerField(source="planos.count", read_only=True)
    area_total_planejada_ha = serializers.SerializerMethodField()

    class Meta:
        model = Safra
        fields = [
            "id",
            "nome",
            "data_inicio",
            "data_fim",
            "status",
            "ativa",
            "observacoes",
            "fazenda",
            "fazenda_nome",
            "empresa",
            "empresa_nome",
            "planos_count",
            "area_total_planejada_ha",
            "criado_em",
            "atualizado_em",
        ]

    @extend_schema_field(serializers.FloatField)
    def get_area_total_planejada_ha(self, obj):
        total = sum(p.area_planejada_ha for p in obj.planos.all())
        return float(total)

    def validate(self, attrs):
        data_inicio = attrs.get("data_inicio") or (self.instance.data_inicio if self.instance else None)
        data_fim = attrs.get("data_fim") or (self.instance.data_fim if self.instance else None)
        if data_inicio and data_fim and data_fim < data_inicio:
            raise serializers.ValidationError({
                "data_fim": "A data de término prevista não pode anteceder a data de início da safra."
            })
        return attrs

class PlanoOperacionalSerializer(serializers.ModelSerializer):
    safra_nome = serializers.ReadOnlyField(source="safra.nome")
    safra_data_inicio = serializers.ReadOnlyField(source="safra.data_inicio")
    safra_data_fim = serializers.ReadOnlyField(source="safra.data_fim")
    cultura_nome = serializers.ReadOnlyField(source="cultura.nome")
    fazenda_nome = serializers.ReadOnlyField(source="fazenda.nome")
    talhao_codigo = serializers.ReadOnlyField(source="talhao.codigo")
    talhao_nome = serializers.ReadOnlyField(source="talhao.nome")
    talhao_area_ha = serializers.ReadOnlyField(source="talhao.area_ha")
    pivo_codigo = serializers.ReadOnlyField(source="pivo.codigo")
    pivo_nome = serializers.ReadOnlyField(source="pivo.nome")
    pivo_area_irrigada_ha = serializers.ReadOnlyField(source="pivo.area_irrigada_ha")
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = PlanoOperacional
        fields = [
            "id",
            "safra",
            "safra_nome",
            "safra_data_inicio",
            "safra_data_fim",
            "cultura",
            "cultura_nome",
            "fazenda",
            "fazenda_nome",
            "talhao",
            "talhao_codigo",
            "talhao_nome",
            "talhao_area_ha",
            "pivo",
            "pivo_codigo",
            "pivo_nome",
            "pivo_area_irrigada_ha",
            "data_plantio",
            "data_colheita_prevista",
            "area_planejada_ha",
            "lamina_total_planejada_mm",
            "lamina_acumulada_realizada_mm",
            "status",
            "status_display",
            "observacoes",
            "criado_em",
            "atualizado_em",
        ]

    def validate(self, attrs):
        data_plantio = attrs.get("data_plantio") if "data_plantio" in attrs else (self.instance.data_plantio if self.instance else None)
        data_colheita = attrs.get("data_colheita_prevista") if "data_colheita_prevista" in attrs else (self.instance.data_colheita_prevista if self.instance else None)
        if "area_planejada_ha" in attrs:
            area_ha = attrs["area_planejada_ha"]
        elif self.instance:
            area_ha = self.instance.area_planejada_ha
        else:
            area_ha = None

        # 1. Validação cronológica das datas
        if data_plantio and data_colheita and data_colheita < data_plantio:
            raise serializers.ValidationError({
                "data_colheita_prevista": "A data de colheita prevista não pode ser anterior à data de plantio."
            })

        safra = attrs.get("safra") if "safra" in attrs else (self.instance.safra if self.instance else None)

        # 2. Validação de período com relação à Safra
        if safra and data_plantio and data_colheita:
            if data_plantio < safra.data_inicio or data_colheita > safra.data_fim:
                raise serializers.ValidationError({
                    "data_plantio": f"O período planejado ({data_plantio} a {data_colheita}) deve estar contido no intervalo da safra selecionada ({safra.data_inicio} a {safra.data_fim})."
                })

        # 3. Validação de área positiva
        if area_ha is not None and Decimal(str(area_ha)) <= Decimal("0.00"):
            raise serializers.ValidationError({
                "area_planejada_ha": "A área planejada deve ser maior que zero hectares."
            })

        # 4. Consistência e integridade de Fazenda
        fazenda = attrs.get("fazenda") if "fazenda" in attrs else (self.instance.fazenda if self.instance else None)
        talhao = attrs.get("talhao") if "talhao" in attrs else (self.instance.talhao if self.instance else None)
        pivo = attrs.get("pivo") if "pivo" in attrs else (self.instance.pivo if self.instance else None)

        if not fazenda:
            if talhao:
                fazenda = talhao.fazenda
                attrs["fazenda"] = fazenda
            elif pivo:
                fazenda = pivo.fazenda
                attrs["fazenda"] = fazenda
            elif safra and safra.fazenda:
                fazenda = safra.fazenda
                attrs["fazenda"] = fazenda

        # 4.1. Compatibilidade entre Safra e Fazenda / Empresa
        if safra and fazenda:
            if safra.fazenda_id and safra.fazenda_id != fazenda.id:
                raise serializers.ValidationError({
                    "safra": f"A safra '{safra.nome}' é restrita à fazenda '{safra.fazenda.nome}' e não pode ser vinculada à fazenda '{fazenda.nome}'."
                })
            elif not safra.fazenda_id and safra.empresa_id:
                if fazenda.empresa_id and fazenda.empresa_id != safra.empresa_id:
                    raise serializers.ValidationError({
                        "safra": f"A safra corporativa '{safra.nome}' pertence à empresa '{safra.empresa.nome}' e não pode ser vinculada à fazenda '{fazenda.nome}', vinculada a outra empresa."
                    })

        if fazenda and talhao and talhao.fazenda_id != fazenda.id:
            raise serializers.ValidationError({
                "talhao": "O talhão selecionado não pertence à fazenda informada."
            })

        if fazenda and pivo and pivo.fazenda_id != fazenda.id:
            raise serializers.ValidationError({
                "pivo": "O pivô central selecionado não pertence à fazenda informada."
            })

        if talhao and pivo and talhao.fazenda_id != pivo.fazenda_id:
            raise serializers.ValidationError({
                "talhao": "O pivô e o talhão associados devem pertencer à mesma fazenda."
            })

        # 5. Validação de teto de área disponível (Talhão e Pivô verificados independentemente)
        if area_ha is not None:
            area_num = Decimal(str(area_ha))
            if talhao and talhao.area_ha and area_num > talhao.area_ha:
                raise serializers.ValidationError({
                    "area_planejada_ha": f"A área planejada ({area_num} ha) excede a área cadastrada do talhão {talhao.codigo} ({talhao.area_ha} ha)."
                })
            if pivo and pivo.area_irrigada_ha and area_num > pivo.area_irrigada_ha:
                raise serializers.ValidationError({
                    "area_planejada_ha": f"A área planejada ({area_num} ha) excede a área de projeto irrigada pelo pivô {pivo.codigo} ({pivo.area_irrigada_ha} ha)."
                })

        # 6. Validação de transição de status usando serviço compartilhado
        if self.instance and "status" in attrs:
            novo = attrs["status"]
            user = self.context.get("request").user if self.context.get("request") else None
            validar_transicao_status(self.instance, novo, user=user)

        return attrs

class RegistroIrrigacaoSerializer(serializers.ModelSerializer):
    pivo_codigo = serializers.ReadOnlyField(source="pivo.codigo")

    @extend_schema_field(serializers.CharField)
    def get_operador_nome(self, obj):
        return obj.operador.get_full_name() if obj.operador else ""

    operador_nome = serializers.SerializerMethodField()

    class Meta:
        model = RegistroIrrigacao
        fields = [
            "id",
            "client_op_id",
            "pivo",
            "pivo_codigo",
            "plano_operacional",
            "operador",
            "operador_nome",
            "inicio_em",
            "fim_em",
            "percentimetro",
            "lamina_aplicada_mm",
            "angulo_inicial_graus",
            "angulo_final_graus",
            "sentido",
            "hidrometro_inicial_m3",
            "hidrometro_final_m3",
            "consumo_kwh",
            "tarifa_aplicada",
            "origem",
            "observacoes",
            "criado_em",
            "atualizado_em",
        ]

class AlertaSerializer(serializers.ModelSerializer):
    pivo_codigo = serializers.ReadOnlyField(source="pivo.codigo")
    severidade_display = serializers.CharField(source="get_severidade_display", read_only=True)

    class Meta:
        model = Alerta
        fields = [
            "id",
            "pivo",
            "pivo_codigo",
            "tipo",
            "severidade",
            "severidade_display",
            "titulo",
            "mensagem",
            "gerado_em",
            "reconhecido_em",
            "reconhecido_por",
            "resolvido_em",
        ]

class JanelaOportunidadeSerializer(serializers.ModelSerializer):
    empresa_nome = serializers.ReadOnlyField(source="empresa.nome")
    fazenda_nome = serializers.ReadOnlyField(source="fazenda.nome")
    talhao_codigo = serializers.ReadOnlyField(source="talhao.codigo")
    talhao_nome = serializers.ReadOnlyField(source="talhao.nome")
    pivo_codigo = serializers.ReadOnlyField(source="pivo.codigo")
    pivo_nome = serializers.ReadOnlyField(source="pivo.nome")
    cultura_nome = serializers.ReadOnlyField(source="cultura.nome")
    safra_nome = serializers.ReadOnlyField(source="safra.nome")
    tipo_display = serializers.CharField(source="get_tipo_display", read_only=True)
    prioridade_display = serializers.CharField(source="get_prioridade_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    origem_display = serializers.CharField(source="get_origem_display", read_only=True)
    is_vencida = serializers.ReadOnlyField()
    autor_nome = serializers.ReadOnlyField(source="autor.username")
    reconhecido_por_nome = serializers.ReadOnlyField(source="reconhecido_por.username")
    resolvido_por_nome = serializers.ReadOnlyField(source="resolvido_por.username")
    descartado_por_nome = serializers.ReadOnlyField(source="descartado_por.username")

    class Meta:
        model = JanelaOportunidade
        fields = [
            "id",
            "titulo",
            "descricao",
            "tipo",
            "tipo_display",
            "prioridade",
            "prioridade_display",
            "status",
            "status_display",
            "origem",
            "origem_display",
            "inicio_previsto",
            "fim_previsto",
            "is_vencida",
            "empresa",
            "empresa_nome",
            "fazenda",
            "fazenda_nome",
            "talhao",
            "talhao_codigo",
            "talhao_nome",
            "pivo",
            "pivo_codigo",
            "pivo_nome",
            "cultura",
            "cultura_nome",
            "safra",
            "safra_nome",
            "plano_operacional",
            "justificativa",
            "motivo_descarte",
            "motivo",
            "tarifa_vigente",
            "economia_estimada_reais",
            "recomendacao",
            "aproveitada",
            "autor",
            "autor_nome",
            "reconhecido_por",
            "reconhecido_por_nome",
            "reconhecido_em",
            "resolvido_por",
            "resolvido_por_nome",
            "resolvido_em",
            "descartado_por",
            "descartado_por_nome",
            "descartado_em",
            "criado_em",
            "atualizado_em",
        ]
        read_only_fields = [
            "id",
            "reconhecido_por",
            "reconhecido_em",
            "resolvido_por",
            "resolvido_em",
            "descartado_por",
            "descartado_em",
            "criado_em",
            "atualizado_em",
        ]

    def validate(self, attrs):
        inicio = attrs.get("inicio_previsto") or (self.instance.inicio_previsto if self.instance else None)
        fim = attrs.get("fim_previsto") or (self.instance.fim_previsto if self.instance else None)
        if inicio and fim and fim < inicio:
            raise serializers.ValidationError({
                "fim_previsto": "A data/hora de término da janela não pode ser anterior ao início."
            })

        fazenda = attrs.get("fazenda") if "fazenda" in attrs else (self.instance.fazenda if self.instance else None)
        talhao = attrs.get("talhao") if "talhao" in attrs else (self.instance.talhao if self.instance else None)
        pivo = attrs.get("pivo") if "pivo" in attrs else (self.instance.pivo if self.instance else None)
        plano = attrs.get("plano_operacional") if "plano_operacional" in attrs else (self.instance.plano_operacional if self.instance else None)
        safra = attrs.get("safra") if "safra" in attrs else (self.instance.safra if self.instance else None)
        empresa = attrs.get("empresa") if "empresa" in attrs else (self.instance.empresa if self.instance else None)

        if not fazenda:
            if pivo:
                fazenda = pivo.fazenda
                attrs["fazenda"] = fazenda
            elif talhao:
                fazenda = talhao.fazenda
                attrs["fazenda"] = fazenda
            elif plano and plano.fazenda:
                fazenda = plano.fazenda
                attrs["fazenda"] = fazenda

        if fazenda:
            if pivo and pivo.fazenda_id != fazenda.id:
                raise serializers.ValidationError({
                    "pivo": f"O pivô '{pivo.codigo}' pertence à fazenda '{pivo.fazenda.nome}', incompatível com a fazenda vinculada."
                })
            if talhao and talhao.fazenda_id != fazenda.id:
                raise serializers.ValidationError({
                    "talhao": f"O talhão '{talhao.codigo}' pertence à fazenda '{talhao.fazenda.nome}', incompatível com a fazenda vinculada."
                })
            if plano and plano.fazenda_id and plano.fazenda_id != fazenda.id:
                raise serializers.ValidationError({
                    "plano_operacional": "O plano operacional selecionado pertence a outra fazenda."
                })
            if safra and safra.fazenda_id and safra.fazenda_id != fazenda.id:
                raise serializers.ValidationError({
                    "safra": "A safra selecionada é restrita a outra fazenda."
                })
            if empresa and fazenda.empresa_id and fazenda.empresa_id != empresa.id:
                raise serializers.ValidationError({
                    "empresa": "A fazenda selecionada não pertence à empresa informada."
                })

        return attrs
