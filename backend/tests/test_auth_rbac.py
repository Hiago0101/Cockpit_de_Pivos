import json
from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status
from rest_framework.authtoken.models import Token
from apps.core.models import UserProfile, UserRole, AuditLog
from apps.pivots.models import Fazenda, Pivo

class AuthAndRBACTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

        # 1. Usuário Administrador
        self.admin_user = User.objects.create_user(
            username="admin_rbac",
            email="admin.rbac@cockpit.com.br",
            password="StrongPassword123!",
            first_name="Admin",
            last_name="Sistema",
            is_staff=True,
        )
        self.admin_profile = UserProfile.objects.create(
            user=self.admin_user,
            role=UserRole.ADMIN,
            departamento="Diretor de Tecnologia",
            telefone="(64) 99999-1001",
        )
        self.admin_token = Token.objects.create(user=self.admin_user)

        # 2. Usuário Gestor
        self.gestor_user = User.objects.create_user(
            username="gestor_fazenda",
            email="gestor@cockpit.com.br",
            password="StrongPassword123!",
            first_name="Carlos",
            last_name="Gestor",
        )
        self.gestor_profile = UserProfile.objects.create(
            user=self.gestor_user,
            role=UserRole.GESTOR,
            departamento="Gerência Operacional",
            telefone="(64) 99999-1002",
        )
        self.gestor_token = Token.objects.create(user=self.gestor_user)

        # 3. Usuário Operador de Campo
        self.operador_user = User.objects.create_user(
            username="operador_campo",
            email="operador@cockpit.com.br",
            password="StrongPassword123!",
            first_name="João",
            last_name="Operador",
        )
        self.operador_profile = UserProfile.objects.create(
            user=self.operador_user,
            role=UserRole.OPERADOR,
            departamento="Operações de Campo",
            telefone="(64) 99999-1003",
        )
        self.operador_token = Token.objects.create(user=self.operador_user)

        # 4. Usuário Consultor
        self.consultor_user = User.objects.create_user(
            username="consultor_agro",
            email="consultor@cockpit.com.br",
            password="StrongPassword123!",
            first_name="Mariana",
            last_name="Consultora",
        )
        self.consultor_profile = UserProfile.objects.create(
            user=self.consultor_user,
            role=UserRole.CONSULTOR,
            departamento="Consultoria Hídrica",
            telefone="(64) 99999-1004",
        )
        self.consultor_token = Token.objects.create(user=self.consultor_user)

        # 5. Fazendas e Pivôs de teste
        self.fazenda_a = Fazenda.objects.create(
            nome="Fazenda Alfa",
            codigo="FAZ-ALFA",
            municipio="Rio Verde",
            uf="GO",
            area_total_ha=1000.0,
        )
        self.fazenda_b = Fazenda.objects.create(
            nome="Fazenda Beta",
            codigo="FAZ-BETA",
            municipio="Jataí",
            uf="GO",
            area_total_ha=2000.0,
        )

        self.pivo_a = Pivo.objects.create(
            fazenda=self.fazenda_a,
            codigo="PIV-A01",
            nome="Pivô Alfa 01",
            raio_metros=350.0,
            area_irrigada_ha=38.48,
            vazao_nominal_m3h=180.0,
            pressao_nominal_bar=3.2,
        )
        self.pivo_b = Pivo.objects.create(
            fazenda=self.fazenda_b,
            codigo="PIV-B01",
            nome="Pivô Beta 01",
            raio_metros=400.0,
            area_irrigada_ha=50.26,
            vazao_nominal_m3h=210.0,
            pressao_nominal_bar=3.5,
        )

    # -------------------------------------------------------------------------
    # 1. LOGIN VÁLIDO E INVÁLIDO
    # -------------------------------------------------------------------------
    def test_login_valid_with_username(self):
        """Autenticação com username válido retorna Token e dados do usuário com role."""
        response = self.client.post("/api/v1/core/auth/login/", {
            "username": "admin_rbac",
            "password": "StrongPassword123!",
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn("token", data)
        self.assertEqual(data["user"]["username"], "admin_rbac")
        self.assertEqual(data["user"]["profile"]["role"], "ADMIN")

    def test_login_valid_with_email(self):
        """Autenticação com e-mail corporativo válido retorna Token e perfil."""
        response = self.client.post("/api/v1/core/auth/login/", {
            "username": "gestor@cockpit.com.br",
            "password": "StrongPassword123!",
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn("token", data)
        self.assertEqual(data["user"]["username"], "gestor_fazenda")
        self.assertEqual(data["user"]["profile"]["role"], "GESTOR")

    def test_login_invalid_password_returns_401(self):
        """Tentativa de login com senha incorreta é rejeitada com 401."""
        response = self.client.post("/api/v1/core/auth/login/", {
            "username": "admin_rbac",
            "password": "SenhaCompletamenteIncorreta!",
        })
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn("detail", response.json())

    def test_login_nonexistent_user_returns_401(self):
        """Tentativa de login com usuário inexistente é rejeitada com 401."""
        response = self.client.post("/api/v1/core/auth/login/", {
            "username": "usuario_fantasma",
            "password": "QualquerSenha!",
        })
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_login_inactive_user_rejected_with_401(self):
        """Contas desativadas têm login rejeitado com 401."""
        self.operador_user.is_active = False
        self.operador_user.save()

        response = self.client.post("/api/v1/core/auth/login/", {
            "username": "operador_campo",
            "password": "StrongPassword123!",
        })
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn("desativada", response.json()["detail"].lower())

    # -------------------------------------------------------------------------
    # 2. LOGOUT E REVOGAÇÃO DE SESSÃO
    # -------------------------------------------------------------------------
    def test_logout_revokes_token(self):
        """Logout revoga o token de autenticação no backend, invalidando requisições posteriores."""
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Token {self.operador_token.key}")

        # Requisição inicial funciona
        me_resp = client.get("/api/v1/core/auth/me/")
        self.assertEqual(me_resp.status_code, status.HTTP_200_OK)

        # Executa logout
        logout_resp = client.post("/api/v1/core/auth/logout/")
        self.assertEqual(logout_resp.status_code, status.HTTP_200_OK)

        # O mesmo token agora deve ser rejeitado com 401
        after_resp = client.get("/api/v1/core/auth/me/")
        self.assertEqual(after_resp.status_code, status.HTTP_401_UNAUTHORIZED)

    # -------------------------------------------------------------------------
    # 3. ACESSO ANÔNIMO BLOQUEADO A ENDPOINTS PRIVADOS
    # -------------------------------------------------------------------------
    def test_anonymous_access_blocked_from_private_endpoints(self):
        """Usuários não autenticados recebem 401 em todas as rotas privadas da API."""
        anon = APIClient()
        endpoints = [
            ("GET", "/api/v1/core/auth/me/"),
            ("GET", "/api/v1/core/users/"),
            ("GET", "/api/v1/pivots/pivos/"),
            ("POST", "/api/v1/pivots/pivos/"),
            ("GET", "/api/v1/pivots/fazendas/"),
            ("GET", "/api/v1/operations/irrigacoes/"),
            ("GET", "/api/v1/sync/pull/"),
            ("POST", "/api/v1/sync/push/"),
        ]

        for method, endpoint in endpoints:
            if method == "GET":
                res = anon.get(endpoint)
            else:
                res = anon.post(endpoint, {}, format="json")
            self.assertEqual(
                res.status_code,
                status.HTTP_401_UNAUTHORIZED,
                f"Endpoint {endpoint} deveria bloquear anônimos com 401, mas retornou {res.status_code}",
            )

    # -------------------------------------------------------------------------
    # 4. CONTROLE DE ACESSO RBAC (PERMISSÕES INSUFICIENTES)
    # -------------------------------------------------------------------------
    def test_non_admin_users_cannot_access_user_management(self):
        """Gestores, Operadores e Consultores são bloqueados com 403 do endpoint de administração de usuários."""
        for user_token, role_name in [
            (self.gestor_token, "GESTOR"),
            (self.operador_token, "OPERADOR"),
            (self.consultor_token, "CONSULTOR"),
        ]:
            client = APIClient()
            client.credentials(HTTP_AUTHORIZATION=f"Token {user_token.key}")

            # Bloqueio de listagem
            list_res = client.get("/api/v1/core/users/")
            self.assertEqual(
                list_res.status_code,
                status.HTTP_403_FORBIDDEN,
                f"Perfil {role_name} deveria receber 403 em /core/users/, mas recebeu {list_res.status_code}",
            )

            # Bloqueio de criação
            create_res = client.post("/api/v1/core/users/", {
                "username": "hacker_user",
                "email": "hacker@test.com",
                "password": "Password123!",
                "role": "ADMIN",
            })
            self.assertEqual(
                create_res.status_code,
                status.HTTP_403_FORBIDDEN,
                f"Perfil {role_name} não pode criar usuários",
            )

    # -------------------------------------------------------------------------
    # 5. ADMINISTRAÇÃO COMPLETA DE USUÁRIOS PELO ADMINISTRADOR
    # -------------------------------------------------------------------------
    def test_admin_can_manage_users(self):
        """Administrador tem permissão total para listar, criar, editar e desativar usuários."""
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Token {self.admin_token.key}")

        # 1. Listagem
        list_res = client.get("/api/v1/core/users/")
        self.assertEqual(list_res.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(list_res.json()), 4)

        # 2. Criação
        new_user_data = {
            "username": "novo_tecnico",
            "email": "tecnico@agro.com.br",
            "password": "SenhaSegura456!",
            "first_name": "Marcos",
            "last_name": "Sousa",
            "role": "OPERADOR",
            "departamento": "Técnico Agrícola",
            "telefone": "(64) 99999-5555",
            "is_active": True,
            "fazendas": [str(self.fazenda_a.id)],
        }
        create_res = client.post("/api/v1/core/users/", new_user_data, format="json")
        self.assertEqual(create_res.status_code, status.HTTP_201_CREATED)
        created_id = create_res.json()["id"]

        # 3. Atualização
        update_res = client.patch(f"/api/v1/core/users/{created_id}/", {
            "departamento": "Técnico Sênior",
            "role": "GESTOR",
        }, format="json")
        self.assertEqual(update_res.status_code, status.HTTP_200_OK)
        self.assertEqual(update_res.json()["profile"]["role"], "GESTOR")
        self.assertEqual(update_res.json()["profile"]["departamento"], "Técnico Sênior")

        # 4. Alternar status (toggle ativo)
        toggle_res = client.post(f"/api/v1/core/users/{created_id}/toggle_ativo/")
        self.assertEqual(toggle_res.status_code, status.HTTP_200_OK)
        self.assertFalse(toggle_res.json()["is_active"])

    # -------------------------------------------------------------------------
    # 6. ESCOPO DE DADOS POR FAZENDA (FARM-LEVEL SCOPING)
    # -------------------------------------------------------------------------
    def test_farm_scoping_for_authorized_users(self):
        """Usuário comum só acessa fazendas e pivôs aos quais possui autorização expressa."""
        # Vincula Operador apenas à Fazenda Alfa
        self.operador_profile.fazendas.add(self.fazenda_a)

        op_client = APIClient()
        op_client.credentials(HTTP_AUTHORIZATION=f"Token {self.operador_token.key}")

        # Consulta Fazendas
        fazendas_resp = op_client.get("/api/v1/pivots/fazendas/")
        self.assertEqual(fazendas_resp.status_code, status.HTTP_200_OK)
        fazendas_data = fazendas_resp.json()
        fazendas = fazendas_data.get("results", fazendas_data) if isinstance(fazendas_data, dict) else fazendas_data
        fazenda_ids = [str(f["id"]) for f in fazendas]
        self.assertIn(str(self.fazenda_a.id), fazenda_ids)
        self.assertNotIn(str(self.fazenda_b.id), fazenda_ids)

        # Consulta Pivôs
        pivos_resp = op_client.get("/api/v1/pivots/pivos/")
        self.assertEqual(pivos_resp.status_code, status.HTTP_200_OK)
        pivos_data = pivos_resp.json()
        pivos = pivos_data.get("results", pivos_data) if isinstance(pivos_data, dict) else pivos_data
        pivo_ids = [str(p["id"]) for p in pivos]
        self.assertIn(str(self.pivo_a.id), pivo_ids)
        self.assertNotIn(str(self.pivo_b.id), pivo_ids)

        # Administrador enxerga ambas
        admin_client = APIClient()
        admin_client.credentials(HTTP_AUTHORIZATION=f"Token {self.admin_token.key}")
        admin_pivos_data = admin_client.get("/api/v1/pivots/pivos/").json()
        admin_pivos = admin_pivos_data.get("results", admin_pivos_data) if isinstance(admin_pivos_data, dict) else admin_pivos_data
        admin_pivo_ids = [str(p["id"]) for p in admin_pivos]
        self.assertIn(str(self.pivo_a.id), admin_pivo_ids)
        self.assertIn(str(self.pivo_b.id), admin_pivo_ids)

    # -------------------------------------------------------------------------
    # 7. AUDITORIA DE SEGURANÇA E ACESSOS
    # -------------------------------------------------------------------------
    def test_audit_log_records_login_and_actions(self):
        """Verifica se as ações sensíveis são gravadas no modelo AuditLog."""
        initial_logs = AuditLog.objects.count()

        # Login gera log
        self.client.post("/api/v1/core/auth/login/", {
            "username": "admin_rbac",
            "password": "StrongPassword123!",
        })
        self.assertGreater(AuditLog.objects.count(), initial_logs)

        # Confirma existência de log de LOGIN_SUCESSO
        login_log = AuditLog.objects.filter(acao="LOGIN_SUCESSO", usuario=self.admin_user).first()
        self.assertIsNotNone(login_log)
