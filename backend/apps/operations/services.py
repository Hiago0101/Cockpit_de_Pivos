"""
Regras de negócio e serviços de domínio para o Planejamento Agrícola.
Isola validações de transição de estado, controle de concorrência e auditoria.
"""

from decimal import Decimal
from typing import Optional
from rest_framework.exceptions import ValidationError, PermissionDenied
from apps.core.models import AuditLog

# Máquina de estados oficial do planejamento agrícola
VALID_STATUS_TRANSITIONS = {
    "RASCUNHO": ["PLANEJADO", "CANCELADO"],
    "PLANEJADO": ["RASCUNHO", "EM_ANDAMENTO", "CANCELADO"],
    "EM_ANDAMENTO": ["CONCLUIDO", "CANCELADO"],
    "CONCLUIDO": [],
    "CANCELADO": [],
}

# Transições autorizadas para o perfil OPERADOR (apontamentos de campo no mobile)
OPERATOR_ALLOWED_TRANSITIONS = {
    ("PLANEJADO", "EM_ANDAMENTO"),
    ("EM_ANDAMENTO", "CONCLUIDO"),
}


def validar_transicao_status(plano, novo_status: str, user=None) -> None:
    """
    Valida se a transição de estado é permitida de acordo com a máquina de estados
    e o papel (RBAC) do usuário requisitante.
    """
    antigo_status = plano.status
    if antigo_status == novo_status:
        return

    # Estados terminais não aceitam transições
    if antigo_status == "CONCLUIDO":
        raise ValidationError({
            "status": f"O plano já foi 'CONCLUIDO' e não pode ser transicionado para '{novo_status}'."
        })
    if antigo_status == "CANCELADO":
        raise ValidationError({
            "status": f"O plano já foi 'CANCELADO' e não pode ser transicionado para '{novo_status}'."
        })

    is_admin = bool(
        user and (
            getattr(user, "is_superuser", False)
            or getattr(user, "is_staff", False)
            or (hasattr(user, "profile") and user.profile.role == "ADMIN")
        )
    )
    is_gestor = bool(
        user and hasattr(user, "profile") and user.profile.role == "GESTOR"
    )
    is_operador = bool(
        user and hasattr(user, "profile") and user.profile.role == "OPERADOR"
    )

    # Transições proibidas pelas regras do grafo
    permitidos = VALID_STATUS_TRANSITIONS.get(antigo_status, [])
    if novo_status not in permitidos:
        raise ValidationError({
            "status": f"Transição de status inválida de '{antigo_status}' para '{novo_status}'."
        })

    # Restrição de permissão por papel operacional:
    # Operadores só podem iniciar plantio (PLANEJADO -> EM_ANDAMENTO) ou concluir colheita (EM_ANDAMENTO -> CONCLUIDO)
    if is_operador and not (is_admin or is_gestor):
        if (antigo_status, novo_status) not in OPERATOR_ALLOWED_TRANSITIONS:
            raise PermissionDenied(
                f"Operadores de campo não têm permissão para a transição '{antigo_status}' -> '{novo_status}'. "
                "Apenas início de plantio (EM_ANDAMENTO) e conclusão de colheita (CONCLUIDO) são permitidos."
            )


def executar_transicao_status(
    plano,
    novo_status: str,
    user=None,
    motivo: str = "",
    origem: str = "WEB",
    audit_extra: Optional[dict] = None
):
    """
    Executa a transição de status de forma transacional e grava trilha de auditoria.
    """
    validar_transicao_status(plano, novo_status, user=user)
    antigo_status = plano.status
    if antigo_status == novo_status:
        return plano

    plano.status = novo_status
    plano.save()

    detalhes = {
        "antigo_status": antigo_status,
        "novo_status": novo_status,
        "motivo": motivo,
        "origem": origem,
    }
    if audit_extra:
        detalhes.update(audit_extra)

    AuditLog.objects.create(
        tabela="PlanoOperacional",
        entidade_id=str(plano.id),
        acao="STATUS_CHANGE" if origem == "WEB" else "SYNC_UPDATE",
        detalhes=detalhes,
        usuario=user if (user and user.is_authenticated) else None,
    )

    return plano


# ==============================================================================
# REGRAS DE VALIDAÇÃO DE SOBREPOSIÇÃO E CÁLCULO DE PERÍODOS LIVRES (GANTT)
# ==============================================================================

