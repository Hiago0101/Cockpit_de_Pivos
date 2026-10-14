import os
import django
from datetime import date
import uuid

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'cockpit_backend.settings')
django.setup()

from apps.pivots.models import Fazenda, Talhao, Pivo
from apps.operations.models import Safra, Cultura, PlanoOperacional

print("=== INICIANDO GERAÇÃO DE DADOS PARA GANTT ===")

# 1. Garantir Fazendas
fazenda1 = Fazenda.objects.filter(nome__icontains="Gabriel").first() or Fazenda.objects.first()
fazenda2 = Fazenda.objects.filter(nome__icontains="Helena").first() or Fazenda.objects.last()

# 2. Culturas com descrições corretas
culturas_map = {}
culturas_nomes = [
    ("SOJA", "SOJ-01"),
    ("MILHO", "MIL-01"),
    ("FEIJÃO", "FEI-01"),
    ("ALGODÃO", "ALG-01"),
    ("SORGO", "SOR-01"),
    ("TRIGO", "TRI-01"),
]

# Atualizar culturas existentes que estavam com descrição vazia
vazias = list(Cultura.objects.filter(descricao=""))
for idx, (nome, pims) in enumerate(culturas_nomes):
    if idx < len(vazias):
        c = vazias[idx]
        c.descricao = nome
        c.id_pims = pims
        c.save()
        culturas_map[nome] = c
    else:
        c = Cultura.objects.filter(descricao=nome).first()
        if not c:
            c = Cultura.objects.create(descricao=nome, id_pims=pims, fazenda=fazenda1)
        culturas_map[nome] = c

# Garante todas mapeadas
for nome, _ in culturas_nomes:
    if nome not in culturas_map:
        culturas_map[nome] = Cultura.objects.filter(descricao=nome).first()

print(f"Culturas prontas: {[c.descricao for c in culturas_map.values() if c]}")

# 3. Safras para o período atual (2026/2027)
safra_verao, _ = Safra.objects.get_or_create(
    nome="Safra 2026/2027 - Verão",
    defaults={
        "data_inicio": date(2026, 9, 1),
        "data_fim": date(2027, 3, 31),
        "status": "EM_ANDAMENTO",
        "ativa": True,
        "fazenda": fazenda1,
    }
)

safra_inverno, _ = Safra.objects.get_or_create(
    nome="Safrinha 2027 - Inverno",
    defaults={
        "data_inicio": date(2027, 4, 1),
        "data_fim": date(2027, 9, 30),
        "status": "PLANEJADA",
        "ativa": True,
        "fazenda": fazenda1,
    }
)

print("Safras prontas:", safra_verao.nome, "|", safra_inverno.nome)

# 4. Obter Pivôs
pivos = list(Pivo.objects.select_related("fazenda").all())
if not pivos:
    print("Nenhum pivô encontrado!")
    exit()

print(f"Pivôs encontrados ({len(pivos)}): {[p.codigo for p in pivos]}")

# 5. Criar Planos Operacionais distribuídos para visualização no Gantt
# Deletar planos anteriores para termos um cronograma lindo e limpo
PlanoOperacional.objects.all().delete()

