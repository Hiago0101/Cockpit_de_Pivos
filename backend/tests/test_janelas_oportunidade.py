import uuid
from datetime import date, timedelta
from decimal import Decimal
from django.test import TestCase
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from apps.core.models import UserProfile, UserRole, AuditLog
from apps.pivots.models import Empresa, Fazenda, Talhao, Pivo
from apps.operations.models import (
    Cultura,
    Safra,
    PlanoOperacional,
    JanelaOportunidade,
    TipoOportunidade,
    PrioridadeOportunidade,
    SituacaoOportunidade,
    OrigemOportunidade,
)


class JanelasOportunidadeTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

        # 1. Usuários com papéis distintos (RBAC)
        self.admin_user = User.objects.create_user(username="admin_agro", password="password123")
        UserProfile.objects.create(user=self.admin_user, role=UserRole.ADMIN)

        self.gestor_user = User.objects.create_user(username="gestor_agro", password="password123")
        self.gestor_profile = UserProfile.objects.create(user=self.gestor_user, role=UserRole.GESTOR)

        self.operador_user = User.objects.create_user(username="operador_agro", password="password123")
        self.operador_profile = UserProfile.objects.create(user=self.operador_user, role=UserRole.OPERADOR)

        self.consultor_user = User.objects.create_user(username="consultor_agro", password="password123")
        UserProfile.objects.create(user=self.consultor_user, role=UserRole.CONSULTOR)

        # 2. Estrutura agrícola
        self.empresa = Empresa.objects.create(nome="Agropecuária Cerrado S.A.", cnpj="12.345.678/0001-90")

        self.fazenda1 = Fazenda.objects.create(
            empresa=self.empresa,
            codigo="FAZ-01",
            nome="Fazenda Santa Maria",
            municipio="Rio Verde",
            uf="GO",
            area_total_ha=Decimal("1200.00"),
        )
        self.fazenda2 = Fazenda.objects.create(
            empresa=self.empresa,
            codigo="FAZ-02",
            nome="Fazenda Boa Vista",
            municipio="Jataí",
            uf="GO",
            area_total_ha=Decimal("1800.00"),
        )

        # Gestor e operador vinculados à Fazenda 1
        self.gestor_profile.fazendas.add(self.fazenda1)
        self.operador_profile.fazendas.add(self.fazenda1)

        self.talhao1 = Talhao.objects.create(
            fazenda=self.fazenda1,
            codigo="TAL-01",
            nome="Talhão Sede",
            area_ha=Decimal("150.00"),
        )
        self.talhao2 = Talhao.objects.create(
            fazenda=self.fazenda2,
            codigo="TAL-02",
            nome="Talhão Norte",
            area_ha=Decimal("200.00"),
        )

        self.pivo1 = Pivo.objects.create(
            fazenda=self.fazenda1,
            talhao=self.talhao1,
            codigo="PIV-01",
            nome="Pivô Central 01",
            area_irrigada_ha=Decimal("85.00"),
        )
        self.pivo2 = Pivo.objects.create(
            fazenda=self.fazenda2,
            talhao=self.talhao2,
            codigo="PIV-02",
            nome="Pivô Central 02",
            area_irrigada_ha=Decimal("110.00"),
        )

        self.cultura = Cultura.objects.create(
            descricao="SOJA",
            id_pims="PIMS-SOJA",
            fazenda=self.fazenda1,
        )
        self.safra = Safra.objects.create(
            nome="Safra Verão 2026/2027",
            data_inicio=date.today(),
            data_fim=date.today() + timedelta(days=180),
            fazenda=self.fazenda1,
        )

        self.plano = PlanoOperacional.objects.create(
            safra=self.safra,
            cultura=self.cultura,
            fazenda=self.fazenda1,
            talhao=self.talhao1,
            pivo=self.pivo1,
            data_plantio=date.today() + timedelta(days=5),
            data_colheita_prevista=date.today() + timedelta(days=125),
            area_planejada_ha=Decimal("85.00"),
            status="PLANEJADO",
        )

    def test_anonymous_access_is_forbidden(self):
        """Endpoints de janelas rejeitam acesso sem autenticação com HTTP 401."""
        res = self.client.get("/api/v1/operations/janelas/")
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

        res_ind = self.client.get("/api/v1/operations/janelas/indicadores/")
        self.assertEqual(res_ind.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_create_opportunity_with_validations(self):
        """Gestor pode cadastrar oportunidade agrícola com validação de datas e vínculos."""
        self.client.force_authenticate(user=self.gestor_user)

        agora = timezone.now()
        payload = {
            "titulo": "Janela Noturna de Tarifa Fora de Ponta",
            "descricao": "Operação programada no pivô 01 para redução de custos",
            "tipo": "TARIFA_NOTURNA",
            "prioridade": "ALTA",
            "inicio_previsto": (agora + timedelta(hours=2)).isoformat(),
            "fim_previsto": (agora + timedelta(hours=8)).isoformat(),
            "fazenda": str(self.fazenda1.id),
            "pivo": str(self.pivo1.id),
            "talhao": str(self.talhao1.id),
            "plano_operacional": str(self.plano.id),
            "justificativa": "Tarifa noturna com 65% de desconto no custo por kWh.",
        }

        res = self.client.post("/api/v1/operations/janelas/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        data = res.json()
        self.assertEqual(data["titulo"], payload["titulo"])
        self.assertEqual(data["prioridade"], "ALTA")
        self.assertEqual(data["status"], "DETECTADA")
        self.assertEqual(data["pivo_codigo"], "PIV-01")
        self.assertEqual(data["fazenda_nome"], "FAZENDA SANTA MARIA")

        # Verifica criação do AuditLog
        self.assertTrue(
            AuditLog.objects.filter(
                tabela="JanelaOportunidade",
                entidade_id=data["id"],
                acao="CREATE",
            ).exists()
        )

    def test_date_consistency_validation(self):
        """Rejeita oportunidade onde data de término é anterior ao início."""
        self.client.force_authenticate(user=self.gestor_user)

        agora = timezone.now()
        payload = {
            "titulo": "Data Inválida",
            "tipo": "OUTRO",
            "inicio_previsto": (agora + timedelta(hours=5)).isoformat(),
            "fim_previsto": (agora + timedelta(hours=1)).isoformat(),  # Término antes do início!
            "fazenda": str(self.fazenda1.id),
        }

        res = self.client.post("/api/v1/operations/janelas/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("fim_previsto", res.json())

    def test_cross_farm_inconsistency_validation(self):
        """Rejeita vínculo entre pivô da Fazenda 2 e oportunidade vinculada à Fazenda 1."""
        self.client.force_authenticate(user=self.admin_user)

        agora = timezone.now()
        payload = {
            "titulo": "Inconsistência Geográfica",
            "tipo": "OUTRO",
            "inicio_previsto": agora.isoformat(),
            "fim_previsto": (agora + timedelta(hours=4)).isoformat(),
            "fazenda": str(self.fazenda1.id),
            "pivo": str(self.pivo2.id),  # Pertence à Fazenda 2!
        }

        res = self.client.post("/api/v1/operations/janelas/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_rbac_and_farm_isolation(self):
        """Usuário gestor com acesso apenas à Fazenda 1 não visualiza oportunidades da Fazenda 2."""
        agora = timezone.now()
        op_faz1 = JanelaOportunidade.objects.create(
            titulo="Oportunidade Fazenda 1",
            fazenda=self.fazenda1,
            inicio_previsto=agora,
            fim_previsto=agora + timedelta(hours=4),
            status="DETECTADA",
        )
        op_faz2 = JanelaOportunidade.objects.create(
            titulo="Oportunidade Fazenda 2",
            fazenda=self.fazenda2,
            inicio_previsto=agora,
            fim_previsto=agora + timedelta(hours=4),
            status="DETECTADA",
        )

        self.client.force_authenticate(user=self.gestor_user)
        res = self.client.get("/api/v1/operations/janelas/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        ids = [item["id"] for item in (res.json().get("results") or res.json())]
        self.assertIn(str(op_faz1.id), ids)
        self.assertNotIn(str(op_faz2.id), ids)

    def test_consultor_cannot_create_or_transition(self):
        """Consultor possui perfil somente leitura e não pode criar ou transicionar oportunidades."""
        self.client.force_authenticate(user=self.consultor_user)

        agora = timezone.now()
        res_post = self.client.post(
            "/api/v1/operations/janelas/",
            {
                "titulo": "Tentativa Consultor",
                "inicio_previsto": agora.isoformat(),
                "fim_previsto": (agora + timedelta(hours=2)).isoformat(),
                "fazenda": str(self.fazenda1.id),
            },
            format="json",
        )
        self.assertEqual(res_post.status_code, status.HTTP_403_FORBIDDEN)

        # Transição
        op = JanelaOportunidade.objects.create(
            titulo="Janela Teste",
            fazenda=self.fazenda1,
            inicio_previsto=agora,
            fim_previsto=agora + timedelta(hours=2),
            status="DETECTADA",
        )
        res_action = self.client.post(f"/api/v1/operations/janelas/{op.id}/reconhecer/")
        self.assertEqual(res_action.status_code, status.HTTP_403_FORBIDDEN)

    def test_state_machine_valid_transitions(self):
        """Valida transições permitidas: DETECTADA -> RECONHECIDA -> RESOLVIDA e DETECTADA -> DESCARTADA."""
        agora = timezone.now()
        op = JanelaOportunidade.objects.create(
            titulo="Janela Fluxo",
            fazenda=self.fazenda1,
            inicio_previsto=agora,
            fim_previsto=agora + timedelta(hours=4),
            status="DETECTADA",
        )

        # 1. Operador reconhece a oportunidade
        self.client.force_authenticate(user=self.operador_user)
        res_rec = self.client.post(f"/api/v1/operations/janelas/{op.id}/reconhecer/")
        self.assertEqual(res_rec.status_code, status.HTTP_200_OK)
        self.assertEqual(res_rec.json()["status"], "RECONHECIDA")
        self.assertIsNotNone(res_rec.json()["reconhecido_em"])

        # 2. Operador marca como resolvida
        res_res = self.client.post(
            f"/api/v1/operations/janelas/{op.id}/resolver/",
            {"justificativa": "Pivô operado conforme planejado durante a noite."},
            format="json",
        )
        self.assertEqual(res_res.status_code, status.HTTP_200_OK)
        self.assertEqual(res_res.json()["status"], "RESOLVIDA")
        self.assertTrue(res_res.json()["aproveitada"])

        # 3. Tentativa de transicionar a partir de RESOLVIDA deve ser bloqueada
        res_invalid = self.client.post(f"/api/v1/operations/janelas/{op.id}/descartar/", {"justificativa": "Teste"})
        self.assertEqual(res_invalid.status_code, status.HTTP_400_BAD_REQUEST)

    def test_discard_requires_justification(self):
        """Descarte exige obrigatoriamente justificativa/motivo do descarte."""
        agora = timezone.now()
        op = JanelaOportunidade.objects.create(
            titulo="Janela Para Descarte",
            fazenda=self.fazenda1,
            inicio_previsto=agora,
            fim_previsto=agora + timedelta(hours=4),
            status="DETECTADA",
        )

        self.client.force_authenticate(user=self.operador_user)

        # Tentativa sem justificativa
        res_fail = self.client.post(f"/api/v1/operations/janelas/{op.id}/descartar/", {}, format="json")
        self.assertEqual(res_fail.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("justificativa", res_fail.json())

        # Com justificativa
        res_ok = self.client.post(
            f"/api/v1/operations/janelas/{op.id}/descartar/",
            {"justificativa": "Manutenção mecânica imprevista impediu o acionamento."},
            format="json",
        )
        self.assertEqual(res_ok.status_code, status.HTTP_200_OK)
        self.assertEqual(res_ok.json()["status"], "DESCARTADA")
        self.assertIn("Manutenção", res_ok.json()["motivo_descarte"])

    def test_evaluate_rules_prevents_duplicate_opportunities(self):
        """Motor de regras gera oportunidades fundamentadas e não cria duplicatas em execuções repetidas."""
        self.client.force_authenticate(user=self.gestor_user)

        # 1. Primeira avaliação
        res1 = self.client.post("/api/v1/operations/janelas/avaliar-regras/", {"fazenda": str(self.fazenda1.id)}, format="json")
        self.assertEqual(res1.status_code, status.HTTP_200_OK)
        data1 = res1.json()
        self.assertGreater(data1["novas_criadas"], 0)

        total_depois_1 = JanelaOportunidade.objects.filter(fazenda=self.fazenda1).count()

        # 2. Segunda avaliação imediata para a mesma fazenda
        res2 = self.client.post("/api/v1/operations/janelas/avaliar-regras/", {"fazenda": str(self.fazenda1.id)}, format="json")
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        data2 = res2.json()
        self.assertEqual(data2["novas_criadas"], 0)  # Não duplicou!
        self.assertGreater(data2["previamente_existentes"], 0)

        total_depois_2 = JanelaOportunidade.objects.filter(fazenda=self.fazenda1).count()
        self.assertEqual(total_depois_1, total_depois_2)

    def test_indicators_endpoint_reflects_status_changes(self):
        """Endpoint de indicadores atualiza contagens dinamicamente conforme o ciclo de vida."""
        self.client.force_authenticate(user=self.gestor_user)

        agora = timezone.now()
        # Cria 1 detectada e 1 vencida
        JanelaOportunidade.objects.create(
            titulo="Op Ativa",
            fazenda=self.fazenda1,
            prioridade="ALTA",
            tipo="TARIFA_NOTURNA",
            inicio_previsto=agora,
            fim_previsto=agora + timedelta(hours=2),
            status="DETECTADA",
        )
        JanelaOportunidade.objects.create(
            titulo="Op Vencida",
            fazenda=self.fazenda1,
            prioridade="CRITICA",
            tipo="PLANTIO_IDEAL",
            inicio_previsto=agora - timedelta(days=2),
            fim_previsto=agora - timedelta(hours=1),
            status="DETECTADA",
        )

        res = self.client.get("/api/v1/operations/janelas/indicadores/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.json()

        self.assertEqual(data["total"], 2)
        self.assertEqual(data["ativas"], 2)
        self.assertEqual(data["vencidas"], 1)
        self.assertEqual(data["por_prioridade"]["ALTA"], 1)
        self.assertEqual(data["por_prioridade"]["CRITICA"], 1)

    def test_audit_history_endpoint(self):
        """Consulta do histórico de auditoria retorna trilha de eventos da oportunidade."""
        self.client.force_authenticate(user=self.gestor_user)

        agora = timezone.now()
        op = JanelaOportunidade.objects.create(
            titulo="Op Auditoria",
            fazenda=self.fazenda1,
            inicio_previsto=agora,
            fim_previsto=agora + timedelta(hours=3),
            status="DETECTADA",
        )

        # Transiciona para RECONHECIDA
        self.client.post(f"/api/v1/operations/janelas/{op.id}/reconhecer/")

        # Consulta histórico de auditoria
        res = self.client.get(f"/api/v1/operations/janelas/{op.id}/historico-auditoria/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.json()
        self.assertGreaterEqual(data["total"], 1)
        acoes = [item["acao"] for item in data["results"]]
        self.assertTrue(any("RECONHECIDA" in a for a in acoes))