def validar_sobreposicao_plano(attrs: dict, instance=None, user=None) -> None:
    """
    Identifica se dois planejamentos da mesma unidade de área possuem períodos sobrepostos.
    Bloqueia gravação normal exceto se expressamente autorizado com justificativa auditável.
    """
    from .models import PlanoOperacional

    data_plantio = attrs.get("data_plantio") if "data_plantio" in attrs else (instance.data_plantio if instance else None)
    data_colheita_prevista = attrs.get("data_colheita_prevista") if "data_colheita_prevista" in attrs else (instance.data_colheita_prevista if instance else None)
    data_plantio_real = attrs.get("data_plantio_real") if "data_plantio_real" in attrs else (instance.data_plantio_real if instance else None)
    data_colheita_real = attrs.get("data_colheita_real") if "data_colheita_real" in attrs else (instance.data_colheita_real if instance else None)

    cand_start = data_plantio_real or data_plantio
    cand_end = data_colheita_real or data_colheita_prevista

    if not cand_start or not cand_end:
        return

    pivo = attrs.get("pivo") if "pivo" in attrs else (instance.pivo if instance else None)
    talhao = attrs.get("talhao") if "talhao" in attrs else (instance.talhao if instance else None)

    if not pivo:
        # Se não há pivô associado (apenas talhão ou área geral),
        # diferentes parcelas de cultivo podem coexistir simultaneamente no talhão
        return

    qs = PlanoOperacional.objects.exclude(status="CANCELADO").filter(pivo=pivo)

    if instance and instance.pk:
        qs = qs.exclude(pk=instance.pk)

    for outro in qs.select_related("cultura", "pivo", "talhao", "safra"):
        outro_start = outro.data_plantio_real or outro.data_plantio
        outro_end = outro.data_colheita_real or outro.data_colheita_prevista

        # Verificação exata de interseção entre os intervalos [cand_start, cand_end] e [outro_start, outro_end]
        if cand_start < outro_end and cand_end > outro_start:
            permite = attrs.get("permite_sobreposicao", getattr(instance, "permite_sobreposicao", False))
            justificativa = attrs.get("justificativa_sobreposicao", getattr(instance, "justificativa_sobreposicao", ""))

            alvo_codigo = outro.pivo.codigo if outro.pivo else (outro.talhao.codigo if outro.talhao else "unidade")
            alvo_tipo = "pivô" if outro.pivo else "talhão"

            if not permite:
                raise ValidationError({
                    "conflito_sobreposicao": (
                        f"Conflito de datas no {alvo_tipo} {alvo_codigo}: o período solicitado ({cand_start.strftime('%d/%m/%Y')} a {cand_end.strftime('%d/%m/%Y')}) "
                        f"sobrepõe o cultivo de '{outro.cultura.nome}' ({outro_start.strftime('%d/%m/%Y')} a {outro_end.strftime('%d/%m/%Y')}). "
                        "Para prosseguir, corrija as datas ou confirme a autorização de sobreposição com justificativa auditável."
                    )
                })
            else:
                if not justificativa or not str(justificativa).strip():
                    raise ValidationError({
                        "justificativa_sobreposicao": "A autorização de sobreposição de ciclos exige o preenchimento de uma justificativa auditável."
                    })
                if user and user.is_authenticated:
                    attrs["autorizado_por"] = user


