import uuid
from rest_framework import serializers
from drf_spectacular.utils import extend_schema_field
from django.contrib.auth.models import User
from .models import UserProfile, AuditLog, GrupoPermissao, PermissaoModulo, ModuloSistema

class PermissaoModuloSerializer(serializers.ModelSerializer):
    modulo_display = serializers.CharField(source="get_modulo_display", read_only=True)

    class Meta:
        model = PermissaoModulo
        fields = [
            "id",
            "modulo",
            "modulo_display",
            "pode_acessar_tela",
            "pode_visualizar_completo",
            "pode_incluir",
            "pode_alterar",
            "pode_excluir",
        ]

class GrupoPermissaoSerializer(serializers.ModelSerializer):
    permissoes = PermissaoModuloSerializer(many=True, required=False)
    usuarios_count = serializers.SerializerMethodField()

    class Meta:
        model = GrupoPermissao
        fields = [
            "id",
            "nome",
            "descricao",
            "is_admin_padrao",
            "ativo",
            "usuarios_count",
            "permissoes",
            "criado_em",
            "atualizado_em",
        ]

    def get_usuarios_count(self, obj):
        return obj.usuarios.count()

    def create(self, validated_data):
        permissoes_data = validated_data.pop("permissoes", [])
        grupo = GrupoPermissao.objects.create(**validated_data)

        # Se não foram enviadas permissões explicitamente, cria padrão para todos os módulos
        all_modules = [c[0] for c in ModuloSistema.choices]
        sent_modules = {p["modulo"]: p for p in permissoes_data}

        for mod in all_modules:
            p_data = sent_modules.get(mod, {})
            is_admin = grupo.is_admin_padrao
            PermissaoModulo.objects.create(
                grupo=grupo,
                modulo=mod,
                pode_acessar_tela=p_data.get("pode_acessar_tela", is_admin),
                pode_visualizar_completo=p_data.get("pode_visualizar_completo", is_admin),
                pode_incluir=p_data.get("pode_incluir", is_admin),
                pode_alterar=p_data.get("pode_alterar", is_admin),
                pode_excluir=p_data.get("pode_excluir", is_admin),
            )

        return grupo

    def update(self, instance, validated_data):
        permissoes_data = validated_data.pop("permissoes", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if permissoes_data is not None:
            for p_item in permissoes_data:
                modulo_code = p_item.get("modulo")
                if not modulo_code:
                    continue
                PermissaoModulo.objects.update_or_create(
                    grupo=instance,
                    modulo=modulo_code,
                    defaults={
                        "pode_acessar_tela": p_item.get("pode_acessar_tela", True),
                        "pode_visualizar_completo": p_item.get("pode_visualizar_completo", True),
                        "pode_incluir": p_item.get("pode_incluir", False),
                        "pode_alterar": p_item.get("pode_alterar", False),
                        "pode_excluir": p_item.get("pode_excluir", False),
                    }
                )

        instance.refresh_from_db()
        return instance

class GrupoPermissaoSimpleSerializer(serializers.ModelSerializer):
    class Meta:
        model = GrupoPermissao
        fields = ["id", "nome", "descricao", "is_admin_padrao", "ativo"]

class UserProfileSerializer(serializers.ModelSerializer):
    role_display = serializers.CharField(source="get_role_display", read_only=True)
    fazendas_ids = serializers.PrimaryKeyRelatedField(many=True, read_only=True, source="fazendas")
    grupo = GrupoPermissaoSimpleSerializer(read_only=True)

    class Meta:
        model = UserProfile
        fields = [
            "id",
            "grupo",
            "role",
            "role_display",
            "ad_oid",
            "ad_upn",
            "cargo",
            "empresa_nome",
            "telefone",
            "departamento",
            "ativo",
            "fazendas_ids",
        ]

class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(read_only=True)
    nome_completo = serializers.SerializerMethodField()
    permissoes = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "nome_completo",
            "is_active",
            "is_staff",
            "is_superuser",
            "last_login",
            "date_joined",
            "profile",
            "permissoes",
        ]

    def get_nome_completo(self, obj):
        full = f"{obj.first_name} {obj.last_name}".strip()
        return full if full else obj.username

    def get_permissoes(self, obj):
        """Retorna mapa consolidado de permissões granulares por tela e cadastro."""
        perm_map = {}
        all_modules = [c[0] for c in ModuloSistema.choices]

        # Se for superuser ou Administrador Padrão, tem acesso total irrestrito
        profile = getattr(obj, "profile", None)
        is_full_admin = obj.is_superuser or (profile and profile.grupo and profile.grupo.is_admin_padrao)

        if is_full_admin:
            for m in all_modules:
                perm_map[m] = {
                    "pode_acessar_tela": True,
                    "pode_visualizar_completo": True,
                    "pode_incluir": True,
                    "pode_alterar": True,
                    "pode_excluir": True,
                }
            return perm_map

        if profile and profile.grupo:
            for perm in profile.grupo.permissoes.all():
                perm_map[perm.modulo] = {
                    "pode_acessar_tela": perm.pode_acessar_tela,
                    "pode_visualizar_completo": perm.pode_visualizar_completo,
                    "pode_incluir": perm.pode_incluir,
                    "pode_alterar": perm.pode_alterar,
                    "pode_excluir": perm.pode_excluir,
                }

        # Preenche módulos faltantes com falso por segurança
        for m in all_modules:
            if m not in perm_map:
                perm_map[m] = {
                    "pode_acessar_tela": False,
                    "pode_visualizar_completo": False,
                    "pode_incluir": False,
                    "pode_alterar": False,
                    "pode_excluir": False,
                }

        return perm_map

