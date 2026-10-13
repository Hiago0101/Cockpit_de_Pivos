from rest_framework import serializers
from .models import Empresa, Fazenda, Talhao, Pivo

class EmpresaSerializer(serializers.ModelSerializer):
    fazendas_count = serializers.IntegerField(source="fazendas.count", read_only=True)

    class Meta:
        model = Empresa
        fields = ["id", "nome", "cnpj", "ativo", "fazendas_count", "criado_em", "atualizado_em"]

class FazendaSerializer(serializers.ModelSerializer):
    empresa_nome = serializers.ReadOnlyField(source="empresa.nome")
    pivos_count = serializers.IntegerField(source="pivos.count", read_only=True)
    
    class Meta:
        model = Fazenda
        fields = ["id", "empresa", "empresa_nome", "nome", "codigo", "municipio", "uf", "latitude", "longitude", "area_total_ha", "ativo", "pivos_count", "criado_em", "atualizado_em"]

class TalhaoSerializer(serializers.ModelSerializer):
    fazenda_nome = serializers.ReadOnlyField(source="fazenda.nome")

    class Meta:
        model = Talhao
        fields = ["id", "fazenda", "fazenda_nome", "codigo", "nome", "area_ha", "ativo", "criado_em", "atualizado_em"]

class PivoSerializer(serializers.ModelSerializer):
    fazenda_nome = serializers.ReadOnlyField(source="fazenda.nome")
    talhao_codigo = serializers.ReadOnlyField(source="talhao.codigo")
    talhao_nome = serializers.ReadOnlyField(source="talhao.nome")
    status_display = serializers.CharField(source="get_status_operacional_display", read_only=True)
    sentido_display = serializers.CharField(source="get_sentido_rotacao_display", read_only=True)

    class Meta:
        model = Pivo
        fields = [
            "id",
            "fazenda",
            "fazenda_nome",
            "talhao",
            "talhao_codigo",
            "talhao_nome",
            "codigo",
            "nome",
            "fabricante",
            "modelo",
            "latitude_centro",
            "longitude_centro",
            "raio_metros",
            "area_irrigada_ha",
            "vazao_nominal_m3h",
            "pressao_nominal_bar",
            "velocidade_100_percent_mh",
            "angulo_inicial_graus",
            "angulo_final_graus",
            "status_operacional",
            "status_display",
            "angulo_atual_graus",
            "sentido_rotacao",
            "sentido_display",
            "percentimetro_atual",
            "lamina_atual_mm",
            "pressao_atual_bar",
            "tensao_eletrica_v",
            "ultima_comunicacao",
            "ativo",
            "criado_em",
            "atualizado_em",
        ]

    def validate_percentimetro_atual(self, value):
        if not (1 <= value <= 100):
            raise serializers.ValidationError("O percentímetro deve estar entre 1% e 100%.")
        return value

    def validate_angulo_atual_graus(self, value):
        if not (0 <= value <= 360):
            raise serializers.ValidationError("O ângulo deve estar entre 0° e 360°.")
        return value

    def validate(self, attrs):
        raio = attrs.get("raio_metros")
        if raio is not None and raio <= 0:
            raise serializers.ValidationError({"raio_metros": "O raio do pivô deve ser maior que zero."})
            
        fazenda = attrs.get("fazenda") or (self.instance.fazenda if self.instance else None)
        talhao = attrs.get("talhao") or (self.instance.talhao if self.instance and "talhao" not in attrs else None)
        if talhao and fazenda and talhao.fazenda_id != fazenda.id:
            raise serializers.ValidationError({"talhao": "O talhão associado deve pertencer à mesma fazenda do pivô."})

        return attrs