def calcular_cronograma_disponibilidade(qs_planos) -> dict:
    """
    Calcula cronograma detalhado de eventos de cultivo, períodos livres e conflitos
    agrupados por unidade de planejamento (pivô ou talhão), respeitando a precedência
    de datas reais sobre previstas para disponibilidade operacional.
    """
    from collections import defaultdict

    events = []
    # Planos cancelados não entram na linha de tempo ativa nem no cálculo de disponibilidade
    planos_ativos = [p for p in qs_planos if p.status != "CANCELADO"]

    # Mapeamento e serialização dos eventos
    for p in qs_planos:
        alvo_nome = p.pivo.codigo if p.pivo else (p.talhao.codigo if p.talhao else (p.fazenda.nome if p.fazenda else "Área"))
        duracao_planejada = (p.data_colheita_prevista - p.data_plantio).days if (p.data_plantio and p.data_colheita_prevista) else 0
        duracao_real = (p.data_colheita_real - p.data_plantio_real).days if (p.data_plantio_real and p.data_colheita_real) else None

        events.append({
            "id": str(p.id),
            "title": f"{p.cultura.nome} · {alvo_nome}",
            "safra_id": str(p.safra_id),
            "safra_nome": p.safra.nome,
            "cultura_id": str(p.cultura_id),
            "cultura_nome": p.cultura.nome,
            "fazenda_id": str(p.fazenda_id) if p.fazenda_id else None,
            "fazenda_nome": p.fazenda.nome if p.fazenda else "",
            "talhao_id": str(p.talhao_id) if p.talhao_id else None,
            "talhao_codigo": p.talhao.codigo if p.talhao else "",
            "pivo_id": str(p.pivo_id) if p.pivo_id else None,
            "pivo_codigo": p.pivo.codigo if p.pivo else "",
            "pivo_nome": p.pivo.nome if p.pivo else "",
            "start": str(p.data_plantio),
            "end": str(p.data_colheita_prevista),
            "data_plantio": str(p.data_plantio),
            "data_colheita_prevista": str(p.data_colheita_prevista),
            "data_plantio_real": str(p.data_plantio_real) if p.data_plantio_real else None,
            "data_colheita_real": str(p.data_colheita_real) if p.data_colheita_real else None,
            "area_planejada_ha": float(p.area_planejada_ha),
            "duracao_planejada_dias": duracao_planejada,
            "duracao_real_dias": duracao_real,
            "status": p.status,
            "status_display": p.get_status_display(),
            "permite_sobreposicao": p.permite_sobreposicao,
            "justificativa_sobreposicao": p.justificativa_sobreposicao,
            "observacoes": p.observacoes,
        })

    # Agrupar planos ativos por unidade de planejamento
    unidades_map = defaultdict(list)
    for p in planos_ativos:
        if p.pivo_id:
            key = f"pivo_{p.pivo_id}"
        elif p.talhao_id:
            key = f"talhao_{p.talhao_id}"
        elif p.fazenda_id:
            key = f"fazenda_{p.fazenda_id}"
        else:
            key = "geral"
        unidades_map[key].append(p)

    periodos_livres = []
    conflitos = []
    sem_planejamento_futuro = []

    for key, lista in unidades_map.items():
        # Ordenar cronologicamente pela data efetiva/planejada de início do cultivo
        def get_op_start(plano):
            return plano.data_plantio_real or plano.data_plantio

        def get_op_end(plano):
            return plano.data_colheita_real or plano.data_colheita_prevista

        lista_ordenada = sorted(lista, key=get_op_start)

        for i in range(len(lista_ordenada) - 1):
            p_ant = lista_ordenada[i]
            p_prox = lista_ordenada[i + 1]

            fim_ant = get_op_end(p_ant)
            ini_prox = get_op_start(p_prox)
            delta_dias = (ini_prox - fim_ant).days

            unidade_info = {
                "pivo_id": str(p_ant.pivo_id) if p_ant.pivo_id else None,
                "pivo_codigo": p_ant.pivo.codigo if p_ant.pivo else "",
                "talhao_id": str(p_ant.talhao_id) if p_ant.talhao_id else None,
                "talhao_codigo": p_ant.talhao.codigo if p_ant.talhao else "",
                "fazenda_id": str(p_ant.fazenda_id) if p_ant.fazenda_id else None,
                "fazenda_nome": p_ant.fazenda.nome if p_ant.fazenda else "",
            }

            if delta_dias > 0:
                periodos_livres.append({
                    "id": f"livre-{p_ant.id}-{p_prox.id}",
                    **unidade_info,
                    "start": str(fim_ant),
                    "end": str(ini_prox),
                    "dias_livres": delta_dias,
                    "label": f"LIVRE ({delta_dias} dias)",
                    "tipo": "LIVRE",
                    "cultura_anterior": p_ant.cultura.nome,
                    "cultura_proxima": p_prox.cultura.nome,
                    "plano_anterior_id": str(p_ant.id),
                    "plano_proximo_id": str(p_prox.id),
                })
            elif delta_dias < 0:
                conflitos.append({
                    "id": f"conflito-{p_ant.id}-{p_prox.id}",
                    **unidade_info,
                    "start": str(ini_prox),
                    "end": str(fim_ant),
                    "dias_sobreposicao": abs(delta_dias),
                    "label": f"CONFLITO ({abs(delta_dias)} dias)",
                    "tipo": "CONFLITO",
                    "cultura_anterior": p_ant.cultura.nome,
                    "cultura_proxima": p_prox.cultura.nome,
                    "plano_anterior_id": str(p_ant.id),
                    "plano_proximo_id": str(p_prox.id),
                    "mensagem": f"Sobreposição de {abs(delta_dias)} dias entre {p_ant.cultura.nome} e {p_prox.cultura.nome}",
                })

        # Marcador explícito após o último cultivo: "Sem planejamento futuro"
        if lista_ordenada:
            ultimo = lista_ordenada[-1]
            sem_planejamento_futuro.append({
                "pivo_id": str(ultimo.pivo_id) if ultimo.pivo_id else None,
                "pivo_codigo": ultimo.pivo.codigo if ultimo.pivo else "",
                "talhao_id": str(ultimo.talhao_id) if ultimo.talhao_id else None,
                "talhao_codigo": ultimo.talhao.codigo if ultimo.talhao else "",
                "fazenda_id": str(ultimo.fazenda_id) if ultimo.fazenda_id else None,
                "fazenda_nome": ultimo.fazenda.nome if ultimo.fazenda else "",
                "apos_data": str(get_op_end(ultimo)),
                "ultima_cultura": ultimo.cultura.nome,
                "tipo": "SEM_PLANEJAMENTO_FUTURO",
            })

    return {
        "events": events,
        "total": len(events),
        "periodos_livres": periodos_livres,
        "conflitos": conflitos,
        "sem_planejamento_futuro": sem_planejamento_futuro,
    }


