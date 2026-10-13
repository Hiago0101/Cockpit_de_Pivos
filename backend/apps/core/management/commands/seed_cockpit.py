from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta
from apps.core.models import UserProfile, UserRole
from apps.pivots.models import Fazenda, Talhao, Pivo, PivoStatus, PivoSentido
from apps.operations.models import Cultura, Safra, PlanoOperacional, RegistroIrrigacao, Alerta, AlertaSeveridade, JanelaOportunidade

class Command(BaseCommand):
    help = "Popula o banco de dados corporativo com fazendas, pivôs centrais, culturas e operações para demonstração integrada."

    def handle(self, *args, **options):
        self.stdout.write("Iniciando carga de dados agrícolas do Cockpit de Pivôs...")

        # 1. Usuários: Não criar contas com senhas fixas em rotinas de seed.
        # A criação de contas administrativas é um procedimento explícito via createsuperuser.
        operador_existente = User.objects.filter(is_active=True).first()

        # 2. Fazendas
        fazenda1, _ = Fazenda.objects.get_or_create(
            codigo="FAZ-SG",
            defaults={
                "nome": "Fazenda São Gabriel",
                "municipio": "Cristalina",
                "uf": "GO",
                "latitude": -16.768400,
                "longitude": -47.613900,
                "area_total_ha": 3500.00
            }
        )

        fazenda2, _ = Fazenda.objects.get_or_create(
            codigo="FAZ-SH",
            defaults={
                "nome": "Fazenda Santa Helena",
                "municipio": "Unaí",
                "uf": "MG",
                "latitude": -16.357500,
                "longitude": -46.905600,
                "area_total_ha": 2800.00
            }
        )

        # 3. Talhões
        t1, _ = Talhao.objects.get_or_create(fazenda=fazenda1, codigo="TAL-01", defaults={"nome": "Talhão Pivô Central 01", "area_ha": 85.0})
        t2, _ = Talhao.objects.get_or_create(fazenda=fazenda1, codigo="TAL-02", defaults={"nome": "Talhão Pivô Central 02", "area_ha": 110.0})
        t3, _ = Talhao.objects.get_or_create(fazenda=fazenda2, codigo="TAL-03", defaults={"nome": "Talhão Sede Leste", "area_ha": 72.0})

        # 4. Pivôs Centrais
        pivos_dados = [
            {
                "fazenda": fazenda1,
                "codigo": "PIV-01",
                "nome": "Pivô Cristalina Norte",
                "fabricante": "Lindsay Zimmatic",
                "modelo": "9500P Pivot",
                "latitude_centro": -16.764500,
                "longitude_centro": -47.611200,
                "raio_metros": 520.00,
                "area_irrigada_ha": 84.95,
                "vazao_nominal_m3h": 320.00,
                "pressao_nominal_bar": 3.80,
                "velocidade_100_percent_mh": 220.00,
                "status_operacional": PivoStatus.IRRIGANDO,
                "angulo_atual_graus": 142.50,
                "sentido_rotacao": PivoSentido.HORARIO,
                "percentimetro_atual": 85,
                "lamina_atual_mm": 6.80,
                "pressao_atual_bar": 3.75,
                "tensao_eletrica_v": 382.00,
            },
            {
                "fazenda": fazenda1,
                "codigo": "PIV-02",
                "nome": "Pivô Cristalina Sul",
                "fabricante": "Valley",
                "modelo": "8000 Series",
                "latitude_centro": -16.772000,
                "longitude_centro": -47.618000,
                "raio_metros": 590.00,
                "area_irrigada_ha": 109.36,
                "vazao_nominal_m3h": 410.00,
                "pressao_nominal_bar": 4.10,
                "velocidade_100_percent_mh": 195.00,
                "status_operacional": PivoStatus.PARADO,
                "angulo_atual_graus": 320.00,
                "sentido_rotacao": PivoSentido.ESTACIONARIO,
                "percentimetro_atual": 100,
                "lamina_atual_mm": 0.00,
                "pressao_atual_bar": 0.00,
                "tensao_eletrica_v": 380.00,
            },
            {
                "fazenda": fazenda1,
                "codigo": "PIV-03",
                "nome": "Pivô Baixada Oeste",
                "fabricante": "Fockink",
                "modelo": "Supreme 7000",
                "latitude_centro": -16.760000,
                "longitude_centro": -47.625000,
                "raio_metros": 480.00,
                "area_irrigada_ha": 72.38,
                "vazao_nominal_m3h": 270.00,
                "pressao_nominal_bar": 3.40,
                "velocidade_100_percent_mh": 210.00,
                "status_operacional": PivoStatus.FALHA,
                "angulo_atual_graus": 88.00,
                "sentido_rotacao": PivoSentido.ESTACIONARIO,
                "percentimetro_atual": 70,
                "lamina_atual_mm": 0.00,
                "pressao_atual_bar": 1.20,  # Queda de pressão
                "tensao_eletrica_v": 365.00,
            },
            {
                "fazenda": fazenda2,
                "codigo": "PIV-04",
                "nome": "Pivô Unaí Sede",
                "fabricante": "Bauer",
                "modelo": "Centerstar 9000",
                "latitude_centro": -16.355000,
                "longitude_centro": -46.902000,
                "raio_metros": 450.00,
                "area_irrigada_ha": 63.62,
                "vazao_nominal_m3h": 250.00,
                "pressao_nominal_bar": 3.20,
                "velocidade_100_percent_mh": 230.00,
                "status_operacional": PivoStatus.IRRIGANDO,
                "angulo_atual_graus": 210.00,
                "sentido_rotacao": PivoSentido.ANTI_HORARIO,
                "percentimetro_atual": 60,
                "lamina_atual_mm": 9.50,
                "pressao_atual_bar": 3.25,
                "tensao_eletrica_v": 381.00,
            },
        ]

        pivos_criados = []
        for p_data in pivos_dados:
            pivo_obj, _ = Pivo.objects.get_or_create(
                fazenda=p_data["fazenda"],
                codigo=p_data["codigo"],
                defaults=p_data
            )
            pivos_criados.append(pivo_obj)

        # 5. Culturas e Safra
        soja, _ = Cultura.objects.get_or_create(descricao="SOJA", defaults={"id_pims": "PIMS-SOJA"})
        milho, _ = Cultura.objects.get_or_create(descricao="MILHO", defaults={"id_pims": "PIMS-MILHO"})
        feijao, _ = Cultura.objects.get_or_create(descricao="FEIJÃO", defaults={"id_pims": "PIMS-FEIJAO"})

        safra, _ = Safra.objects.get_or_create(
            nome="Safra 2024/2025 - Verão",
            defaults={"data_inicio": "2024-10-01", "data_fim": "2025-03-31", "ativa": True}
        )

        # 6. Planos Operacionais
        plano1, _ = PlanoOperacional.objects.get_or_create(
            safra=safra,
            pivo=pivos_criados[0],
            defaults={
                "cultura": soja,
                "data_plantio": "2024-10-15",
                "data_colheita_prevista": "2025-02-15",
                "lamina_total_planejada_mm": 480.00,
                "lamina_acumulada_realizada_mm": 185.00,
                "status": "EM_ANDAMENTO"
            }
        )

        # 7. Registros de Irrigação (Idempotente)
        now = timezone.now()
        if not RegistroIrrigacao.objects.filter(pivo=pivos_criados[0], observacoes__icontains="manejo conforme umidade").exists():
            RegistroIrrigacao.objects.create(
                pivo=pivos_criados[0],
                inicio_em=now - timedelta(hours=14),
                fim_em=now - timedelta(hours=2),
                percentimetro=80,
                lamina_aplicada_mm=7.5,
                sentido="HORARIO",
                operador=operador_existente,
                tarifa_aplicada="FORA_PONTA",
                origem="WEB",
                observacoes="Irrigação de manejo conforme umidade do solo a 40cm."
            )

        # 8. Alertas (Idempotente)
        Alerta.objects.get_or_create(
            pivo=pivos_criados[2],
            titulo="Queda Abrupta de Pressão na Base",
            defaults={
                "tipo": "PRESSAO_BAIXA",
                "severidade": AlertaSeveridade.CRITICO,
                "mensagem": "Pressão medida caiu para 1.20 bar (nominal: 3.40 bar). Possível vazamento na adutora ou problema no conjunto motobomba.",
                "gerado_em": now - timedelta(hours=3),
            }
        )

        Alerta.objects.get_or_create(
            pivo=pivos_criados[0],
            titulo="Oscilação de Tensão Elétrica",
            defaults={
                "tipo": "ENERGIA_INSTAVEL",
                "severidade": AlertaSeveridade.ATENCAO,
                "mensagem": "Tensão medida oscilou entre 365V e 385V no painel do pivô durante a madrugada.",
                "gerado_em": now - timedelta(hours=8),
                "reconhecido_em": now - timedelta(hours=6),
                "reconhecido_por": operador_existente
            }
        )

        # 9. Janelas de Oportunidade (Idempotente)
        if not JanelaOportunidade.objects.filter(pivo=pivos_criados[1], motivo="Tarifa Noturna Fora de Ponta (Verde)").exists():
            JanelaOportunidade.objects.create(
                pivo=pivos_criados[1],
                inicio_previsto=now + timedelta(hours=4),
                fim_previsto=now + timedelta(hours=12),
                motivo="Tarifa Noturna Fora de Ponta (Verde)",
                tarifa_vigente="NOTURNA_REDUZIDA",
                economia_estimada_reais=680.00,
                recomendacao="Janela ideal para aplicar lâmina de 8.0mm no Pivô Cristalina Sul com redução de até 65% no custo energético.",
                aproveitada=False
            )

        self.stdout.write(self.style.SUCCESS("Dados agrícolas carregados com sucesso!"))
        self.stdout.write(
            self.style.NOTICE(
                "NOTA DE SEGURANÇA: Nenhuma credencial fixa foi criada. Para criar a conta do administrador do sistema, execute:\n"
                "  python manage.py createsuperuser"
            )
        )
