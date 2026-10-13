from rest_framework import serializers
from drf_spectacular.utils import extend_schema_field
from django.contrib.auth.models import User
from .models import UserProfile, AuditLog

class UserProfileSerializer(serializers.ModelSerializer):
    role_display = serializers.CharField(source="get_role_display", read_only=True)
    fazendas_ids = serializers.PrimaryKeyRelatedField(many=True, read_only=True, source="fazendas")

    class Meta:
        model = UserProfile
        fields = ["id", "role", "role_display", "telefone", "departamento", "ativo", "fazendas_ids"]

class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(read_only=True)
    nome_completo = serializers.SerializerMethodField()
    
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
            "profile"
        ]

    def get_nome_completo(self, obj):
        full = f"{obj.first_name} {obj.last_name}".strip()
        return full if full else obj.username

class UserCreateSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField(required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, min_length=6)
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    role = serializers.ChoiceField(choices=UserProfile._meta.get_field("role").choices, default="OPERADOR")
    telefone = serializers.CharField(max_length=30, required=False, allow_blank=True)
    departamento = serializers.CharField(max_length=100, required=False, allow_blank=True)
    is_active = serializers.BooleanField(default=True)
    fazendas = serializers.ListField(child=serializers.UUIDField(), required=False, write_only=True)

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("Este nome de usuário já está em uso.")
        return value

    def create(self, validated_data):
        from apps.pivots.models import Fazenda
        password = validated_data.pop("password")
        role = validated_data.pop("role", "OPERADOR")
        telefone = validated_data.pop("telefone", "")
        departamento = validated_data.pop("departamento", "Operações Agrícolas")
        is_active = validated_data.pop("is_active", True)
        fazendas_ids = validated_data.pop("fazendas", [])

        user = User.objects.create(
            username=validated_data.get("username"),
            email=validated_data.get("email", ""),
            first_name=validated_data.get("first_name", ""),
            last_name=validated_data.get("last_name", ""),
            is_active=is_active,
            is_staff=(role == "ADMIN"),
        )
        user.set_password(password)
        user.save()

        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.role = role
        profile.telefone = telefone
        profile.departamento = departamento
        profile.ativo = is_active
        profile.save()

        if fazendas_ids:
            fazendas = Fazenda.objects.filter(id__in=fazendas_ids)
            profile.fazendas.set(fazendas)

        user.refresh_from_db()
        return user

class UserUpdateSerializer(serializers.Serializer):
    email = serializers.EmailField(required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, required=False, allow_blank=True, min_length=6)
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    role = serializers.ChoiceField(choices=UserProfile._meta.get_field("role").choices, required=False)
    telefone = serializers.CharField(max_length=30, required=False, allow_blank=True)
    departamento = serializers.CharField(max_length=100, required=False, allow_blank=True)
    is_active = serializers.BooleanField(required=False)
    fazendas = serializers.ListField(child=serializers.UUIDField(), required=False, write_only=True)

    def update(self, instance, validated_data):
        from apps.pivots.models import Fazenda
        password = validated_data.pop("password", None)
        role = validated_data.pop("role", None)
        telefone = validated_data.pop("telefone", None)
        departamento = validated_data.pop("departamento", None)
        is_active = validated_data.pop("is_active", None)
        fazendas_ids = validated_data.pop("fazendas", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if password:
            instance.set_password(password)

        if is_active is not None:
            instance.is_active = is_active

        if role is not None and role == "ADMIN":
            instance.is_staff = True

        instance.save()

        profile, _ = UserProfile.objects.get_or_create(user=instance)
        if role is not None:
            profile.role = role
        if telefone is not None:
            profile.telefone = telefone
        if departamento is not None:
            profile.departamento = departamento
        if is_active is not None:
            profile.ativo = is_active
        profile.save()

        if fazendas_ids is not None:
            fazendas = Fazenda.objects.filter(id__in=fazendas_ids)
            profile.fazendas.set(fazendas)

        instance.refresh_from_db()
        return instance

class LoginRequestSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

class AuditLogSerializer(serializers.ModelSerializer):
    @extend_schema_field(serializers.CharField)
    def get_usuario_nome(self, obj):
        return obj.usuario.get_full_name() if obj.usuario else ""
    
    usuario_nome = serializers.SerializerMethodField()
    
    class Meta:
        model = AuditLog
        fields = ["id", "tabela", "entidade_id", "acao", "detalhes", "usuario", "usuario_nome", "ip_address", "criado_em"]
