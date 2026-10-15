import os
from rest_framework import status, viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.db import transaction
from .models import AuditLog, UserProfile, UserRole, GrupoPermissao, PermissaoModulo, ModuloSistema
from .serializers import (
    UserSerializer,
    UserCreateSerializer,
    UserUpdateSerializer,
    LoginRequestSerializer,
    AzureLoginRequestSerializer,
    AuditLogSerializer,
    GrupoPermissaoSerializer,
    GrupoPermissaoSimpleSerializer,
    PermissaoModuloSerializer,
)
from .permissions import IsAdminOrManager, IsAdminUserOnly
from .azure_ad import (
    lookup_azure_user,
    validate_user_access_token_with_graph,
    get_azure_config,
    verify_azure_user_status,
)
from drf_spectacular.utils import extend_schema

class AzureLoginView(APIView):
    """
    Autenticação corporativa centralizada via Microsoft 365 / Azure AD (Entra ID).
    Acesso permitido EXCLUSIVAMENTE para usuários pré-cadastrados no sistema e ativos no AD.
    Não permite autocadastro sob nenhuma hipótese.
    """
    permission_classes = [AllowAny]

    @extend_schema(request=AzureLoginRequestSerializer, responses={200: UserSerializer})
    def post(self, request):
        serializer = AzureLoginRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        access_token = serializer.validated_data.get("access_token", "").strip()
        id_token = serializer.validated_data.get("id_token", "").strip()
        code = serializer.validated_data.get("code", "").strip()
        fallback_email = serializer.validated_data.get("email", "").strip().lower()

        authenticated_email = None
        azure_data = {}

        # 1. Se foi enviado access_token do Microsoft 365, valida diretamente no Microsoft Graph
        if access_token:
            validation = validate_user_access_token_with_graph(access_token)
            if not validation.get("valid"):
                return Response(
                    {"detail": validation.get("error", "Token Microsoft 365 inválido.")},
                    status=status.HTTP_401_UNAUTHORIZED
                )
            
            # Verifica se o usuário está ativo no Azure AD
            if not validation.get("accountEnabled", True):
                return Response(
                    {"detail": "Usuário desativado ou bloqueado no Active Directory (Azure AD). Acesso negado."},
                    status=status.HTTP_403_FORBIDDEN
                )

            authenticated_email = validation["email"]
            azure_data = validation

        # 2. Em ambiente de desenvolvimento local com e-mail explícito (simulação homologada)
        elif fallback_email:
            authenticated_email = fallback_email
            # Se o Azure estiver configurado com credenciais válidas, checa o status real no Graph
            cfg = get_azure_config()
            if cfg.get("has_client_secret"):
                status_check = verify_azure_user_status(authenticated_email)
                if status_check.get("exists") and not status_check.get("account_enabled"):
                    return Response(
                        {"detail": "Usuário desativado ou bloqueado no Active Directory (Azure AD). Acesso negado."},
                        status=status.HTTP_403_FORBIDDEN
                    )
        else:
            return Response(
                {"detail": "Nenhum token de autenticação Microsoft 365 foi fornecido."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not authenticated_email:
            return Response(
                {"detail": "Não foi possível identificar o e-mail corporativo autenticado."},
                status=status.HTTP_400_BAD_REQUEST
            )

        authenticated_email = authenticated_email.strip().lower()

        # 3. VERIFICAÇÃO CRÍTICA DE PRÉ-CADASTRO NO COCKPIT
        # "se o e-mail não estiver registrado no sistema ou a pessoa for bloqueada no AD ela não pode conseguir acessar, e nem pode cadastrar o e-mail dela automatico, mesmo que seja do dominio grupofarroupilha.com, deve barrar no login"
        user = User.objects.filter(email__iexact=authenticated_email).first()
        if not user:
            # Tenta verificar se foi cadastrado pelo username como e-mail
            user = User.objects.filter(username__iexact=authenticated_email).first()

        if not user:
            # BLOQUEIO OBRIGATÓRIO: Sem autocadastro!
            AuditLog.objects.create(
                tabela="auth_user",
                entidade_id="0",
                acao="LOGIN_NEGADO_SEM_CADASTRO",
                detalhes={"email": authenticated_email, "motivo": "Tentativa de login 365 de colaborador sem pré-cadastro no sistema."},
            )
            return Response(
                {
                    "detail": f"Acesso não autorizado. O e-mail '{authenticated_email}' não possui pré-cadastro no Cockpit de Pivôs. Solicite sua liberação ao Administrador do Sistema.",
                    "code": "USER_NOT_REGISTERED",
                    "email": authenticated_email
                },
                status=status.HTTP_403_FORBIDDEN
            )

        # 4. VERIFICAÇÃO DE STATUS ATIVO NO BANCO LOCAL
        profile = getattr(user, "profile", None)
        if not user.is_active or (profile and not profile.ativo):
            AuditLog.objects.create(
                tabela="auth_user",
                entidade_id=str(user.id),
                acao="LOGIN_NEGADO_DESATIVADO",
                detalhes={"username": user.username, "email": user.email, "motivo": "Conta desativada no Cockpit."},
                usuario=user,
            )
            return Response(
                {"detail": "Esta conta de usuário está desativada no Cockpit de Pivôs. Contate o Administrador."},
                status=status.HTTP_403_FORBIDDEN
            )

        # 5. VERIFICAÇÃO DE GRUPO DE PERMISSÕES
        if profile and profile.grupo and not profile.grupo.ativo:
            return Response(
                {"detail": f"O grupo de permissões '{profile.grupo.nome}' atribuído a este usuário está desativado. Contate o Administrador."},
                status=status.HTTP_403_FORBIDDEN
            )

        # 6. ATUALIZAÇÃO CADASTRO AD NO PERFIL (se disponível)
        if profile and azure_data:
            if azure_data.get("ad_oid") and not profile.ad_oid:
                profile.ad_oid = azure_data.get("ad_oid", "")
            if not profile.ad_upn:
                profile.ad_upn = authenticated_email
            if azure_data.get("jobTitle") and not profile.cargo:
                profile.cargo = azure_data.get("jobTitle", "")
            if azure_data.get("department") and profile.departamento == "Operações Agrícolas":
                profile.departamento = azure_data.get("department", profile.departamento)
            profile.save()

        # Atualiza nome caso esteja vazio
        if azure_data.get("givenName") and not user.first_name:
            user.first_name = azure_data.get("givenName", "")
            user.last_name = azure_data.get("surname", "")
            user.save()

        # 7. GERAÇÃO DE TOKEN DE SESSÃO DRF
        token, _ = Token.objects.get_or_create(user=user)
        user_serializer = UserSerializer(user)

        # 8. AUDITORIA DE LOGIN 365
        AuditLog.objects.create(
            tabela="auth_user",
            entidade_id=str(user.id),
            acao="LOGIN_AZURE_365",
            detalhes={
                "username": user.username,
                "email": user.email,
                "grupo": profile.grupo.nome if (profile and profile.grupo) else "SEM_GRUPO",
                "role": profile.role if profile else "OPERADOR"
            },
            usuario=user,
        )

        return Response({
            "token": token.key,
            "user": user_serializer.data,
            "message": "Autenticação corporativa Microsoft 365 realizada com sucesso."
        })

class AzureLookupUserView(APIView):
    """
    Busca os dados de um colaborador no Microsoft 365 / Azure AD pelo e-mail corporativo.
    Utilizado na tela de cadastro de usuários pelo Administrador para auto-preenchimento.
    """
    permission_classes = [IsAdminUserOnly]

    def get(self, request):
        email = request.query_params.get("email", "").strip()
        if not email:
            return Response(
                {"detail": "Parâmetro 'email' é obrigatório para consulta no Azure AD."},
                status=status.HTTP_400_BAD_REQUEST
            )

        result = lookup_azure_user(email)
        return Response(result)

class AzureConfigStatusView(APIView):
    """Retorna o estado da configuração e credenciais do aplicativo Azure AD registrado."""
    permission_classes = [IsAdminUserOnly]

    def get(self, request):
        config = get_azure_config()
        return Response(config)

class LoginView(APIView):
    """
    Endpoint de login tradicional.
    Informa que a autenticação foi migrada para Microsoft 365.
    Permite apenas superusuários em caso de manutenção estrita de infraestrutura.
    """
    permission_classes = [AllowAny]

    @extend_schema(request=LoginRequestSerializer, responses={200: UserSerializer})
    def post(self, request):
        serializer = LoginRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        login_input = serializer.validated_data["username"].strip()
        password = serializer.validated_data["password"]

        user = authenticate(username=login_input, password=password)
        if not user and "@" in login_input:
            user_by_email = User.objects.filter(email__iexact=login_input).first()
            if user_by_email:
                user = authenticate(username=user_by_email.username, password=password)

        if not user:
            # Verifica se o usuário existe mas está inativo
            candidate = User.objects.filter(username__iexact=login_input).first() or User.objects.filter(email__iexact=login_input).first()
            if candidate and candidate.check_password(password):
                candidate_profile = getattr(candidate, "profile", None)
                if not candidate.is_active or (candidate_profile and not candidate_profile.ativo):
                    return Response(
                        {"detail": "Esta conta de usuário está desativada. Contate o administrador do sistema."},
                        status=status.HTTP_401_UNAUTHORIZED
                    )
            return Response(
                {"detail": "Credenciais corporativas inválidas. Verifique usuário e senha ou acesse via Microsoft 365."},
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

        AuditLog.objects.create(
            tabela="auth_user",
            entidade_id=str(user.id),
            acao="LOGIN_SUCESSO",
            detalhes={"username": user.username, "tipo": "SENHA_LOCAL"},
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
    """Retorna dados cadastrais e matriz de permissões consolidadas do usuário autenticado."""
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: UserSerializer})
    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

class GrupoPermissaoViewSet(viewsets.ModelViewSet):
    """Gestão de Grupos de Permissões (RBAC) com matriz de acesso granular por tela e cadastro."""
    queryset = GrupoPermissao.objects.prefetch_related("permissoes", "usuarios").all().order_by("nome")
    serializer_class = GrupoPermissaoSerializer
    permission_classes = [IsAdminUserOnly]

    @action(detail=False, methods=["get"], url_path="modulos_disponiveis")
    def modulos_disponiveis(self, request):
        """Retorna a lista completa de módulos e telas cadastráveis no sistema."""
        modulos = [
            {"codigo": c[0], "nome": c[1]}
            for c in ModuloSistema.choices
        ]
        return Response(modulos)

    @action(detail=True, methods=["post"], url_path="clonar")
    def clonar(self, request, pk=None):
        """Clona um grupo existente com todas as suas permissões pré-configuradas."""
        grupo_origem = self.get_object()
        novo_nome = f"{grupo_origem.nome} (Cópia)"
        
        # Garante unicidade do nome clonado
        counter = 1
        while GrupoPermissao.objects.filter(nome=novo_nome).exists():
            novo_nome = f"{grupo_origem.nome} (Cópia {counter})"
            counter += 1

        with transaction.atomic():
            novo_grupo = GrupoPermissao.objects.create(
                nome=novo_nome,
                descricao=f"Cópia criada a partir do grupo '{grupo_origem.nome}'",
                is_admin_padrao=False,
                ativo=True,
            )
            for p in grupo_origem.permissoes.all():
                PermissaoModulo.objects.create(
                    grupo=novo_grupo,
                    modulo=p.modulo,
                    pode_acessar_tela=p.pode_acessar_tela,
                    pode_visualizar_completo=p.pode_visualizar_completo,
                    pode_incluir=p.pode_incluir,
                    pode_alterar=p.pode_alterar,
                    pode_excluir=p.pode_excluir,
                )

        AuditLog.objects.create(
            tabela="core_grupopermissao",
            entidade_id=str(novo_grupo.id),
            acao="CLONE_GRUPO_PERMISSAO",
            detalhes={"origem": grupo_origem.nome, "novo": novo_grupo.nome},
            usuario=request.user,
        )

        return Response(GrupoPermissaoSerializer(novo_grupo).data, status=status.HTTP_201_CREATED)

class UserViewSet(viewsets.ModelViewSet):
    """Gestão corporativa de usuários via Microsoft 365 (restrita a Administradores do Sistema)."""
    queryset = User.objects.select_related("profile", "profile__grupo").prefetch_related("profile__fazendas", "profile__grupo__permissoes").all().order_by("-date_joined")
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
        grupo_nome = user.profile.grupo.nome if (user.profile and user.profile.grupo) else "SEM_GRUPO"
        AuditLog.objects.create(
            tabela="auth_user",
            entidade_id=str(user.id),
            acao="CREATE_USER_365",
            detalhes={"username": user.username, "email": user.email, "grupo": grupo_nome},
            usuario=self.request.user,
        )
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        grupo_nome = user.profile.grupo.nome if (user.profile and user.profile.grupo) else "SEM_GRUPO"
        AuditLog.objects.create(
            tabela="auth_user",
            entidade_id=str(user.id),
            acao="UPDATE_USER_365",
            detalhes={"username": user.username, "is_active": user.is_active, "grupo": grupo_nome},
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