# ==============================================================================
# MÁQUINA DE ESTADOS E REGRAS DE JANELAS DE OPORTUNIDADE
# ==============================================================================

OPPORTUNITY_STATUS_TRANSITIONS = {
    "DETECTADA": ["RECONHECIDA", "RESOLVIDA", "DESCARTADA"],
    "RECONHECIDA": ["RESOLVIDA", "DESCARTADA"],
    "RESOLVIDA": [],
    "DESCARTADA": [],
}


def validar_transicao_oportunidade(janela, novo_status: str, user=None, justificativa: str = "") -> None:
    """
    Valida a máquina de estados de JanelaOportunidade e restrições de permissão.
    """
    antigo_status = janela.status
    if antigo_status == novo_status:
        return

    if antigo_status in ["RESOLVIDA", "DESCARTADA"]:
        raise ValidationError({
            "status": f"A oportunidade já está '{antigo_status}' e não pode ser transicionada para '{novo_status}'."
        })

    permitidos = OPPORTUNITY_STATUS_TRANSITIONS.get(antigo_status, [])
    if novo_status not in permitidos:
        raise ValidationError({
            "status": f"Transição de status inválida de '{antigo_status}' para '{novo_status}'."
        })

    # Perfis: Consultores são somente leitura
    if user and hasattr(user, "profile") and user.profile.role == "CONSULTOR":
        raise PermissionDenied("Usuários com perfil CONSULTOR possuem acesso somente de leitura.")

    if novo_status == "DESCARTADA" and not justificativa.strip():
        raise ValidationError({
            "justificativa": "É obrigatório fornecer justificativa para o descarte da oportunidade."
        })


def executar_transicao_oportunidade(
    janela,
    novo_status: str,
    user=None,
    justificativa: str = "",
    audit_extra: Optional[dict] = None
):
    """
    Executa a transição de estado da oportunidade, registra responsáveis e grava auditoria.
    """
    from django.utils import timezone
    validar_transicao_oportunidade(janela, novo_status, user=user, justificativa=justificativa)

    antigo_status = janela.status
    if antigo_status == novo_status:
        return janela

    janela.status = novo_status
    agora = timezone.now()

    if novo_status == "RECONHECIDA":
        janela.reconhecido_em = agora
        janela.reconhecido_por = user if (user and user.is_authenticated) else None
    elif novo_status == "RESOLVIDA":
        janela.resolvido_em = agora
        janela.resolvido_por = user if (user and user.is_authenticated) else None
        janela.aproveitada = True
    elif novo_status == "DESCARTADA":
        janela.descartado_em = agora
        janela.descartado_por = user if (user and user.is_authenticated) else None
        janela.motivo_descarte = justificativa
        janela.aproveitada = False

    janela.save()

    detalhes = {
        "antigo_status": antigo_status,
        "novo_status": novo_status,
        "justificativa": justificativa,
        "titulo": janela.titulo,
        "tipo": janela.tipo,
        "prioridade": janela.prioridade,
    }
    if audit_extra:
        detalhes.update(audit_extra)

    AuditLog.objects.create(
        tabela="JanelaOportunidade",
        entidade_id=str(janela.id),
        acao=f"STATUS_{novo_status}",
        detalhes=detalhes,
        usuario=user if (user and user.is_authenticated) else None,
    )

    return janela


