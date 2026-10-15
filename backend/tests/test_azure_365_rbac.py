import json
from unittest.mock import patch
from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status
from rest_framework.authtoken.models import Token
from apps.core.models import GrupoPermissao, PermissaoModulo, ModuloSistema, UserProfile, AuditLog

class Azure365AndRBACGranularTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

        # 1. Cria grupo Administrador Geral
        self.admin_group = GrupoPermissao.objects.create(
            nome="Administrador Geral",
            descricao="Acesso irrestrito a todos os recursos",
            is_admin_padrao=True,
            ativo=True
        )

        # 2. Cria grupo Operacional Restrito
        self.operador_group = GrupoPermissao.objects.create(
            nome="Operador de Pivô",
            descricao="Operações de irrigação e apontamentos",
            is_admin_padrao=False,
            ativo=True
        )
        # Permissões do operador:
        # Irrigação: pode acessar, visualizar completo, incluir e alterar, mas NÃO excluir
        PermissaoModulo.objects.create(
            grupo=self.operador_group,
            modulo=ModuloSistema.IRRIGACAO,
            pode_acessar_tela=True,
            pode_visualizar_completo=True,
            pode_incluir=True,
            pode_alterar=True,
            pode_excluir=False
        )
        # Planejamento: pode acessar tela e visualizar, mas NÃO incluir/alterar/excluir
        PermissaoModulo.objects.create(
            grupo=self.operador_group,
            modulo=ModuloSistema.PLANEJAMENTO,
            pode_acessar_tela=True,
            pode_visualizar_completo=False, # Visão resumida
            pode_incluir=False,
            pode_alterar=False,
            pode_excluir=False
        )
        # Usuários e Permissões: NÃO pode acessar tela
        PermissaoModulo.objects.create(
            grupo=self.operador_group,
            modulo=ModuloSistema.USUARIOS_GRUPOS,
            pode_acessar_tela=False,
            pode_visualizar_completo=False,
            pode_incluir=False,
            pode_alterar=False,
            pode_excluir=False
        )

        # 3. Usuário Administrador pré-cadastrado
        self.admin_user = User.objects.create_user(
            username="admin.farroupilha",
            email="admin@grupofarroupilha.com",
            first_name="Administrador",
            last_name="Geral",
            is_staff=True,
        )
        self.admin_user.set_unusable_password()
        self.admin_user.save()
        self.admin_profile = UserProfile.objects.create(
            user=self.admin_user,
            grupo=self.admin_group,
            role="ADMIN",
            cargo="Gerente de TI e Automação",
            departamento="Tecnologia da Informação",
        )
        self.admin_token = Token.objects.create(user=self.admin_user)

        # 4. Usuário Operador pré-cadastrado
        self.operador_user = User.objects.create_user(
            username="lucas.silva",
            email="lucas.silva@grupofarroupilha.com",
            first_name="Lucas",
            last_name="Silva",
        )
        self.operador_user.set_unusable_password()
        self.operador_user.save()
        self.operador_profile = UserProfile.objects.create(
            user=self.operador_user,
            grupo=self.operador_group,
            role="OPERADOR",
            cargo="Operador de Pivô Central",
            departamento="Operações Agrícolas",
        )

    # -------------------------------------------------------------------------
    # 1. REGRAS DE LOGIN AZURE 365: BARRAR NÃO CADASTRADOS & BLOQUEADOS NO AD
    # -------------------------------------------------------------------------
    def test_azure_login_unregistered_email_is_strictly_rejected(self):
        """
        Usuário com e-mail corporativo válido do domínio mas SEM pré-cadastro no Cockpit
        deve ser terminantemente barrado no login com 403 e NÃO ter conta criada.
        """
        unregistered_email = "novo.funcionario@grupofarroupilha.com"
        initial_user_count = User.objects.count()

        response = self.client.post("/api/v1/core/auth/azure/", {
            "email": unregistered_email
        })
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        data = response.json()
        self.assertEqual(data.get("code"), "USER_NOT_REGISTERED")
        self.assertIn("não possui pré-cadastro", data.get("detail"))

        # Confirma que NÃO houve autocadastro
        self.assertEqual(User.objects.count(), initial_user_count)
        self.assertFalse(User.objects.filter(email=unregistered_email).exists())

    def test_azure_login_registered_active_user_succeeds(self):
        """Usuário pré-cadastrado e ativo consegue login via 365 e recebe token e permissões."""
        response = self.client.post("/api/v1/core/auth/azure/", {
            "email": "lucas.silva@grupofarroupilha.com"
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn("token", data)
        self.assertEqual(data["user"]["email"], "lucas.silva@grupofarroupilha.com")
        self.assertEqual(data["user"]["profile"]["grupo"]["nome"], "Operador de Pivô")

        # Verifica matriz de permissões devolvida
        permissoes = data["user"]["permissoes"]
        self.assertTrue(permissoes["irrigacao"]["pode_acessar_tela"])
        self.assertTrue(permissoes["irrigacao"]["pode_incluir"])
        self.assertFalse(permissoes["irrigacao"]["pode_excluir"])
        self.assertFalse(permissoes["usuarios_grupos"]["pode_acessar_tela"])

    def test_azure_login_deactivated_user_in_cockpit_is_rejected(self):
        """Usuário desativado no Cockpit de Pivôs é barrado no login 365 com 403."""
        self.operador_user.is_active = False
        self.operador_user.save()

        response = self.client.post("/api/v1/core/auth/azure/", {
            "email": "lucas.silva@grupofarroupilha.com"
        })
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("desativada", response.json().get("detail", "").lower())

    @patch("apps.core.views.validate_user_access_token_with_graph")
    def test_azure_login_blocked_in_active_directory_is_rejected(self, mock_graph):
        """Se o usuário for desativado/bloqueado no Active Directory (accountEnabled=False), deve barrar no login."""
        mock_graph.return_value = {
            "valid": True,
            "email": "lucas.silva@grupofarroupilha.com",
            "accountEnabled": False, # BLOQUEADO NO AD
            "displayName": "Lucas Silva",
        }

        response = self.client.post("/api/v1/core/auth/azure/", {
            "access_token": "token-simulado-azure"
        })
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("bloqueado no active directory", response.json().get("detail", "").lower())

    # -------------------------------------------------------------------------
    # 2. CADASTRO DE USUÁRIO EXCLUSIVAMENTE AD 365 (SEM SENHA)
    # -------------------------------------------------------------------------
    def test_admin_creates_user_without_password_for_365(self):
        """Administrador cadastra usuário informando apenas e-mail, nome e grupo, sem senha."""
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Token {self.admin_token.key}")

        payload = {
            "email": "marcos.agronomo@grupofarroupilha.com",
            "first_name": "Marcos",
            "last_name": "Agrônomo",
            "grupo_id": str(self.operador_group.id),
            "cargo": "Consultor de Irrigação",
            "departamento": "Agronomia",
            "is_active": True,
        }
        response = client.post("/api/v1/core/users/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        self.assertEqual(data["email"], "marcos.agronomo@grupofarroupilha.com")
        self.assertEqual(data["first_name"], "Marcos")

        # Verifica que o usuário criado NÃO tem senha usável
        created_user = User.objects.get(email="marcos.agronomo@grupofarroupilha.com")
        self.assertFalse(created_user.has_usable_password())
        self.assertEqual(created_user.profile.grupo, self.operador_group)

    # -------------------------------------------------------------------------
    # 3. GESTÃO DE GRUPOS DE PERMISSÕES & MATRIZ GRANULAR
    # -------------------------------------------------------------------------
    def test_admin_creates_and_configures_permission_group(self):
        """Administrador cria novo grupo com permissões customizadas por módulo."""
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Token {self.admin_token.key}")

        payload = {
            "nome": "Supervisores de Campo",
            "descricao": "Supervisão operacional e relatórios técnicos",
            "is_admin_padrao": False,
            "ativo": True,
            "permissoes": [
                {
                    "modulo": "planejamento",
                    "pode_acessar_tela": True,
                    "pode_visualizar_completo": True,
                    "pode_incluir": True,
                    "pode_alterar": True,
                    "pode_excluir": False
                },
                {
                    "modulo": "fazendas",
                    "pode_acessar_tela": True,
                    "pode_visualizar_completo": True,
                    "pode_incluir": False,
                    "pode_alterar": False,
                    "pode_excluir": False
                }
            ]
        }
        res = client.post("/api/v1/core/grupos-permissao/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        grupo_id = res.json()["id"]

        # Recupera e verifica permissões gravadas
        grupo = GrupoPermissao.objects.get(id=grupo_id)
        perm_plan = grupo.permissoes.get(modulo="planejamento")
        self.assertTrue(perm_plan.pode_acessar_tela)
        self.assertTrue(perm_plan.pode_incluir)
        self.assertFalse(perm_plan.pode_excluir)

    def test_clone_permission_group(self):
        """Endpoint de clonar grupo cria cópia fiel com todas as permissões duplicadas."""
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Token {self.admin_token.key}")

        res = client.post(f"/api/v1/core/grupos-permissao/{self.operador_group.id}/clonar/")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        novo_grupo_id = res.json()["id"]

        novo_grupo = GrupoPermissao.objects.get(id=novo_grupo_id)
        self.assertIn("Cópia", novo_grupo.nome)
        self.assertEqual(novo_grupo.permissoes.count(), self.operador_group.permissoes.count())
