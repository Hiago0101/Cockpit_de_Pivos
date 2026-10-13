from rest_framework import status, viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from .models import AuditLog, UserProfile, UserRole
from .serializers import (
    UserSerializer,
    UserCreateSerializer,
    UserUpdateSerializer,
    LoginRequestSerializer,
    AuditLogSerializer,
)
from .permissions import IsAdminOrManager, IsAdminUserOnly
from drf_spectacular.utils import extend_schema

class LoginView(APIView):
    """Autenticação de usuários corporativos com suporte a username ou e-mail."""
    permission_classes = [AllowAny]

    @extend_schema(request=LoginRequestSerializer, responses={200: UserSerializer})
    def post(self, request):
        serializer = LoginRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        login_input = serializer.validated_data["username"].strip()
        password = serializer.validated_data["password"]
        
        # Tenta autenticar diretamente por username
        user = authenticate(username=login_input, password=password)
        
        # Se não autenticou, tenta localizar por e-mail
        if not user and "@" in login_input:
            user_by_email = User.objects.filter(email__iexact=login_input).first()
            if user_by_email:
                user = authenticate(username=user_by_email.username, password=password)

        if not user:
            # Verifica se o usuário existe com a senha correta mas está desativado
            candidate = User.objects.filter(username__iexact=login_input).first()
            if not candidate and "@" in login_input:
                candidate = User.objects.filter(email__iexact=login_input).first()
            if candidate and candidate.check_password(password):
                candidate_profile = getattr(candidate, "profile", None)
                if not candidate.is_active or (candidate_profile and not candidate_profile.ativo):
                    return Response(
                        {"detail": "Esta conta de usuário está desativada. Contate o administrador do sistema."},
                        status=status.HTTP_401_UNAUTHORIZED
                    )
            return Response(
                {"detail": "Credenciais corporativas inválidas. Verifique usuário e senha."},
                status=status.HTTP_401_UNAUTHORIZED
            )

        # Validação de conta ativa
        profile = getattr(user, "profile", None)
        if not user.is_active or (profile and not profile.ativo):
            return Response(
                {"detail": "Esta conta de usuário está desativada. Contate o administrador do sistema."},
                status=status.HTTP_401_UNAUTHORIZED
            )
            
        token, _ = Token.objects.get_or_create(user=user)
        user_serializer = UserSerializer(user)
        
        # Auditoria de login
        AuditLog.objects.create(
            tabela="auth_user",
            entidade_id=str(user.id),
            acao="LOGIN_SUCESSO",
            detalhes={"username": user.username, "role": profile.role if profile else "OPERADOR"},
            usuario=user,
        )

        return Response({
            "token": token.key,
            "user": user_serializer.data,
            "message": "Autenticação corporativa realizada com sucesso."
        })

class LogoutView(APIView):
    """Encerra a sessão corporativa e revoga o token de acesso no servidor."""
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: dict})
    def post(self, request):
        user = request.user
        Token.objects.filter(user=user).delete()
        
        AuditLog.objects.create(
            tabela="auth_user",
            entidade_id=str(user.id),
            acao="LOGOUT",
            detalhes={"username": user.username},
            usuario=user,
        )

        return Response({"detail": "Sessão encerrada e token revogado com sucesso."})

class MeView(APIView):
    """Retorna dados cadastrais e permissões do usuário atualmente autenticado."""
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: UserSerializer})
    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

class UserViewSet(viewsets.ModelViewSet):
    """Gestão corporativa de usuários (restrita a Administradores do Sistema)."""
    queryset = User.objects.select_related("profile").prefetch_related("profile__fazendas").all().order_by("-date_joined")
    permission_classes = [IsAdminUserOnly]

    def get_serializer_class(self):
        if self.action == "create":
            return UserCreateSerializer
        if self.action in ["update", "partial_update"]:
            return UserUpdateSerializer
        return UserSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        AuditLog.objects.create(
            tabela="auth_user",
            entidade_id=str(user.id),
            acao="CREATE_USER",
            detalhes={"username": user.username, "email": user.email, "role": getattr(user.profile, "role", "OPERADOR")},
            usuario=self.request.user,
        )
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        AuditLog.objects.create(
            tabela="auth_user",
            entidade_id=str(user.id),
            acao="UPDATE_USER",
            detalhes={"username": user.username, "is_active": user.is_active, "role": getattr(user.profile, "role", "OPERADOR")},
            usuario=self.request.user,
        )
        return Response(UserSerializer(user).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="toggle_ativo")
    def toggle_ativo(self, request, pk=None):
        """Ativa ou desativa a conta de um usuário (não permite auto-desativação)."""
        target_user = self.get_object()
        
        if target_user.id == request.user.id:
            return Response(
                {"detail": "Não é permitido desativar a própria conta autenticada."},
                status=status.HTTP_400_BAD_REQUEST
            )

        new_status = not target_user.is_active
        target_user.is_active = new_status
        target_user.save()

        profile, _ = UserProfile.objects.get_or_create(user=target_user)
        profile.ativo = new_status
        profile.save()

        AuditLog.objects.create(
            tabela="auth_user",
            entidade_id=str(target_user.id),
            acao="TOGGLE_USER_ATIVO",
            detalhes={"username": target_user.username, "novo_status": new_status},
            usuario=request.user,
        )

        return Response({
            "id": target_user.id,
            "username": target_user.username,
            "is_active": target_user.is_active,
            "message": f"Usuário {'ativado' if new_status else 'desativado'} com sucesso."
        })

class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """Trilha de auditoria das operações executadas no sistema (restrita a gestores/admins)."""
    queryset = AuditLog.objects.all()
    serializer_class = AuditLogSerializer
    permission_classes = [IsAdminOrManager]