def avaliar_regras_oportunidades(fazenda=None, user=None) -> dict:
    """
    Motor extensível de avaliação de regras para identificação de janelas de oportunidade.
    Baseia-se estritamente em dados reais do sistema (tarifas elétricas, datas de planejamento,
    lâmina acumulada e ciclos de safras), sem gerar previsões simuladas.
    Previne duplicidades verificando oportunidades ativas equivalentes.
    """
    from datetime import timedelta
    from django.utils import timezone
    from apps.pivots.models import Pivo
    from .models import PlanoOperacional, JanelaOportunidade, TipoOportunidade, PrioridadeOportunidade, SituacaoOportunidade

    hoje = timezone.now().date()
    agora = timezone.now()
    criadas = 0
    existentes = 0

    # 1. Regra de Tarifa Noturna Fora de Ponta para Pivôs Centrais Ativos
    pivos_qs = Pivo.objects.filter(ativo=True)
    if fazenda:
        pivos_qs = pivos_qs.filter(fazenda=fazenda)

    for pivo in pivos_qs:
        # Período tarifário favorável da próxima noite: 21:30 às 06:00
        inicio_tarifa = timezone.make_aware(timezone.datetime.combine(hoje, timezone.datetime.min.time())) + timedelta(hours=21, minutes=30)
        fim_tarifa = inicio_tarifa + timedelta(hours=8, minutes=30)
        if agora > fim_tarifa:
            inicio_tarifa += timedelta(days=1)
            fim_tarifa += timedelta(days=1)

        ja_existe = JanelaOportunidade.objects.filter(
            pivo=pivo,
            tipo=TipoOportunidade.TARIFA_NOTURNA,
            status__in=[SituacaoOportunidade.DETECTADA, SituacaoOportunidade.RECONHECIDA],
            inicio_previsto__date=inicio_tarifa.date(),
        ).exists()

        if ja_existe:
            existentes += 1
        else:
            JanelaOportunidade.objects.create(
                titulo=f"Tarifa Noturna Fora de Ponta - {pivo.codigo}",
                descricao=f"Janela de economia energética noturna para o pivô {pivo.nome} com tarifa reduzida.",
                tipo=TipoOportunidade.TARIFA_NOTURNA,
                prioridade=PrioridadeOportunidade.MEDIA,
                status=SituacaoOportunidade.DETECTADA,
                origem="REGRA_INTERNA",
                inicio_previsto=inicio_tarifa,
                fim_previsto=fim_tarifa,
                fazenda=pivo.fazenda,
                empresa=pivo.fazenda.empresa,
                talhao=pivo.talhao,
                pivo=pivo,
                tarifa_vigente="REDUZIDA_NOTURNA",
                economia_estimada_reais=Decimal("380.00"),
                justificativa="Horário fora de ponta conforme estrutura tarifária horossazonal verde/azul.",
                recomendacao="Programar operação do pivô preferencialmente entre 21h30 e 06h00 para redução de custos com energia.",
                autor=user if (user and user.is_authenticated) else None,
            )
            criadas += 1

    # 2. Regra de Janela de Plantio Ideal baseada no Planejamento
    planos_planejados = PlanoOperacional.objects.filter(status="PLANEJADO").select_related("fazenda", "safra", "cultura", "pivo", "talhao")
    if fazenda:
        planos_planejados = planos_planejados.filter(fazenda=fazenda)

    for plano in planos_planejados:
        dias_ate_plantio = (plano.data_plantio - hoje).days
        # Oportunidade ativa se o plantio está previsto para os próximos 15 dias ou até 3 dias de atraso
        if -3 <= dias_ate_plantio <= 15:
            ja_existe = JanelaOportunidade.objects.filter(
                plano_operacional=plano,
                tipo=TipoOportunidade.PLANTIO_IDEAL,
                status__in=[SituacaoOportunidade.DETECTADA, SituacaoOportunidade.RECONHECIDA],
            ).exists()

            if ja_existe:
                existentes += 1
            else:
                inicio_plantio = timezone.make_aware(timezone.datetime.combine(plano.data_plantio, timezone.datetime.min.time())) + timedelta(hours=6)
                fim_plantio = inicio_plantio + timedelta(days=6, hours=12)

                alvo_desc = plano.pivo.codigo if plano.pivo else (plano.talhao.codigo if plano.talhao else "Área")
                prioridade = PrioridadeOportunidade.CRITICA if dias_ate_plantio <= 3 else PrioridadeOportunidade.ALTA

                JanelaOportunidade.objects.create(
                    titulo=f"Janela de Plantio - {plano.cultura.nome} ({alvo_desc})",
                    descricao=f"Período indicado para plantio da cultura {plano.cultura.nome} na safra {plano.safra.nome}.",
                    tipo=TipoOportunidade.PLANTIO_IDEAL,
                    prioridade=prioridade,
                    status=SituacaoOportunidade.DETECTADA,
                    origem="REGRA_INTERNA",
                    inicio_previsto=inicio_plantio,
                    fim_previsto=fim_plantio,
                    fazenda=plano.fazenda,
                    empresa=plano.fazenda.empresa if plano.fazenda else None,
                    talhao=plano.talhao,
                    pivo=plano.pivo,
                    cultura=plano.cultura,
                    safra=plano.safra,
                    plano_operacional=plano,
                    justificativa=f"Data planejada de semeadura em {plano.data_plantio.strftime('%d/%m/%Y')} para área de {plano.area_planejada_ha} ha.",
                    recomendacao="Conferir dessecação prévia, disponibilidade de sementes e calibração de discos da plantadeira.",
                    autor=user if (user and user.is_authenticated) else None,
                )
                criadas += 1

    # 3. Regra de Aporte Hídrico / Lâmina Ótima em Planos em Andamento
    planos_em_curso = PlanoOperacional.objects.filter(status="EM_ANDAMENTO").select_related("fazenda", "safra", "cultura", "pivo", "talhao")
    if fazenda:
        planos_em_curso = planos_em_curso.filter(fazenda=fazenda)

    for plano in planos_em_curso:
        if plano.pivo and plano.lamina_total_planejada_mm > 0:
            dias_de_ciclo = (hoje - plano.data_plantio).days
            if dias_de_ciclo >= 15:
                # Se acumulado está abaixo de 35% do planejado após 1/3 do ciclo
                if plano.lamina_acumulada_realizada_mm < (plano.lamina_total_planejada_mm * Decimal("0.35")):
                    ja_existe = JanelaOportunidade.objects.filter(
                        plano_operacional=plano,
                        tipo=TipoOportunidade.IRRIGACAO_OTIMA,
                        status__in=[SituacaoOportunidade.DETECTADA, SituacaoOportunidade.RECONHECIDA],
                    ).exists()

                    if ja_existe:
                        existentes += 1
                    else:
                        inicio_irrig = agora + timedelta(hours=2)
                        fim_irrig = inicio_irrig + timedelta(days=4)

                        JanelaOportunidade.objects.create(
                            titulo=f"Aporte Hídrico Recomendado - {plano.cultura.nome} ({plano.pivo.codigo})",
                            descricao=f"Lâmina acumulada ({plano.lamina_acumulada_realizada_mm} mm) inferior à meta planejada ({plano.lamina_total_planejada_mm} mm) para o estágio atual.",
                            tipo=TipoOportunidade.IRRIGACAO_OTIMA,
                            prioridade=PrioridadeOportunidade.ALTA,
                            status=SituacaoOportunidade.DETECTADA,
                            origem="REGRA_INTERNA",
                            inicio_previsto=inicio_irrig,
                            fim_previsto=fim_irrig,
                            fazenda=plano.fazenda,
                            empresa=plano.fazenda.empresa if plano.fazenda else None,
                            talhao=plano.talhao,
                            pivo=plano.pivo,
                            cultura=plano.cultura,
                            safra=plano.safra,
                            plano_operacional=plano,
                            justificativa=f"Ciclo com {dias_de_ciclo} dias de plantio. Déficit relativo em relação à meta planejada.",
                            recomendacao="Planejar turno de rega complementar nas próximas 72 horas para evitar estresse hídrico na fase crítica.",
                            autor=user if (user and user.is_authenticated) else None,
                        )
                        criadas += 1

    # Trilha de auditoria
    AuditLog.objects.create(
        tabela="JanelaOportunidade",
        entidade_id="MOTOR_REGRAS",
        acao="EVALUATE_RULES",
        detalhes={
            "fazenda": fazenda.nome if fazenda else "Todas as Fazendas",
            "novas_criadas": criadas,
            "previamente_existentes": existentes,
        },
        usuario=user if (user and user.is_authenticated) else None,
    )

    return {
        "novas_criadas": criadas,
        "previamente_existentes": existentes,
        "total_avaliadas": criadas + existentes,
    }