planos_dados = [
    # PIV-01 (Cristalina Norte): Soja no verão -> Janela Livre -> Milho na safrinha
    {
        "pivo_idx": 0,
        "cultura": "SOJA",
        "safra": safra_verao,
        "data_plantio": date(2026, 10, 10),
        "data_colheita_prevista": date(2027, 2, 15),
        "data_plantio_real": date(2026, 10, 10),
        "area": 110.0,
        "lamina": 480.0,
        "status": "EM_ANDAMENTO",
    },
    {
        "pivo_idx": 0,
        "cultura": "MILHO",
        "safra": safra_inverno,
        "data_plantio": date(2027, 3, 10),
        "data_colheita_prevista": date(2027, 7, 20),
        "data_plantio_real": None,
        "area": 110.0,
        "lamina": 420.0,
        "status": "PLANEJADO",
    },

    # PIV-02 (Cristalina Sul): Feijão ciclo curto -> Algodão
    {
        "pivo_idx": 1 if len(pivos) > 1 else 0,
        "cultura": "FEIJÃO",
        "safra": safra_verao,
        "data_plantio": date(2026, 9, 25),
        "data_colheita_prevista": date(2027, 1, 10),
        "data_plantio_real": date(2026, 9, 25),
        "area": 95.0,
        "lamina": 350.0,
        "status": "EM_ANDAMENTO",
    },
    {
        "pivo_idx": 1 if len(pivos) > 1 else 0,
        "cultura": "ALGODÃO",
        "safra": safra_inverno,
        "data_plantio": date(2027, 1, 28),
        "data_colheita_prevista": date(2027, 7, 15),
        "data_plantio_real": None,
        "area": 95.0,
        "lamina": 620.0,
        "status": "PLANEJADO",
    },

    # PIV-03 (Baixada Oeste): Milho Verão -> Trigo Inverno
    {
        "pivo_idx": 2 if len(pivos) > 2 else 0,
        "cultura": "MILHO",
        "safra": safra_verao,
        "data_plantio": date(2026, 10, 20),
        "data_colheita_prevista": date(2027, 3, 5),
        "data_plantio_real": date(2026, 10, 22),
        "area": 130.0,
        "lamina": 510.0,
        "status": "EM_ANDAMENTO",
    },
    {
        "pivo_idx": 2 if len(pivos) > 2 else 0,
        "cultura": "TRIGO",
        "safra": safra_inverno,
        "data_plantio": date(2027, 4, 1),
        "data_colheita_prevista": date(2027, 8, 20),
        "data_plantio_real": None,
        "area": 130.0,
        "lamina": 390.0,
        "status": "PLANEJADO",
    },

    # PIV-04 (Unaí Sede): Soja -> Sorgo
    {
        "pivo_idx": 3 if len(pivos) > 3 else 0,
        "cultura": "SOJA",
        "safra": safra_verao,
        "data_plantio": date(2026, 11, 1),
        "data_colheita_prevista": date(2027, 3, 15),
        "data_plantio_real": None,
        "area": 105.0,
        "lamina": 450.0,
        "status": "PLANEJADO",
    },
    {
        "pivo_idx": 3 if len(pivos) > 3 else 0,
        "cultura": "SORGO",
        "safra": safra_inverno,
        "data_plantio": date(2027, 3, 28),
        "data_colheita_prevista": date(2027, 7, 30),
        "data_plantio_real": None,
        "area": 105.0,
        "lamina": 360.0,
        "status": "PLANEJADO",
    },

    # PIV-VAL (Validação): Feijão -> Soja Safrinha
    {
        "pivo_idx": 4 if len(pivos) > 4 else 0,
        "cultura": "FEIJÃO",
        "safra": safra_verao,
        "data_plantio": date(2026, 10, 5),
        "data_colheita_prevista": date(2027, 1, 20),
        "data_plantio_real": date(2026, 10, 5),
        "area": 85.0,
        "lamina": 340.0,
        "status": "EM_ANDAMENTO",
    },
    {
        "pivo_idx": 4 if len(pivos) > 4 else 0,
        "cultura": "SOJA",
        "safra": safra_inverno,
        "data_plantio": date(2027, 2, 10),
        "data_colheita_prevista": date(2027, 6, 25),
        "data_plantio_real": None,
        "area": 85.0,
        "lamina": 430.0,
        "status": "PLANEJADO",
    },
]

criados = 0
for d in planos_dados:
    pivo = pivos[d["pivo_idx"]]
    cult = culturas_map.get(d["cultura"])
    if not cult:
        continue
    
    PlanoOperacional.objects.create(
        pivo=pivo,
        fazenda=pivo.fazenda,
        cultura=cult,
        safra=d["safra"],
        data_plantio=d["data_plantio"],
        data_colheita_prevista=d["data_colheita_prevista"],
        data_plantio_real=d["data_plantio_real"],
        area_planejada_ha=d["area"],
        lamina_total_planejada_mm=d["lamina"],
        status=d["status"],
    )
    criados += 1

print(f"=== {criados} PLANOS OPERACIONAIS GERADOS COM SUCESSO! ===")
