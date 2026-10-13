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
        fields = [
            "id",
            "empresa",
            "empresa_nome",
            "nome",
            "codigo",
            "filial",
            "id_pims",
            "municipio",
            "uf",
            "latitude",
            "longitude",
            "area_total_ha",
            "ativo",
            "pivos_count",
            "criado_em",
            "atualizado_em",
        ]
        extra_kwargs = {
            "codigo": {"required": False, "allow_blank": True},
            "filial": {"required": False, "allow_blank": True},
            "id_pims": {"required": False, "allow_blank": True},
            "municipio": {"required": False, "allow_blank": True},
            "uf": {"required": False, "allow_blank": True},
        }

    def validate(self, attrs):
        instance = getattr(self, "instance", None)

        # 1. Validação e unicidade da Filial
        filial = attrs.get("filial")
        if filial is not None:
            filial = str(filial).strip()
            attrs["filial"] = filial
            if filial:
                if len(filial) != 6 or not filial.isdigit():
                    raise serializers.ValidationError({
                        "filial": "A filial deve conter exatamente 6 dígitos numéricos."
                    })
                qs_filial = Fazenda.objects.filter(filial__iexact=filial)
                if instance:
                    qs_filial = qs_filial.exclude(id=instance.id)
                if qs_filial.exists():
                    conflito = qs_filial.first()
                    raise serializers.ValidationError({
                        "filial": f"A Filial '{filial}' já está cadastrada na fazenda '{conflito.nome}'."
                    })

        # 2. Validação e unicidade do ID PIMS
        id_pims = attrs.get("id_pims")
        if id_pims is not None:
            id_pims = str(id_pims).strip()
            attrs["id_pims"] = id_pims
            if id_pims:
                qs_pims = Fazenda.objects.filter(id_pims__iexact=id_pims)
                if instance:
                    qs_pims = qs_pims.exclude(id=instance.id)
                if qs_pims.exists():
                    conflito = qs_pims.first()
                    raise serializers.ValidationError({
                        "id_pims": f"O ID PIMS '{id_pims}' já está cadastrado na fazenda '{conflito.nome}'."
                    })

        # 3. Forçar nome em maiúsculo
        nome = attrs.get("nome")
        if nome:
            attrs["nome"] = nome.strip().upper()

        return attrs

class TalhaoSerializer(serializers.ModelSerializer):
    fazenda_nome = serializers.ReadOnlyField(source="fazenda.nome")
    fazenda_filial = serializers.ReadOnlyField(source="fazenda.filial")

    class Meta:
        model = Talhao
        fields = [
            "id",
            "fazenda",
            "fazenda_nome",
            "fazenda_filial",
            "codigo",
            "nome",
            "descricao",
            "id_pims",
            "area_ha",
            "ativo",
            "criado_em",
            "atualizado_em",
        ]
        extra_kwargs = {
            "nome": {"required": False, "allow_blank": True},
            "descricao": {"required": False, "allow_blank": True},
            "id_pims": {"required": False, "allow_blank": True},
            "area_ha": {"required": False},
        }

    def validate(self, attrs):
        # 1. Fazenda validation
        fazenda = attrs.get("fazenda") or getattr(self.instance, "fazenda", None)
        if not fazenda:
            raise serializers.ValidationError({"fazenda": "A fazenda vinculada é obrigatória."})

        # 2. Código validation & uppercase
        codigo = attrs.get("codigo")
        if codigo:
            codigo = codigo.strip().upper()
            attrs["codigo"] = codigo

            # Verificar se código já existe na fazenda (unique_together fazenda + codigo)
            qs = Talhao.objects.filter(fazenda=fazenda, codigo=codigo)
            if self.instance:
                qs = qs.exclude(id=self.instance.id)
            if qs.exists():
                raise serializers.ValidationError({
                    "codigo": f"Já existe um talhão com o código '{codigo}' cadastrado nesta fazenda."
                })
        elif not self.instance:
            raise serializers.ValidationError({"codigo": "O código do talhão é obrigatório."})

        # 3. Descrição / Nome
        descricao = attrs.get("descricao")
        nome = attrs.get("nome")
        if descricao:
            descricao = descricao.strip()
            attrs["descricao"] = descricao
            if not nome:
                attrs["nome"] = descricao[:100]
        elif nome:
            nome = nome.strip()
            attrs["nome"] = nome
            if not descricao:
                attrs["descricao"] = nome
        elif not self.instance:
            raise serializers.ValidationError({"descricao": "A descrição do talhão é obrigatória."})

        # 4. ID PIMS (Opcional)
        id_pims = attrs.get("id_pims")
        if id_pims is not None:
            attrs["id_pims"] = str(id_pims).strip()

        return attrs

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
