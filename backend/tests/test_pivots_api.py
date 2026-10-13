import uuid
from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status
from apps.core.models import UserProfile, UserRole
from apps.pivots.models import Fazenda, Pivo
from apps.operations.models import RegistroIrrigacao

class SecurityAndIntegrationTestCase(TestCase):
    def setUp(self):
        # 1. Clientes com diferentes níveis de acesso
        self.anon_client = APIClient()

        # Usuário Administrador
        self.admin_user = User.objects.create_user(username="admin_auditoria", password="seguro_test_password", is_staff=True)
        UserProfile.objects.create(user=self.admin_user, role=UserRole.ADMIN)
        self.admin_client = APIClient()
        self.admin_client.force_authenticate(user=self.admin_user)

        # Usuário Operador de Campo
        self.operator_user = User.objects.create_user(username="operador_campo", password="seguro_test_password")
        UserProfile.objects.create(user=self.operator_user, role=UserRole.OPERADOR)
        self.operator_client = APIClient()
        self.operator_client.force_authenticate(user=self.operator_user)

        # 2. Dados de infraestrutura de teste
        self.fazenda = Fazenda.objects.create(
            nome="Fazenda Teste Integrado",
            codigo="FAZ-TEST",
            municipio="Rio Verde",
            uf="GO",
            latitude=-17.7915,
            longitude=-50.9192,
            area_total_ha=1500.0,
        )
        self.pivo = Pivo.objects.create(
            fazenda=self.fazenda,
            codigo="PIV-TEST-01",
            nome="Pivô Piloto de Testes",
            raio_metros=400.0,
            area_irrigada_ha=50.26,
            vazao_nominal_m3h=220.0,
            pressao_nominal_bar=3.5,
            status_operacional="PARADO",
            percentimetro_atual=100,
        )

    # -------------------------------------------------------------------------
    # TESTES DE SEGURANÇA E AUTENTICAÇÃO (ANÔNIMOS REJEITADOS)
    # -------------------------------------------------------------------------
    def test_healthcheck_accessible_anonymously_without_leaks(self):
        """Health check deve ser acessível publicamente com status seguro sem expor dados internos."""
        response = self.anon_client.get("/api/v1/health/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json(), {"status": "healthy"})

    def test_anonymous_request_cannot_list_pivots(self):
        """Requisição anônima NÃO pode listar pivôs centrais."""
        response = self.anon_client.get("/api/v1/pivots/pivos/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_anonymous_request_cannot_create_pivot(self):
        """Requisição anônima NÃO pode cadastrar pivôs centrais."""
        payload = {"fazenda": str(self.fazenda.id), "codigo": "PIV-HACK", "nome": "Hacker"}
        response = self.anon_client.post("/api/v1/pivots/pivos/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_anonymous_request_cannot_access_cockpit_summary(self):
        """Requisição anônima NÃO pode acessar o resumo de indicadores do Cockpit."""
        response = self.anon_client.get("/api/v1/operations/cockpit-resumo/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_anonymous_request_cannot_pull_sync(self):
        """Requisição anônima NÃO pode baixar o catálogo offline."""
        response = self.anon_client.get("/api/v1/sync/pull/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_anonymous_request_cannot_push_sync(self):
        """Requisição anônima NÃO pode despachar mutações no lote de sync."""
        response = self.anon_client.post("/api/v1/sync/push/", {"operations": []}, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    # -------------------------------------------------------------------------
    # TESTES DE AUTORIZAÇÃO GRANULAR (RBAC)
    # -------------------------------------------------------------------------
    def test_operator_cannot_create_structural_pivot(self):
        """Operador de campo NÃO possui permissão para cadastrar nova infraestrutura física."""
        payload = {
            "fazenda": str(self.fazenda.id),
            "codigo": "PIV-OPER-DENIED",
            "nome": "Tentativa Invalida",
            "raio_metros": 400.0,
            "area_irrigada_ha": 50.0,
            "vazao_nominal_m3h": 200.0,
            "pressao_nominal_bar": 3.0,
            "percentimetro_atual": 100,
            "status_operacional": "PARADO"
        }
        response = self.operator_client.post("/api/v1/pivots/pivos/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_or_manager_can_create_pivot(self):
        """Administrador ou Gestor pode cadastrar novo pivô central."""
        payload = {
            "fazenda": str(self.fazenda.id),
            "codigo": "PIV-TEST-02",
            "nome": "Pivô Secundário",
            "raio_metros": 450.0,
            "area_irrigada_ha": 63.6,
            "vazao_nominal_m3h": 260.0,
            "pressao_nominal_bar": 3.6,
            "percentimetro_atual": 80,
            "status_operacional": "PARADO"
        }
        response = self.admin_client.post("/api/v1/pivots/pivos/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.json()["codigo"], "PIV-TEST-02")
        self.assertTrue(Pivo.objects.filter(codigo="PIV-TEST-02").exists())

    def test_operator_can_send_quick_command_with_simulation_disclaimer(self):
        """
        Operador de campo pode enviar comando rápido operacional.
        A resposta deve identificar explicitamente que atua como simulação/apontamento de banco,
        sem acionamento direto de hardware físico de campo.
        """
        url = f"/api/v1/pivots/pivos/{self.pivo.id}/comando-rapido/"
        payload = {
            "status_operacional": "IRRIGANDO",
            "percentimetro_atual": 75,
            "sentido_rotacao": "HORARIO",
            "lamina_atual_mm": 8.2
        }
        response = self.operator_client.post(url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        data = response.json()
        self.assertEqual(data["status_operacional"], "IRRIGANDO")
        self.assertIn("_telemetria_info", data)
        self.assertFalse(data["_telemetria_info"]["integracao_fisica"])
        self.assertIsNone(data["_telemetria_info"]["confirmacao_hardware"])

    # -------------------------------------------------------------------------
    # TESTES DE SINCRONIZAÇÃO MOBILE E IDEMPOTÊNCIA
    # -------------------------------------------------------------------------
    def test_sync_push_idempotency_with_operator_token(self):
        """Sincronização em lote garante proteção contra duplicidade em reenvios de rede."""
        op_id = str(uuid.uuid4())
        batch_payload = {
            "client_device_id": "TEST-MOBILE-RUNNER",
            "operations": [
                {
                    "client_op_id": op_id,
                    "entity": "registro_irrigacao",
                    "action": "CREATE",
                    "occurred_at": "2026-10-11T12:00:00Z",
                    "payload": {
                        "pivo_id": str(self.pivo.id),
                        "percentimetro": 80,
                        "lamina_aplicada_mm": 6.5,
                        "sentido": "HORARIO",
                        "observacoes": "Apontamento offline de teste."
                    }
                }
            ]
        }

        # Primeiro envio: deve criar com sucesso
        res1 = self.operator_client.post("/api/v1/sync/push/", batch_payload, format="json")
        self.assertEqual(res1.status_code, status.HTTP_200_OK)
        data1 = res1.json()
        self.assertEqual(data1["results"][0]["status"], "SUCCESS")
        self.assertFalse(data1["results"][0]["idempotent"])
        self.assertEqual(RegistroIrrigacao.objects.filter(client_op_id=op_id).count(), 1)

        # Segundo envio idêntico (retransmissão por instabilidade): não pode duplicar registro!
        res2 = self.operator_client.post("/api/v1/sync/push/", batch_payload, format="json")
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        data2 = res2.json()
        self.assertEqual(data2["results"][0]["status"], "SUCCESS")
        self.assertTrue(data2["results"][0]["idempotent"])
        self.assertEqual(RegistroIrrigacao.objects.filter(client_op_id=op_id).count(), 1)

    def test_authenticated_cockpit_resumo(self):
        """Usuário autenticado obtém métricas operacionais consolidadas."""
        response = self.admin_client.get("/api/v1/operations/cockpit-resumo/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        indicadores = response.json()["indicadores"]
        self.assertIn("total_pivos", indicadores)
        self.assertGreaterEqual(indicadores["total_pivos"], 1)