def get_default_group_for_role(role_name: str):
    """Localiza ou cria grupo equivalente para um papel de usuário."""
    name_map = {
        "ADMIN": "Administrador Geral",
        "GESTOR": "Gestor Agrícola",
        "OPERADOR": "Operador de Pivô",
        "CONSULTOR": "Auditor / Consulta",
    }
    target_name = name_map.get((role_name or "OPERADOR").upper(), "Operador de Pivô")
    group = GrupoPermissao.objects.filter(nome__iexact=target_name).first()
    if not group:
        group = GrupoPermissao.objects.create(
            nome=target_name,
            descricao=f"Grupo corporativo padrão para {target_name}",
            is_admin_padrao=((role_name or "").upper() == "ADMIN"),
            ativo=True
        )
    return group

class UserCreateSerializer(serializers.Serializer):
    """Cadastro corporativo integrado ao Active Directory (Microsoft 365) sem obrigatoriedade de senhas locais."""
    email = serializers.EmailField(required=True)
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True, default="")
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True, default="")
    username = serializers.CharField(max_length=150, required=False, allow_blank=True)
    password = serializers.CharField(max_length=128, required=False, allow_blank=True, write_only=True)
    grupo_id = serializers.UUIDField(required=False)
    role = serializers.ChoiceField(choices=UserProfile._meta.get_field("role").choices, required=False, default="OPERADOR")
    cargo = serializers.CharField(max_length=150, required=False, allow_blank=True, default="")
    departamento = serializers.CharField(max_length=100, required=False, allow_blank=True, default="Operações Agrícolas")
    empresa_nome = serializers.CharField(max_length=150, required=False, allow_blank=True, default="Grupo Farroupilha")
    telefone = serializers.CharField(max_length=30, required=False, allow_blank=True, default="")
    is_active = serializers.BooleanField(default=True)
    fazendas = serializers.ListField(child=serializers.UUIDField(), required=False, write_only=True)
    ad_oid = serializers.CharField(max_length=64, required=False, allow_blank=True, default="")
    ad_upn = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")

    def validate_email(self, value):
        val = value.strip().lower()
        if User.objects.filter(email__iexact=val).exists():
            raise serializers.ValidationError("Já existe um colaborador cadastrado com este e-mail.")
        return val

    def create(self, validated_data):
        from apps.pivots.models import Fazenda
        email = validated_data.get("email").strip().lower()
        username = validated_data.get("username", "").strip() or email.split("@")[0]
        password = validated_data.pop("password", None)

        base_username = username
        counter = 1
        while User.objects.filter(username__iexact=username).exists():
            username = f"{base_username}{counter}"
            counter += 1

        first_name = validated_data.get("first_name", "").strip()
        last_name = validated_data.get("last_name", "").strip()
        
        grupo_id = validated_data.get("grupo_id")
        role = validated_data.get("role", "OPERADOR")

        if grupo_id:
            grupo = GrupoPermissao.objects.filter(id=grupo_id).first()
        else:
            grupo = get_default_group_for_role(role)

        is_admin = bool(grupo and grupo.is_admin_padrao) or (role == "ADMIN")
        is_active = validated_data.get("is_active", True)
        fazendas_ids = validated_data.pop("fazendas", [])

        user = User.objects.create(
            username=username,
            email=email,
            first_name=first_name,
            last_name=last_name,
            is_active=is_active,
            is_staff=is_admin,
        )
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save()

        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.grupo = grupo
        profile.role = "ADMIN" if is_admin else role
        profile.cargo = validated_data.get("cargo", "")
        profile.departamento = validated_data.get("departamento", "Operações Agrícolas")
        profile.empresa_nome = validated_data.get("empresa_nome", "Grupo Farroupilha")
        profile.telefone = validated_data.get("telefone", "")
        profile.ad_oid = validated_data.get("ad_oid", "")
        profile.ad_upn = validated_data.get("ad_upn", email)
        profile.ativo = is_active
        profile.save()

        if fazendas_ids:
            fazendas = Fazenda.objects.filter(id__in=fazendas_ids)
            profile.fazendas.set(fazendas)

        user.refresh_from_db()
        return user

