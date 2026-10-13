from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta, date
from apps.pivots.models import Empresa, Fazenda, Talhao, Pivo
from apps.operations.models import Cultura, Safra, PlanoOperacional

class Command(BaseCommand):
    help = "Carga opcional, segura e idempotente de demonstração para o módulo de Planejamento Agrícola."

    def handle(self, *args, **options):
        self.stdout.write("Executando carga idempotente de Planejamento Agrícola...")

        # 1. Empresa
        empresa, _ = Empresa.objects.get_or_create(
            nome="Agropecuária Vale Verde S.A.",
            defaults={"cnpj": "12.345.678/0001-90", "ativo": True}
        )

        # 2. Fazendas & Talhões
        fazenda_sg = Fazenda.objects.filter(codigo="FAZ-SG").first()
        if fazenda_sg and not fazenda_sg.empresa:
            fazenda_sg.empresa = empresa
            fazenda_sg.save()

        fazenda_sh = Fazenda.objects.filter(codigo="FAZ-SH").first()
        if fazenda_sh and not fazenda_sh.empresa:
            fazenda_sh.empresa = empresa
            fazenda_sh.save()

        # 3. Culturas (Idempotente)
        culturas_catalogo = [
            {"key": "SOJ-01", "descricao": "SOJA GRÃO", "id_pims": "PIMS-SOJA"},
            {"key": "MIL-01", "descricao": "MILHO SAFRINHA", "id_pims": "PIMS-MILHO"},
            {"key": "FEJ-01", "descricao": "FEIJÃO CARIOCA", "id_pims": "PIMS-FEIJAO"},
            {"key": "ALG-01", "descricao": "ALGODÃO", "id_pims": "PIMS-ALGODAO"},
        ]

        culturas_map = {}
        for c in culturas_catalogo:
            obj, _ = Cultura.objects.get_or_create(
                descricao=c["descricao"],
                defaults={"id_pims": c["id_pims"]}
            )
            culturas_map[c["key"]] = obj

        # 4. Safras
        safra_verao, _ = Safra.objects.get_or_create(
            nome="Safra 2024/2025 - Verão",
            defaults={
                "data_inicio": date(2024, 10, 1),
                "data_fim": date(2025, 3, 31),
                "status": "EM_ANDAMENTO",
                "ativa": True,
                "empresa": empresa,
                "fazenda": fazenda_sg,
                "observacoes": "Safra principal de grãos com foco em soja precoce sob pivôs."
            }
        )

        safra_inverno, _ = Safra.objects.get_or_create(
            nome="Safra 2025/2025 - Inverno / Safrinha",
            defaults={
                "data_inicio": date(2025, 4, 1),
                "data_fim": date(2025, 9, 30),
                "status": "PLANEJADA",
                "ativa": True,
                "empresa": empresa,
                "fazenda": fazenda_sg,
                "observacoes": "Ciclo de feijão irrigado e milho safrinha."
            }
        )

        # 5. Planos de Cultivo (Idempotente)
        pivo1 = Pivo.objects.filter(codigo="PIV-01").first()
        t1 = Talhao.objects.filter(codigo="TAL-01").first()
        if pivo1 and not pivo1.talhao and t1:
            pivo1.talhao = t1
            pivo1.save()

        pivo2 = Pivo.objects.filter(codigo="PIV-02").first()
        t2 = Talhao.objects.filter(codigo="TAL-02").first()
        if pivo2 and not pivo2.talhao and t2:
            pivo2.talhao = t2
            pivo2.save()

        # Plano 1: PIV-01 Soja
        if pivo1:
            PlanoOperacional.objects.get_or_create(
                safra=safra_verao,
                pivo=pivo1,
                defaults={
                    "cultura": culturas_map["SOJ-01"],
                    "fazenda": pivo1.fazenda,
                    "talhao": t1,
                    "data_plantio": date(2024, 10, 15),
                    "data_colheita_prevista": date(2025, 2, 15),
                    "area_planejada_ha": pivo1.area_irrigada_ha,
                    "lamina_total_planejada_mm": 480.00,
                    "lamina_acumulada_realizada_mm": 185.00,
                    "status": "EM_ANDAMENTO",
                    "observacoes": "Monitoramento com sonda de umidade a 20 e 40 cm.",
                }
            )

        # Plano 2: PIV-02 Milho
        if pivo2:
            PlanoOperacional.objects.get_or_create(
                safra=safra_verao,
                pivo=pivo2,
                defaults={
                    "cultura": culturas_map["MIL-01"],
                    "fazenda": pivo2.fazenda,
                    "talhao": t2,
                    "data_plantio": date(2024, 11, 1),
                    "data_colheita_prevista": date(2025, 3, 20),
                    "area_planejada_ha": pivo2.area_irrigada_ha,
                    "lamina_total_planejada_mm": 520.00,
                    "lamina_acumulada_realizada_mm": 95.00,
                    "status": "EM_ANDAMENTO",
                    "observacoes": "Área de milho com adubação nitrogenada via fertirrigação.",
                }
            )

        self.stdout.write(self.style.SUCCESS("Carga de Planejamento Agrícola concluída com sucesso!"))
