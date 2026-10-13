import uuid
from datetime import date, timedelta
from decimal import Decimal
from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status

from django.utils import timezone

from apps.core.models import UserProfile, UserRole, AuditLog
from apps.pivots.models import Empresa, Fazenda, Talhao, Pivo
from apps.operations.models import Cultura, Safra, PlanoOperacional, RegistroIrrigacao


class PlanejamentoAgricolaTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

        # 1. Usuários com papéis distintos (RBAC)
        self.admin_user = User.objects.create_user(username="admin_agro", password="adminpassword123")
        UserProfile.objects.create(user=self.admin_user, role=UserRole.ADMIN)

        self.gestor_user = User.objects.create_user(username="gestor_agro", password="gestorpassword123")
        self.gestor_profile = UserProfile.objects.create(user=self.gestor_user, role=UserRole.GESTOR)

        self.operador_user = User.objects.create_user(username="operador_agro", password="operadorpassword123")
        self.operador_profile = UserProfile.objects.create(user=self.operador_user, role=UserRole.OPERADOR)

        self.consultor_user = User.objects.create_user(username="consultor_agro", password="consultorpassword123")
        UserProfile.objects.create(user=self.consultor_user, role=UserRole.CONSULTOR)

        # 2. Estrutura Agrícola (Empresas, Fazendas, Talhões, Pivôs)
        self.empresa = Empresa.objects.create(nome="Agropecuária Teste S.A.", cnpj="11.222.333/0001-44")

        self.fazenda1 = Fazenda.objects.create(
            empresa=self.empresa,
            codigo="FAZ-T1",
            nome="Fazenda Pioneira",
            municipio="Rio Verde",
            uf="GO",
            area_total_ha=Decimal("1500.00")
        )

        self.fazenda2 = Fazenda.objects.create(
            empresa=self.empresa,
            codigo="FAZ-T2",
            nome="Fazenda Alvorada",
            municipio="Jataí",
            uf="GO",
            area_total_ha=Decimal("2000.00")
        )

        # Gestor só tem acesso à Fazenda 1
        self.gestor_profile.fazendas.add(self.fazenda1)

        self.talhao1 = Talhao.objects.create(
            fazenda=self.fazenda1,
            codigo="TAL-01",
            nome="Talhão Leste",
            area_ha=Decimal("100.00")
        )

        self.talhao2 = Talhao.objects.create(
            fazenda=self.fazenda2,
            codigo="TAL-02",
            nome="Talhão Norte",
            area_ha=Decimal("120.00")
        )

        self.pivo1 = Pivo.objects.create(
            fazenda=self.fazenda1,
            talhao=self.talhao1,
            codigo="PIV-01",
            nome="Pivô Sede",
            area_irrigada_ha=Decimal("95.00"),
            raio_metros=Decimal("550.00")
        )

        self.pivo2 = Pivo.objects.create(
            fazenda=self.fazenda2,
            codigo="PIV-02",
            nome="Pivô Alvorada",
            area_irrigada_ha=Decimal("80.00"),
            raio_metros=Decimal("500.00")
        )

        # 3. Culturas e Safras
        self.cultura_soja = Cultura.objects.create(
            nome="Soja Teste",
            codigo="SOJ-TEST",
            variedade="IPRO 7000",
            dias_ciclo_estimado=115,
            coeficiente_kc_padrao=Decimal("1.15"),
            ativo=True
        )

        self.cultura_milho = Cultura.objects.create(
            nome="Milho Teste",
            codigo="MIL-TEST",
            variedade="VT PRO",
            dias_ciclo_estimado=130,
            coeficiente_kc_padrao=Decimal("1.20"),
            ativo=True
        )

        self.safra = Safra.objects.create(
            nome="Safra 2024/2025 Teste",
            data_inicio=date(2024, 10, 1),
            data_fim=date(2025, 3, 31),
            status="EM_ANDAMENTO",
            ativa=True,
            fazenda=self.fazenda1,
            empresa=self.empresa
        )

    # --- TESTES DE SEGURANÇA E ACESSO ANÔNIMO ---
    def test_anonymous_access_is_forbidden(self):
        """Endpoints agrícolas rejeitam acesso anônimo com HTTP 401."""
        endpoints = [
            "/api/v1/operations/culturas/",
            "/api/v1/operations/safras/",
            "/api/v1/operations/planos/",
            "/api/v1/operations/planos/calendario/",
            "/api/v1/operations/planos/indicadores/",
            "/api/v1/pivots/empresas/",
            "/api/v1/pivots/talhoes/",
        ]
        for ep in endpoints:
            response = self.client.get(ep)
            self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED, f"Falha no endpoint {ep}")

    # --- TESTES DE CULTURAS ---
    def test_cultura_crud_and_validation(self):
        """Criação, consulta e validação de unicidade de culturas."""
        self.client.force_authenticate(user=self.admin_user)

        # 1. Criação bem sucedida
        res = self.client.post("/api/v1/operations/culturas/", {
            "nome": "Feijão Carioca",
            "codigo": "FEJ-CAR",
            "variedade": "Pérola",
            "dias_ciclo_estimado": 90,
            "coeficiente_kc_padrao": 1.10,
            "descricao": "Feijão irrigado de inverno"
        })
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        feijao_id = res.data["id"]

        # 2. Consulta
        res_get = self.client.get(f"/api/v1/operations/culturas/{feijao_id}/")
        self.assertEqual(res_get.status_code, status.HTTP_200_OK)
        self.assertEqual(res_get.data["codigo"], "FEJ-CAR")

        # 3. Bloqueio de duplicidade de nome
        res_dup_nome = self.client.post("/api/v1/operations/culturas/", {
            "nome": "Feijão Carioca",
            "codigo": "FEJ-NOVO",
        })
        self.assertEqual(res_dup_nome.status_code, status.HTTP_400_BAD_REQUEST)

        # 4. Bloqueio de duplicidade de código
        res_dup_cod = self.client.post("/api/v1/operations/culturas/", {
            "nome": "Outro Feijão",
            "codigo": "FEJ-CAR",
        })
        self.assertEqual(res_dup_cod.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cultura_permissions(self):
        """Operador e Consultor podem consultar, mas não podem criar culturas."""
        self.client.force_authenticate(user=self.operador_user)
        res_list = self.client.get("/api/v1/operations/culturas/")
        self.assertEqual(res_list.status_code, status.HTTP_200_OK)

        res_create = self.client.post("/api/v1/operations/culturas/", {
            "nome": "Trigo",
            "codigo": "TRI-01"
        })
        self.assertEqual(res_create.status_code, status.HTTP_403_FORBIDDEN)

    # --- TESTES DE SAFRAS ---
    def test_safra_crud_and_date_validation(self):
        """Criação e validação de datas da safra (data_fim >= data_inicio)."""
        self.client.force_authenticate(user=self.admin_user)

        # 1. Falha quando data_fim < data_inicio
        res_invalid = self.client.post("/api/v1/operations/safras/", {
            "nome": "Safra Inválida",
            "data_inicio": "2025-06-01",
            "data_fim": "2025-05-01",
        })
        self.assertEqual(res_invalid.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("data_fim", res_invalid.data)

        # 2. Sucesso com datas consistentes
        res_valid = self.client.post("/api/v1/operations/safras/", {
            "nome": "Safra 2025/2026",
            "data_inicio": "2025-10-01",
            "data_fim": "2026-03-31",
            "status": "PLANEJADA",
            "ativa": True,
            "fazenda": str(self.fazenda1.id)
        })
        self.assertEqual(res_valid.status_code, status.HTTP_201_CREATED)

    # --- TESTES DE PLANOS DE CULTIVO (PLANOS OPERACIONAIS) ---
    def test_plano_creation_and_validations(self):
        """Validação completa de regras de negócio de PlanoOperacional."""
        self.client.force_authenticate(user=self.admin_user)

        # 1. Data de colheita anterior ao plantio deve falhar
        res_data_inv = self.client.post("/api/v1/operations/planos/", {
            "safra": str(self.safra.id),
            "cultura": str(self.cultura_soja.id),
            "fazenda": str(self.fazenda1.id),
            "pivo": str(self.pivo1.id),
            "data_plantio": "2024-11-15",
            "data_colheita_prevista": "2024-10-15",
            "area_planejada_ha": 90.00
        })
        self.assertEqual(res_data_inv.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("data_colheita_prevista", res_data_inv.data)

        # 2. Período fora do intervalo da safra (safra vai de 2024-10-01 a 2025-03-31)
        res_fora_safra = self.client.post("/api/v1/operations/planos/", {
            "safra": str(self.safra.id),
            "cultura": str(self.cultura_soja.id),
            "fazenda": str(self.fazenda1.id),
            "pivo": str(self.pivo1.id),
            "data_plantio": "2024-09-01",  # Antes da safra
            "data_colheita_prevista": "2025-01-15",
            "area_planejada_ha": 90.00
        })
        self.assertEqual(res_fora_safra.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("data_plantio", res_fora_safra.data)

        # 3. Área planejada menor ou igual a zero
        res_area_zero = self.client.post("/api/v1/operations/planos/", {
            "safra": str(self.safra.id),
            "cultura": str(self.cultura_soja.id),
            "fazenda": str(self.fazenda1.id),
            "pivo": str(self.pivo1.id),
            "data_plantio": "2024-10-15",
            "data_colheita_prevista": "2025-02-15",
            "area_planejada_ha": 0.00
        })
        self.assertEqual(res_area_zero.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("area_planejada_ha", res_area_zero.data)

        # 4. Área planejada excedendo a capacidade do talhão (talhao1 tem 100 ha)
        res_area_teto = self.client.post("/api/v1/operations/planos/", {
            "safra": str(self.safra.id),
            "cultura": str(self.cultura_soja.id),
            "fazenda": str(self.fazenda1.id),
            "talhao": str(self.talhao1.id),
            "data_plantio": "2024-10-15",
            "data_colheita_prevista": "2025-02-15",
            "area_planejada_ha": 150.00  # Excede 100 ha
        })
        self.assertEqual(res_area_teto.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("area_planejada_ha", res_area_teto.data)

        # 5. Associação entre entidades de fazendas distintas (pivo2 é da fazenda2, mas foi passado fazenda1)
        res_cross_farm = self.client.post("/api/v1/operations/planos/", {
            "safra": str(self.safra.id),
            "cultura": str(self.cultura_soja.id),
            "fazenda": str(self.fazenda1.id),
            "pivo": str(self.pivo2.id),  # Pivo da Fazenda 2!
            "data_plantio": "2024-10-15",
            "data_colheita_prevista": "2025-02-15",
            "area_planejada_ha": 50.00
        })
        self.assertEqual(res_cross_farm.status_code, status.HTTP_400_BAD_REQUEST)

        # 6. Criação bem sucedida válida
        res_success = self.client.post("/api/v1/operations/planos/", {
            "safra": str(self.safra.id),
            "cultura": str(self.cultura_soja.id),
            "fazenda": str(self.fazenda1.id),
            "talhao": str(self.talhao1.id),
            "pivo": str(self.pivo1.id),
            "data_plantio": "2024-10-15",
            "data_colheita_prevista": "2025-02-15",
            "area_planejada_ha": 95.00,
            "status": "RASCUNHO",
            "observacoes": "Plano de teste com sucesso"
        })
        self.assertEqual(res_success.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res_success.data["status"], "RASCUNHO")

        # Verifica criação do registro de auditoria
        plano_id = res_success.data["id"]
        audit = AuditLog.objects.filter(tabela="PlanoOperacional", entidade_id=plano_id, acao="CREATE").first()
        self.assertIsNotNone(audit)
        self.assertEqual(audit.usuario, self.admin_user)

    # --- TESTE DE TRANSIÇÕES DE ESTADO ---
    def test_status_transitions(self):
        """Validação estrita da máquina de estados do planejamento."""
        self.client.force_authenticate(user=self.admin_user)

        # Cria plano em Rascunho
        plano = PlanoOperacional.objects.create(
            safra=self.safra,
            cultura=self.cultura_soja,
            fazenda=self.fazenda1,
            pivo=self.pivo1,
            data_plantio=date(2024, 10, 20),
            data_colheita_prevista=date(2025, 2, 20),
            area_planejada_ha=Decimal("80.00"),
            status="RASCUNHO"
        )

        # 1. RASCUNHO -> EM_ANDAMENTO (Inválido: deve passar por PLANEJADO primeiro)
        # Testa via operador/gestor normal
        self.client.force_authenticate(user=self.gestor_user)
        res_invalid = self.client.post(f"/api/v1/operations/planos/{plano.id}/transicionar-status/", {
            "status": "EM_ANDAMENTO"
        })
        self.assertEqual(res_invalid.status_code, status.HTTP_400_BAD_REQUEST)

        # 2. RASCUNHO -> PLANEJADO (Válido)
        res_to_planned = self.client.post(f"/api/v1/operations/planos/{plano.id}/transicionar-status/", {
            "status": "PLANEJADO",
            "motivo": "Aprovado pelo gestor da fazenda"
        })
        self.assertEqual(res_to_planned.status_code, status.HTTP_200_OK)
        self.assertEqual(res_to_planned.data["status"], "PLANEJADO")

        # 3. PLANEJADO -> EM_ANDAMENTO (Válido)
        res_to_running = self.client.post(f"/api/v1/operations/planos/{plano.id}/transicionar-status/", {
            "status": "EM_ANDAMENTO",
            "motivo": "Plantio iniciado no campo"
        })
        self.assertEqual(res_to_running.status_code, status.HTTP_200_OK)
        self.assertEqual(res_to_running.data["status"], "EM_ANDAMENTO")

        # 4. EM_ANDAMENTO -> CONCLUIDO (Válido)
        res_to_done = self.client.post(f"/api/v1/operations/planos/{plano.id}/transicionar-status/", {
            "status": "CONCLUIDO",
            "motivo": "Colheita finalizada com sucesso"
        })
        self.assertEqual(res_to_done.status_code, status.HTTP_200_OK)
        self.assertEqual(res_to_done.data["status"], "CONCLUIDO")

        # 5. CONCLUIDO -> PLANEJADO (Inválido para usuário comum)
        res_invalid_reopen = self.client.post(f"/api/v1/operations/planos/{plano.id}/transicionar-status/", {
            "status": "PLANEJADO"
        })
        self.assertEqual(res_invalid_reopen.status_code, status.HTTP_400_BAD_REQUEST)

        # Verifica trilha de auditoria gravada para o plano
        res_audit = self.client.get(f"/api/v1/operations/planos/{plano.id}/historico-auditoria/")
        self.assertEqual(res_audit.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(res_audit.data["total"], 3)

    # --- TESTE DE ISOLAMENTO DE DADOS (RBAC POR FAZENDA) ---
    def test_farm_isolation_by_user_profile(self):
        """Usuário gestor restrito à Fazenda 1 não visualiza dados da Fazenda 2."""
        # Cria plano na Fazenda 1
        plano_f1 = PlanoOperacional.objects.create(
            safra=self.safra,
            cultura=self.cultura_soja,
            fazenda=self.fazenda1,
            pivo=self.pivo1,
            data_plantio=date(2024, 10, 15),
            data_colheita_prevista=date(2025, 2, 15),
            area_planejada_ha=Decimal("95.00"),
            status="PLANEJADO"
        )

        # Cria plano na Fazenda 2
        safra2 = Safra.objects.create(
            nome="Safra Fazenda 2",
            data_inicio=date(2024, 10, 1),
            data_fim=date(2025, 3, 31),
            fazenda=self.fazenda2
        )
        plano_f2 = PlanoOperacional.objects.create(
            safra=safra2,
            cultura=self.cultura_milho,
            fazenda=self.fazenda2,
            pivo=self.pivo2,
            data_plantio=date(2024, 11, 1),
            data_colheita_prevista=date(2025, 3, 1),
            area_planejada_ha=Decimal("80.00"),
            status="PLANEJADO"
        )

        # Autentica como Gestor (tem apenas Fazenda 1 vinculada)
        self.client.force_authenticate(user=self.gestor_user)
        res = self.client.get("/api/v1/operations/planos/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        results = res.data.get("results", res.data)
        ids = [p["id"] for p in results]

        self.assertIn(str(plano_f1.id), ids)
        self.assertNotIn(str(plano_f2.id), ids)

    # --- TESTES DE CALENDÁRIO E INDICADORES ---
    def test_calendario_and_indicadores_endpoints(self):
        """Endpoints agregados de calendário e indicadores retornam dados calculados reais."""
        PlanoOperacional.objects.create(
            safra=self.safra,
            cultura=self.cultura_soja,
            fazenda=self.fazenda1,
            pivo=self.pivo1,
            data_plantio=date(2024, 10, 15),
            data_colheita_prevista=date(2025, 2, 15),
            area_planejada_ha=Decimal("95.00"),
            status="EM_ANDAMENTO"
        )

        PlanoOperacional.objects.create(
            safra=self.safra,
            cultura=self.cultura_milho,
            fazenda=self.fazenda1,
            talhao=self.talhao1,
            data_plantio=date(2024, 11, 1),
            data_colheita_prevista=date(2025, 3, 20),
            area_planejada_ha=Decimal("85.00"),
            status="PLANEJADO"
        )

        self.client.force_authenticate(user=self.admin_user)

        # Calendário
        res_cal = self.client.get("/api/v1/operations/planos/calendario/")
        self.assertEqual(res_cal.status_code, status.HTTP_200_OK)
        self.assertIn("events", res_cal.data)
        self.assertEqual(len(res_cal.data["events"]), 2)

        # Indicadores
        res_ind = self.client.get("/api/v1/operations/planos/indicadores/")
        self.assertEqual(res_ind.status_code, status.HTTP_200_OK)
        self.assertEqual(res_ind.data["total_planos"], 2)
        self.assertEqual(res_ind.data["area_total_planejada_ha"], 180.00)
        self.assertIn("area_por_cultura", res_ind.data)
        self.assertEqual(len(res_ind.data["area_por_cultura"]), 2)
        self.assertIn("planos_por_status", res_ind.data)
        self.assertEqual(res_ind.data["planos_por_status"]["EM_ANDAMENTO"], 1)
        self.assertEqual(res_ind.data["planos_por_status"]["PLANEJADO"], 1)

    # --- TESTE DE SINCRONIZAÇÃO MOBILE (PULL & PUSH) ---
    def test_sync_pull_and_push_for_planos(self):
        """O mobile puxa planos no pull e pode enviar atualizações de status via push idempotente."""
        plano = PlanoOperacional.objects.create(
            safra=self.safra,
            cultura=self.cultura_soja,
            fazenda=self.fazenda1,
            pivo=self.pivo1,
            data_plantio=date(2024, 10, 15),
            data_colheita_prevista=date(2025, 2, 15),
            area_planejada_ha=Decimal("95.00"),
            status="PLANEJADO"
        )

        self.client.force_authenticate(user=self.operador_user)

        # 1. Sync Pull
        res_pull = self.client.get("/api/v1/sync/pull/")
        self.assertEqual(res_pull.status_code, status.HTTP_200_OK)
        self.assertIn("planos", res_pull.data)
        self.assertIn("talhoes", res_pull.data)
        self.assertIn("culturas", res_pull.data)
        planos_ids = [p["id"] for p in res_pull.data["planos"]]
        self.assertIn(str(plano.id), planos_ids)

        # 2. Sync Push com atualização de status offline
        client_op_id = uuid.uuid4()
        push_payload = {
            "client_device_id": "TEST-DEVICE-01",
            "batch_timestamp": "2026-10-12T10:00:00Z",
            "operations": [
                {
                    "client_op_id": client_op_id,
                    "entity": "plano",
                    "action": "UPDATE_STATUS",
                    "occurred_at": "2026-10-12T10:00:00Z",
                    "payload": {
                        "id": str(plano.id),
                        "status": "EM_ANDAMENTO",
                        "observacoes": "Apontamento offline de início de plantio"
                    }
                }
            ]
        }
        res_push = self.client.post("/api/v1/sync/push/", push_payload, format="json")
        self.assertEqual(res_push.status_code, status.HTTP_200_OK)
        self.assertEqual(res_push.data["results"][0]["status"], "SUCCESS")

        # Verifica alteração no banco
        plano.refresh_from_db()
        self.assertEqual(plano.status, "EM_ANDAMENTO")
        self.assertIn("offline", plano.observacoes)

        # 3. Retransmissão da mesma operação (Idempotência estrita)
        res_push_dup = self.client.post("/api/v1/sync/push/", push_payload, format="json")
        self.assertEqual(res_push_dup.status_code, status.HTTP_200_OK)
        self.assertTrue(res_push_dup.data["results"][0]["idempotent"])

    # --- TESTES DE COMPATIBILIDADE SAFRA E FAZENDA (FASE 4.1.1) ---
    def test_safra_fazenda_compatibility_and_corporate_safra(self):
        """Validação de compatibilidade estrita entre Safra e Fazenda, suportando safra corporativa e rejeitando inconsistências em PATCH."""
        self.client.force_authenticate(user=self.admin_user)

        # 1. Safra compatível com a mesma fazenda (Sucesso)
        res_compat = self.client.post("/api/v1/operations/planos/", {
            "safra": str(self.safra.id),
            "cultura": str(self.cultura_soja.id),
            "fazenda": str(self.fazenda1.id),
            "talhao": str(self.talhao1.id),
            "data_plantio": "2024-10-15",
            "data_colheita_prevista": "2025-02-15",
            "area_planejada_ha": 80.00
        })
        self.assertEqual(res_compat.status_code, status.HTTP_201_CREATED)
        plano_id = res_compat.data["id"]

        # 2. Rejeição de safra pertencente a outra fazenda
        # self.safra é vinculada a fazenda1; tenta vincular a fazenda2
        res_incompat = self.client.post("/api/v1/operations/planos/", {
            "safra": str(self.safra.id),
            "cultura": str(self.cultura_soja.id),
            "fazenda": str(self.fazenda2.id),
            "talhao": str(self.talhao2.id),
            "data_plantio": "2024-10-15",
            "data_colheita_prevista": "2025-02-15",
            "area_planejada_ha": 80.00
        })
        self.assertEqual(res_incompat.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("safra", res_incompat.data)

        # 3. Safra corporativa (fazenda=None, vinculada à empresa)
        safra_corp = Safra.objects.create(
            nome="Safra Corporativa Nacional 24/25",
            data_inicio=date(2024, 10, 1),
            data_fim=date(2025, 4, 30),
            fazenda=None,
            empresa=self.empresa
        )
        # 3.1 Válida para fazenda pertencente à mesma empresa (fazenda1)
        res_corp_valid = self.client.post("/api/v1/operations/planos/", {
            "safra": str(safra_corp.id),
            "cultura": str(self.cultura_milho.id),
            "fazenda": str(self.fazenda1.id),
            "talhao": str(self.talhao1.id),
            "data_plantio": "2024-11-01",
            "data_colheita_prevista": "2025-03-01",
            "area_planejada_ha": 70.00
        })
        self.assertEqual(res_corp_valid.status_code, status.HTTP_201_CREATED)

        # 3.2 Incompatível se fazenda pertencer a outra empresa
        outra_empresa = Empresa.objects.create(nome="Outra Agro S.A.", cnpj="88.777.666/0001-55")
        fazenda_outra = Fazenda.objects.create(
            empresa=outra_empresa,
            codigo="FAZ-OUTRA",
            nome="Fazenda Outro Grupo",
            area_total_ha=Decimal("1000.00")
        )
        res_corp_incompat = self.client.post("/api/v1/operations/planos/", {
            "safra": str(safra_corp.id),
            "cultura": str(self.cultura_milho.id),
            "fazenda": str(fazenda_outra.id),
            "data_plantio": "2024-11-01",
            "data_colheita_prevista": "2025-03-01",
            "area_planejada_ha": 50.00
        })
        self.assertEqual(res_corp_incompat.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("safra", res_corp_incompat.data)

        # 4. Atualização parcial (PATCH) não permite criar inconsistência
        # 4.1 Tenta alterar a fazenda do plano para fazenda2 sem trocar a safra (que é de fazenda1)
        res_patch_fazenda = self.client.patch(f"/api/v1/operations/planos/{plano_id}/", {
            "fazenda": str(self.fazenda2.id)
        })
        self.assertEqual(res_patch_fazenda.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("safra", res_patch_fazenda.data)

        # 4.2 Tenta alterar a safra para uma safra de outra fazenda mantendo fazenda1
        safra_faz2 = Safra.objects.create(
            nome="Safra Fazenda 2 24/25",
            data_inicio=date(2024, 10, 1),
            data_fim=date(2025, 4, 30),
            fazenda=self.fazenda2,
            empresa=self.empresa
        )
        res_patch_safra = self.client.patch(f"/api/v1/operations/planos/{plano_id}/", {
            "safra": str(safra_faz2.id)
        })
        self.assertEqual(res_patch_safra.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("safra", res_patch_safra.data)

    # --- TESTES DE LIMITES DE ÁREA INDEPENDENTES (FASE 4.1.1) ---
    def test_area_limits_independent_validation_talhao_and_pivo(self):
        """Validação independente de limites de área para talhão e pivô, inclusive quando ambos estão associados."""
        self.client.force_authenticate(user=self.admin_user)

        talhao_pequeno = Talhao.objects.create(
            fazenda=self.fazenda1,
            codigo="TAL-PEQ",
            nome="Talhão Pequeno",
            area_ha=Decimal("70.00")
        )
        pivo_grande = Pivo.objects.create(
            fazenda=self.fazenda1,
            talhao=talhao_pequeno,
            codigo="PIV-GRD",
            nome="Pivô Grande",
            area_irrigada_ha=Decimal("85.00"),
            raio_metros=Decimal("520.00")
        )

        # 1. Área superior ao limite associado apenas a talhão
        res_talhao_only_exceed = self.client.post("/api/v1/operations/planos/", {
            "safra": str(self.safra.id),
            "cultura": str(self.cultura_soja.id),
            "fazenda": str(self.fazenda1.id),
            "talhao": str(self.talhao1.id),
            "data_plantio": "2024-10-15",
            "data_colheita_prevista": "2025-02-15",
            "area_planejada_ha": 105.00
        })
        self.assertEqual(res_talhao_only_exceed.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("area_planejada_ha", res_talhao_only_exceed.data)

        # 2. Área superior ao limite associado apenas a pivô
        res_pivo_only_exceed = self.client.post("/api/v1/operations/planos/", {
            "safra": str(self.safra.id),
            "cultura": str(self.cultura_soja.id),
            "fazenda": str(self.fazenda1.id),
            "pivo": str(self.pivo1.id),
            "data_plantio": "2024-10-15",
            "data_colheita_prevista": "2025-02-15",
            "area_planejada_ha": 98.00  # Pivô 1 tem 95 ha
        })
        self.assertEqual(res_pivo_only_exceed.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("area_planejada_ha", res_pivo_only_exceed.data)

        # 3. Área inferior ao talhão (100 ha), mas superior ao pivô (95 ha) quando ambos associados
        res_talhao_ok_pivo_exceed = self.client.post("/api/v1/operations/planos/", {
            "safra": str(self.safra.id),
            "cultura": str(self.cultura_soja.id),
            "fazenda": str(self.fazenda1.id),
            "talhao": str(self.talhao1.id),
            "pivo": str(self.pivo1.id),
            "data_plantio": "2024-10-15",
            "data_colheita_prevista": "2025-02-15",
            "area_planejada_ha": 98.00
        })
        self.assertEqual(res_talhao_ok_pivo_exceed.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("area_planejada_ha", res_talhao_ok_pivo_exceed.data)

        # 4. Área superior ao talhão (70 ha), mas inferior ao pivô (85 ha) quando ambos associados
        res_talhao_exceed_pivo_ok = self.client.post("/api/v1/operations/planos/", {
            "safra": str(self.safra.id),
            "cultura": str(self.cultura_milho.id),
            "fazenda": str(self.fazenda1.id),
            "talhao": str(talhao_pequeno.id),
            "pivo": str(pivo_grande.id),
            "data_plantio": "2024-10-15",
            "data_colheita_prevista": "2025-02-15",
            "area_planejada_ha": 75.00
        })
        self.assertEqual(res_talhao_exceed_pivo_ok.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("area_planejada_ha", res_talhao_exceed_pivo_ok.data)

        # 5. Área válida em ambos
        res_valid_both = self.client.post("/api/v1/operations/planos/", {
            "safra": str(self.safra.id),
            "cultura": str(self.cultura_milho.id),
            "fazenda": str(self.fazenda1.id),
            "talhao": str(talhao_pequeno.id),
            "pivo": str(pivo_grande.id),
            "data_plantio": "2024-10-15",
            "data_colheita_prevista": "2025-02-15",
            "area_planejada_ha": 65.00
        })
        self.assertEqual(res_valid_both.status_code, status.HTTP_201_CREATED)
        plano_id = res_valid_both.data["id"]

        # 6. Atualização parcial (PATCH) com estouro do limite
        res_patch_invalid = self.client.patch(f"/api/v1/operations/planos/{plano_id}/", {
            "area_planejada_ha": 72.00  # Excede talhão de 70 ha
        })
        self.assertEqual(res_patch_invalid.status_code, status.HTTP_400_BAD_REQUEST)

        # PATCH com valor válido
        res_patch_valid = self.client.patch(f"/api/v1/operations/planos/{plano_id}/", {
            "area_planejada_ha": 68.00
        })
        self.assertEqual(res_patch_valid.status_code, status.HTTP_200_OK)
        self.assertEqual(float(res_patch_valid.data["area_planejada_ha"]), 68.00)

    # --- TESTES DE AUDITORIA E EXCLUSÃO LÓGICA (FASE 4.1.1) ---
    def test_audit_log_update_and_logical_deletion(self):
        """Auditoria registra atualizações cadastrais e exclusão lógica quando há dependências operacionais."""
        self.client.force_authenticate(user=self.admin_user)

        plano = PlanoOperacional.objects.create(
            safra=self.safra,
            cultura=self.cultura_soja,
            fazenda=self.fazenda1,
            pivo=self.pivo1,
            data_plantio=date(2024, 10, 15),
            data_colheita_prevista=date(2025, 2, 15),
            area_planejada_ha=Decimal("80.00"),
            status="PLANEJADO"
        )

        # 1. Auditoria de alteração de plano (PATCH)
        res_update = self.client.patch(f"/api/v1/operations/planos/{plano.id}/", {
            "area_planejada_ha": 85.00,
            "observacoes": "Área recalculada via topografia"
        })
        self.assertEqual(res_update.status_code, status.HTTP_200_OK)
        audit_update = AuditLog.objects.filter(
            tabela="PlanoOperacional",
            entidade_id=str(plano.id),
            acao="UPDATE"
        ).first()
        self.assertIsNotNone(audit_update)
        self.assertEqual(audit_update.usuario, self.admin_user)
        self.assertEqual(audit_update.detalhes["area_planejada_ha"], 85.00)

        # 2. Exclusão física para plano sem dependências em RASCUNHO
        plano_sem_dep = PlanoOperacional.objects.create(
            safra=self.safra,
            cultura=self.cultura_milho,
            fazenda=self.fazenda1,
            data_plantio=date(2024, 11, 1),
            data_colheita_prevista=date(2025, 3, 1),
            area_planejada_ha=Decimal("50.00"),
            status="RASCUNHO"
        )
        plan_del_id = str(plano_sem_dep.id)
        res_del_hard = self.client.delete(f"/api/v1/operations/planos/{plan_del_id}/")
        self.assertEqual(res_del_hard.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(PlanoOperacional.objects.filter(id=plan_del_id).exists())
        audit_del = AuditLog.objects.filter(
            tabela="PlanoOperacional",
            entidade_id=plan_del_id,
            acao="DELETE"
        ).first()
        self.assertIsNotNone(audit_del)

        # 3. Exclusão lógica (CANCELADO) quando o plano está em EM_ANDAMENTO
        plano.status = "EM_ANDAMENTO"
        plano.save()
        res_del_soft = self.client.delete(f"/api/v1/operations/planos/{plano.id}/")
        self.assertEqual(res_del_soft.status_code, status.HTTP_204_NO_CONTENT)
        plano.refresh_from_db()
        self.assertEqual(plano.status, "CANCELADO")
        audit_cancel = AuditLog.objects.filter(
            tabela="PlanoOperacional",
            entidade_id=str(plano.id),
            acao="CANCEL"
        ).first()
        self.assertIsNotNone(audit_cancel)
        self.assertIn("exclusão lógica", audit_cancel.detalhes["motivo"])

    # --- TESTES DE RECÁLCULO DE INDICADORES (FASE 4.1.1) ---
    def test_indicadores_recalculation_after_status_transition(self):
        """Indicadores recalculam dinamicamente a área ativa e contagens por status após transições."""
        self.client.force_authenticate(user=self.admin_user)

        plano = PlanoOperacional.objects.create(
            safra=self.safra,
            cultura=self.cultura_soja,
            fazenda=self.fazenda1,
            pivo=self.pivo1,
            data_plantio=date(2024, 10, 15),
            data_colheita_prevista=date(2025, 2, 15),
            area_planejada_ha=Decimal("90.00"),
            status="PLANEJADO"
        )

        # Estado 1: PLANEJADO
        res_ind1 = self.client.get("/api/v1/operations/planos/indicadores/")
        self.assertEqual(res_ind1.status_code, status.HTTP_200_OK)
        self.assertEqual(res_ind1.data["planos_por_status"]["PLANEJADO"], 1)
        self.assertEqual(res_ind1.data["planos_por_status"]["EM_ANDAMENTO"], 0)
        self.assertEqual(res_ind1.data["area_total_planejada_ha"], 90.00)

        # Transiciona para EM_ANDAMENTO
        self.client.post(f"/api/v1/operations/planos/{plano.id}/transicionar-status/", {
            "status": "EM_ANDAMENTO"
        })

        # Estado 2: EM_ANDAMENTO
        res_ind2 = self.client.get("/api/v1/operations/planos/indicadores/")
        self.assertEqual(res_ind2.data["planos_por_status"]["PLANEJADO"], 0)
        self.assertEqual(res_ind2.data["planos_por_status"]["EM_ANDAMENTO"], 1)
        self.assertEqual(res_ind2.data["area_total_planejada_ha"], 90.00)

        # Transiciona para CANCELADO
        self.client.post(f"/api/v1/operations/planos/{plano.id}/transicionar-status/", {
            "status": "CANCELADO"
        })

        # Estado 3: CANCELADO (área ativa não considera planos cancelados)
        res_ind3 = self.client.get("/api/v1/operations/planos/indicadores/")
        self.assertEqual(res_ind3.data["planos_por_status"]["EM_ANDAMENTO"], 0)
        self.assertEqual(res_ind3.data["planos_por_status"]["CANCELADO"], 1)
        self.assertEqual(res_ind3.data["area_total_planejada_ha"], 0.00)

    # --- TESTES DE SINCRONIZAÇÃO OFFLINE: CONFLITOS E ESTADOS (FASE 4.1.1) ---
    def test_sync_push_state_machine_validations_and_conflicts(self):
        """Sync Push rejeita transições inválidas, detecta concorrência/cancelamento e protege idempotência."""
        self.client.force_authenticate(user=self.operador_user)

        plano = PlanoOperacional.objects.create(
            safra=self.safra,
            cultura=self.cultura_soja,
            fazenda=self.fazenda1,
            pivo=self.pivo1,
            data_plantio=date(2024, 10, 15),
            data_colheita_prevista=date(2025, 2, 15),
            area_planejada_ha=Decimal("80.00"),
            status="PLANEJADO"
        )

        # 1. Transição inválida pelo Sync Push (ex: PLANEJADO para CONCLUIDO direto)
        op_invalid_id = uuid.uuid4()
        res_invalid = self.client.post("/api/v1/sync/push/", {
            "client_device_id": "DEV-TEST",
            "operations": [{
                "client_op_id": op_invalid_id,
                "entity": "plano",
                "action": "UPDATE_STATUS",
                "occurred_at": timezone.now().isoformat(),
                "payload": {
                    "id": str(plano.id),
                    "status": "CONCLUIDO",
                    "expected_status": "PLANEJADO"
                }
            }]
        }, format="json")
        self.assertEqual(res_invalid.status_code, status.HTTP_200_OK)
        self.assertEqual(res_invalid.data["results"][0]["status"], "REJECTED")
        plano.refresh_from_db()
        self.assertEqual(plano.status, "PLANEJADO")

        # 2. Idempotência de operação rejeitada
        res_invalid_dup = self.client.post("/api/v1/sync/push/", {
            "client_device_id": "DEV-TEST",
            "operations": [{
                "client_op_id": op_invalid_id,
                "entity": "plano",
                "action": "UPDATE_STATUS",
                "occurred_at": timezone.now().isoformat(),
                "payload": {
                    "id": str(plano.id),
                    "status": "CONCLUIDO",
                    "expected_status": "PLANEJADO"
                }
            }]
        }, format="json")
        self.assertEqual(res_invalid_dup.status_code, status.HTTP_200_OK)
        self.assertEqual(res_invalid_dup.data["results"][0]["status"], "REJECTED")
        self.assertTrue(res_invalid_dup.data["results"][0]["idempotent"])

        # 3. Detecção de conflito: plano cancelado no servidor enquanto mobile offline
        plano.status = "CANCELADO"
        plano.save()

        op_conflict_cancel_id = uuid.uuid4()
        res_conflict_cancel = self.client.post("/api/v1/sync/push/", {
            "client_device_id": "DEV-TEST",
            "operations": [{
                "client_op_id": op_conflict_cancel_id,
                "entity": "plano",
                "action": "UPDATE_STATUS",
                "occurred_at": timezone.now().isoformat(),
                "payload": {
                    "id": str(plano.id),
                    "status": "EM_ANDAMENTO",
                    "expected_status": "PLANEJADO"
                }
            }]
        }, format="json")
        self.assertEqual(res_conflict_cancel.status_code, status.HTTP_200_OK)
        self.assertEqual(res_conflict_cancel.data["results"][0]["status"], "CONFLICT")
        self.assertIn("cancelado no servidor", res_conflict_cancel.data["results"][0]["message"])
        plano.refresh_from_db()
        self.assertEqual(plano.status, "CANCELADO")

        # 4. Detecção de conflito de concorrência por timestamp (base_updated_at desatualizado)
        plano_concorrente = PlanoOperacional.objects.create(
            safra=self.safra,
            cultura=self.cultura_milho,
            fazenda=self.fazenda1,
            pivo=self.pivo1,
            data_plantio=date(2024, 11, 1),
            data_colheita_prevista=date(2025, 3, 1),
            area_planejada_ha=Decimal("75.00"),
            status="PLANEJADO"
        )
        old_timestamp = (timezone.now() - timedelta(hours=2)).isoformat()
        op_conflict_ts_id = uuid.uuid4()
        res_conflict_ts = self.client.post("/api/v1/sync/push/", {
            "client_device_id": "DEV-TEST",
            "operations": [{
                "client_op_id": op_conflict_ts_id,
                "entity": "plano",
                "action": "UPDATE_STATUS",
                "occurred_at": timezone.now().isoformat(),
                "payload": {
                    "id": str(plano_concorrente.id),
                    "status": "EM_ANDAMENTO",
                    "base_updated_at": old_timestamp
                }
            }]
        }, format="json")
        self.assertEqual(res_conflict_ts.status_code, status.HTTP_200_OK)
        self.assertEqual(res_conflict_ts.data["results"][0]["status"], "CONFLICT")
        self.assertIn("alterado no servidor", res_conflict_ts.data["results"][0]["message"])

        # 5. Lote misto contendo uma operação conflitante e outra válida
        plano_valido = PlanoOperacional.objects.create(
            safra=self.safra,
            cultura=self.cultura_soja,
            fazenda=self.fazenda1,
            pivo=self.pivo1,
            data_plantio=date(2024, 10, 20),
            data_colheita_prevista=date(2025, 2, 20),
            area_planejada_ha=Decimal("70.00"),
            status="PLANEJADO"
        )
        batch_mixed = {
            "client_device_id": "DEV-TEST",
            "operations": [
                {
                    "client_op_id": uuid.uuid4(),
                    "entity": "plano",
                    "action": "UPDATE_STATUS",
                    "occurred_at": timezone.now().isoformat(),
                    "payload": {
                        "id": str(plano.id),  # Está CANCELADO
                        "status": "EM_ANDAMENTO"
                    }
                },
                {
                    "client_op_id": uuid.uuid4(),
                    "entity": "plano",
                    "action": "UPDATE_STATUS",
                    "occurred_at": timezone.now().isoformat(),
                    "payload": {
                        "id": str(plano_valido.id),
                        "status": "EM_ANDAMENTO",
                        "expected_status": "PLANEJADO"
                    }
                }
            ]
        }
        res_mixed = self.client.post("/api/v1/sync/push/", batch_mixed, format="json")
        self.assertEqual(res_mixed.status_code, status.HTTP_200_OK)
        results = res_mixed.data["results"]
        self.assertEqual(results[0]["status"], "CONFLICT")
        self.assertEqual(results[1]["status"], "SUCCESS")

        # Verifica persistência atômica: operação 1 preservou CANCELADO, operação 2 foi para EM_ANDAMENTO
        plano.refresh_from_db()
        self.assertEqual(plano.status, "CANCELADO")
        plano_valido.refresh_from_db()
        self.assertEqual(plano_valido.status, "EM_ANDAMENTO")