class UserUpdateSerializer(serializers.Serializer):
    """Atualização de cadastro corporativo sem necessidade de senhas locais."""
    email = serializers.EmailField(required=False)
    password = serializers.CharField(max_length=128, required=False, allow_blank=True, write_only=True)
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    grupo_id = serializers.UUIDField(required=False)
    role = serializers.ChoiceField(choices=UserProfile._meta.get_field("role").choices, required=False)
    cargo = serializers.CharField(max_length=150, required=False, allow_blank=True)
    departamento = serializers.CharField(max_length=100, required=False, allow_blank=True)
    empresa_nome = serializers.CharField(max_length=150, required=False, allow_blank=True)
    telefone = serializers.CharField(max_length=30, required=False, allow_blank=True)
    is_active = serializers.BooleanField(required=False)
    fazendas = serializers.ListField(child=serializers.UUIDField(), required=False, write_only=True)

    def update(self, instance, validated_data):
        from apps.pivots.models import Fazenda
        email = validated_data.get("email")
        password = validated_data.pop("password", None)

        if email:
            clean_email = email.strip().lower()
            if User.objects.filter(email__iexact=clean_email).exclude(id=instance.id).exists():
                raise serializers.ValidationError("Este e-mail corporativo já está em uso por outro usuário.")
            instance.email = clean_email

        if password:
            instance.set_password(password)

        if "first_name" in validated_data:
            instance.first_name = validated_data["first_name"]
        if "last_name" in validated_data:
            instance.last_name = validated_data["last_name"]
        if "is_active" in validated_data:
            instance.is_active = validated_data["is_active"]

        profile, _ = UserProfile.objects.get_or_create(user=instance)

        if "grupo_id" in validated_data:
            grupo = GrupoPermissao.objects.filter(id=validated_data["grupo_id"]).first()
            if grupo:
                profile.grupo = grupo
                instance.is_staff = grupo.is_admin_padrao
                profile.role = "ADMIN" if grupo.is_admin_padrao else "OPERADOR"
        elif "role" in validated_data:
            role = validated_data["role"]
            profile.role = role
            profile.grupo = get_default_group_for_role(role)
            if role == "ADMIN":
                instance.is_staff = True

        if "cargo" in validated_data:
            profile.cargo = validated_data["cargo"]
        if "departamento" in validated_data:
            profile.departamento = validated_data["departamento"]
        if "empresa_nome" in validated_data:
            profile.empresa_nome = validated_data["empresa_nome"]
        if "telefone" in validated_data:
            profile.telefone = validated_data["telefone"]
        if "is_active" in validated_data:
            profile.ativo = validated_data["is_active"]

        instance.save()
        profile.save()

        if "fazendas" in validated_data:
            fazendas = Fazenda.objects.filter(id__in=validated_data["fazendas"])
            profile.fazendas.set(fazendas)

        instance.refresh_from_db()
        return instance

class LoginRequestSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

class AzureLoginRequestSerializer(serializers.Serializer):
    """Requisição de autenticação Microsoft 365 / Azure Entra ID."""
    access_token = serializers.CharField(required=False, allow_blank=True)
    id_token = serializers.CharField(required=False, allow_blank=True)
    code = serializers.CharField(required=False, allow_blank=True)
    redirect_uri = serializers.CharField(required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True, help_text="Utilizado em testes locais de desenvolvimento")

class AuditLogSerializer(serializers.ModelSerializer):
    @extend_schema_field(serializers.CharField)
    def get_usuario_nome(self, obj):
        return obj.usuario.get_full_name() if obj.usuario else ""
    
    usuario_nome = serializers.SerializerMethodField()
    
    class Meta:
        model = AuditLog
        fields = ["id", "tabela", "entidade_id", "acao", "detalhes", "usuario", "usuario_nome", "ip_address", "criado_em"]
