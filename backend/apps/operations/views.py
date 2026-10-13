from rest_framework import viewsets, status, serializers
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from apps.pivots.models import Pivo, Fazenda
from apps.core.permissions import IsAdminOrManager, IsFieldOperatorOrAbove
from .models import (
    Cultura,
    Safra,
    PlanoOperacional,
    RegistroIrrigacao,
    Alerta,
    JanelaOportunidade,
    TipoOportunidade,
    PrioridadeOportunidade,
    SituacaoOportunidade,
    OrigemOportunidade,
)
from .serializers import (
    CulturaSerializer,
    SafraSerializer,
    PlanoOperacionalSerializer,
    RegistroIrrigacaoSerializer,
    AlertaSerializer,
    JanelaOportunidadeSerializer,
)
from .services import (
    executar_transicao_status,
    executar_transicao_oportunidade,
    avaliar_regras_oportunidades,
    calcular_cronograma_disponibilidade,
)
from drf_spectacular.utils import extend_schema

from django.db.models import Q, Sum, Count
from apps.core.models import AuditLog

class CulturaViewSet(viewsets.ModelViewSet):
    """Cadastro, consulta e manutenção de culturas agrícolas."""
    queryset = Cultura.objects.all()
    serializer_class = CulturaSerializer

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [IsAuthenticated()]
        return [IsAdminOrManager()]

    def get_queryset(self):
        qs = super().get_queryset()
        fazenda = self.request.query_params.get("fazenda")
        if fazenda:
            qs = qs.filter(fazenda_id=fazenda)

        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(
                Q(descricao__icontains=search) |
                Q(id_pims__icontains=search) |
                Q(fazenda__nome__icontains=search) |
                Q(fazenda__filial__icontains=search)
            )
        return qs

class SafraViewSet(viewsets.ModelViewSet):
    """Gestão de Safras e ciclos anuais de cultivo."""
    queryset = Safra.objects.all()
    serializer_class = SafraSerializer

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [IsAuthenticated()]
        return [IsAdminOrManager()]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_authenticated and not (user.is_superuser or user.is_staff):
            profile = getattr(user, "profile", None)
            if profile and profile.role != "ADMIN" and profile.fazendas.exists():
                qs = qs.filter(Q(fazenda__in=profile.fazendas.all()) | Q(fazenda__isnull=True))

        ativa = self.request.query_params.get("ativa")
        if ativa is not None:
            if ativa.lower() in ["true", "1"]:
                qs = qs.filter(ativa=True)
            elif ativa.lower() in ["false", "0"]:
                qs = qs.filter(ativa=False)

        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param)

        fazenda_id = self.request.query_params.get("fazenda")
        if fazenda_id:
            qs = qs.filter(Q(fazenda_id=fazenda_id) | Q(fazenda__isnull=True))

        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(nome__icontains=search)
        return qs

class PlanoOperacionalViewSet(viewsets.ModelViewSet):
    """Planejamento agrícola com validações agronômicas, transição de estado e trilha de auditoria."""
    queryset = PlanoOperacional.objects.select_related("safra", "cultura", "fazenda", "talhao", "pivo").all()
    serializer_class = PlanoOperacionalSerializer

    def get_permissions(self):
        if self.action in ["list", "retrieve", "calendario", "indicadores", "historico_auditoria"]:
            return [IsAuthenticated()]
        return [IsAdminOrManager()]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user

        # Isolamento por Fazenda autorizado ao perfil
        if user.is_authenticated and not (user.is_superuser or user.is_staff):
            profile = getattr(user, "profile", None)
            if profile and profile.role != "ADMIN" and profile.fazendas.exists():
                qs = qs.filter(fazenda__in=profile.fazendas.all())

        # Filtros relacionais e dimensionais
        safra_id = self.request.query_params.get("safra")
        if safra_id:
            qs = qs.filter(safra_id=safra_id)

        fazenda_id = self.request.query_params.get("fazenda")
        if fazenda_id:
            qs = qs.filter(fazenda_id=fazenda_id)

        cultura_id = self.request.query_params.get("cultura")
        if cultura_id:
            qs = qs.filter(cultura_id=cultura_id)

        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)

        pivo_id = self.request.query_params.get("pivo")
        if pivo_id:
            qs = qs.filter(pivo_id=pivo_id)

        talhao_id = self.request.query_params.get("talhao")
        if talhao_id:
            qs = qs.filter(talhao_id=talhao_id)

        data_inicio = self.request.query_params.get("data_inicio")
        if data_inicio:
            qs = qs.filter(data_plantio__gte=data_inicio)

        data_fim = self.request.query_params.get("data_fim")
        if data_fim:
            qs = qs.filter(data_colheita_prevista__lte=data_fim)

        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(
                Q(cultura__descricao__icontains=search) |
                Q(safra__nome__icontains=search) |
                Q(pivo__codigo__icontains=search) |
                Q(pivo__nome__icontains=search) |
                Q(talhao__codigo__icontains=search) |
                Q(fazenda__nome__icontains=search) |
                Q(observacoes__icontains=search)
            )

        ordering = self.request.query_params.get("ordering")
        if ordering:
            qs = qs.order_by(ordering)

        return qs

    def perform_create(self, serializer):
        instance = serializer.save()
        AuditLog.objects.create(
            tabela="PlanoOperacional",
            entidade_id=str(instance.id),
            acao="CREATE",
            detalhes={
                "safra": instance.safra.nome,
                "cultura": instance.cultura.nome,
                "fazenda": instance.fazenda.nome if instance.fazenda else "",
                "pivo": instance.pivo.codigo if instance.pivo else "",
                "talhao": instance.talhao.codigo if instance.talhao else "",
                "area_planejada_ha": float(instance.area_planejada_ha),
                "data_plantio": str(instance.data_plantio),
                "data_colheita_prevista": str(instance.data_colheita_prevista),
                "data_plantio_real": str(instance.data_plantio_real) if instance.data_plantio_real else None,
                "data_colheita_real": str(instance.data_colheita_real) if instance.data_colheita_real else None,
                "permite_sobreposicao": instance.permite_sobreposicao,
                "justificativa_sobreposicao": instance.justificativa_sobreposicao,
                "status": instance.status,
            },
            usuario=self.request.user if self.request.user.is_authenticated else None,
        )

    def perform_update(self, serializer):
        old_status = serializer.instance.status
        instance = serializer.save()
        AuditLog.objects.create(
            tabela="PlanoOperacional",
            entidade_id=str(instance.id),
            acao="UPDATE",
            detalhes={
                "antigo_status": old_status,
                "novo_status": instance.status,
                "area_planejada_ha": float(instance.area_planejada_ha),
                "data_plantio": str(instance.data_plantio),
                "data_colheita_prevista": str(instance.data_colheita_prevista),
                "data_plantio_real": str(instance.data_plantio_real) if instance.data_plantio_real else None,
                "data_colheita_real": str(instance.data_colheita_real) if instance.data_colheita_real else None,
                "permite_sobreposicao": instance.permite_sobreposicao,
                "justificativa_sobreposicao": instance.justificativa_sobreposicao,
            },
            usuario=self.request.user if self.request.user.is_authenticated else None,
        )

    def perform_destroy(self, instance):
        # Exclusão segura: se houver histórico de irrigação ou estiver em andamento/concluído, cancela em vez de apagar
        tem_historico = instance.irrigações.exists() if hasattr(instance, "irrigações") else False
        if tem_historico or instance.status in ["EM_ANDAMENTO", "CONCLUIDO"]:
            instance.status = "CANCELADO"
            instance.save()
            AuditLog.objects.create(
                tabela="PlanoOperacional",
                entidade_id=str(instance.id),
                acao="CANCEL",
                detalhes={"motivo": "Cancelado via exclusão lógica por conter dependências operacionais."},
                usuario=self.request.user if self.request.user.is_authenticated else None,
            )
        else:
            plan_id = str(instance.id)
            instance.delete()
            AuditLog.objects.create(
                tabela="PlanoOperacional",
                entidade_id=plan_id,
                acao="DELETE",
                detalhes={"status": instance.status},
                usuario=self.request.user if self.request.user.is_authenticated else None,
            )

    @action(detail=True, methods=["post"], url_path="transicionar-status", permission_classes=[IsAdminOrManager])
    def transicionar_status(self, request, pk=None):
        plano = self.get_object()
        novo_status = request.data.get("status")
        motivo = request.data.get("motivo", "")

        if not novo_status:
            return Response({"status": "O novo status é obrigatório."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            plano = executar_transicao_status(
                plano=plano,
                novo_status=novo_status,
                user=request.user,
                motivo=motivo,
                origem="WEB"
            )
        except Exception as exc:
            msg = exc.detail if hasattr(exc, "detail") else str(exc)
            if isinstance(msg, dict):
                return Response(msg, status=status.HTTP_400_BAD_REQUEST)
            return Response({"detail": str(msg)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(PlanoOperacionalSerializer(plano, context={"request": request}).data)

    @action(detail=False, methods=["get"], url_path="calendario", permission_classes=[IsAuthenticated])
    def calendario(self, request):
        qs = self.filter_queryset(self.get_queryset())
        ano = request.query_params.get("ano")
        if ano and ano.isdigit():
            ano_num = int(ano)
            qs = qs.filter(Q(data_plantio__year=ano_num) | Q(data_colheita_prevista__year=ano_num))

        dados_calendario = calcular_cronograma_disponibilidade(qs)
        return Response(dados_calendario)

    @action(detail=False, methods=["get"], url_path="indicadores", permission_classes=[IsAuthenticated])
    def indicadores(self, request):
        qs = self.filter_queryset(self.get_queryset())
        total_planos = qs.count()

        statuses = ["RASCUNHO", "PLANEJADO", "EM_ANDAMENTO", "CONCLUIDO", "CANCELADO"]
        planos_por_status = {s: qs.filter(status=s).count() for s in statuses}

        # Área total planejada (exclui cancelados para não inflacionar o cálculo)
        ativos_qs = qs.exclude(status="CANCELADO")
        area_total_ha = float(sum(p.area_planejada_ha for p in ativos_qs))

        # Distribuição por cultura
        culturas_dict = {}
        for p in ativos_qs:
            c_id = str(p.cultura_id)
            if c_id not in culturas_dict:
                culturas_dict[c_id] = {
                    "cultura_id": c_id,
                    "cultura_nome": p.cultura.nome,
                    "area_ha": 0.0,
                    "planos_count": 0,
                }
            culturas_dict[c_id]["area_ha"] = round(culturas_dict[c_id]["area_ha"] + float(p.area_planejada_ha), 2)
            culturas_dict[c_id]["planos_count"] += 1
        area_por_cultura = sorted(culturas_dict.values(), key=lambda x: x["area_ha"], reverse=True)

        # Distribuição por safra
        safras_dict = {}
        for p in ativos_qs:
            s_id = str(p.safra_id)
            if s_id not in safras_dict:
                safras_dict[s_id] = {
                    "safra_id": s_id,
                    "safra_nome": p.safra.nome,
                    "area_ha": 0.0,
                    "planos_count": 0,
                }
            safras_dict[s_id]["area_ha"] = round(safras_dict[s_id]["area_ha"] + float(p.area_planejada_ha), 2)
            safras_dict[s_id]["planos_count"] += 1
        area_por_safra = sorted(safras_dict.values(), key=lambda x: x["area_ha"], reverse=True)

        # Distribuição por fazenda
        fazendas_dict = {}
        for p in ativos_qs:
            f_id = str(p.fazenda_id) if p.fazenda_id else "sem-fazenda"
            f_nome = p.fazenda.nome if p.fazenda else "Geral / Não atribuída"
            if f_id not in fazendas_dict:
                fazendas_dict[f_id] = {
                    "fazenda_id": f_id,
                    "fazenda_nome": f_nome,
                    "area_ha": 0.0,
                    "planos_count": 0,
                }
            fazendas_dict[f_id]["area_ha"] = round(fazendas_dict[f_id]["area_ha"] + float(p.area_planejada_ha), 2)
            fazendas_dict[f_id]["planos_count"] += 1
        planos_por_fazenda = sorted(fazendas_dict.values(), key=lambda x: x["area_ha"], reverse=True)

        # Próximos plantios nos próximos 60 dias
        hoje = timezone.localdate()
        proximos_plantios_qs = qs.filter(
            data_plantio__gte=hoje,
            status__in=["RASCUNHO", "PLANEJADO"]
        ).order_by("data_plantio")[:10]

        proximos_plantios = []
        for p in proximos_plantios_qs:
            proximos_plantios.append({
                "id": str(p.id),
                "cultura_nome": p.cultura.nome,
                "safra_nome": p.safra.nome,
                "fazenda_nome": p.fazenda.nome if p.fazenda else "",
                "alvo": p.pivo.codigo if p.pivo else (p.talhao.codigo if p.talhao else ""),
                "data_plantio": str(p.data_plantio),
                "area_planejada_ha": float(p.area_planejada_ha),
                "status": p.status,
            })

        return Response({
            "timestamp": timezone.now().isoformat(),
            "total_planos": total_planos,
            "planos_por_status": planos_por_status,
            "area_total_planejada_ha": round(area_total_ha, 2),
            "area_por_cultura": area_por_cultura,
            "area_por_safra": area_por_safra,
            "planos_por_fazenda": planos_por_fazenda,
            "proximos_plantios": proximos_plantios,
        })

    @action(detail=True, methods=["get"], url_path="historico-auditoria", permission_classes=[IsAuthenticated])
    def historico_auditoria(self, request, pk=None):
        plano = self.get_object()
        logs = AuditLog.objects.filter(
            tabela="PlanoOperacional",
            entidade_id=str(plano.id)
        ).select_related("usuario")[:50]

        data = []
        for l in logs:
            data.append({
                "id": str(l.id),
                "acao": l.acao,
                "detalhes": l.detalhes,
                "usuario": l.usuario.username if l.usuario else "Sistema",
                "ip_address": l.ip_address,
                "criado_em": l.criado_em.isoformat(),
            })
        return Response({"results": data, "total": len(data)})

class RegistroIrrigacaoViewSet(viewsets.ModelViewSet):
    """Apontamentos de campo e histórico de lâmina de irrigação."""
    queryset = RegistroIrrigacao.objects.select_related("pivo", "operador").all()
    serializer_class = RegistroIrrigacaoSerializer
    permission_classes = [IsFieldOperatorOrAbove]

    def create(self, request, *args, **kwargs):
        client_op_id = request.data.get("client_op_id")
        if client_op_id:
            existente = RegistroIrrigacao.objects.filter(client_op_id=client_op_id).first()
            if existente:
                serializer = self.get_serializer(existente)
                return Response(serializer.data, status=status.HTTP_200_OK)
        return super().create(request, *args, **kwargs)

class AlertaViewSet(viewsets.ModelViewSet):
    """Alertas e monitoramento de anomalias operacionais."""
    queryset = Alerta.objects.select_related("pivo").all()
    serializer_class = AlertaSerializer
    permission_classes = [IsFieldOperatorOrAbove]

    @action(detail=True, methods=["post"], url_path="reconhecer")
    def reconhecer(self, request, pk=None):
        alerta = self.get_object()
        alerta.reconhecido_em = timezone.now()
        if request.user.is_authenticated:
            alerta.reconhecido_por = request.user
        alerta.save()
        return Response(AlertaSerializer(alerta).data)

    @action(detail=True, methods=["post"], url_path="resolver")
    def resolver(self, request, pk=None):
        alerta = self.get_object()
        alerta.resolvido_em = timezone.now()
        alerta.save()
        return Response(AlertaSerializer(alerta).data)

class JanelaOportunidadeViewSet(viewsets.ModelViewSet):
    """Gestão centralizada de Janelas de Oportunidade Agrícola."""
    queryset = JanelaOportunidade.objects.select_related(
        "pivo", "fazenda", "empresa", "talhao", "cultura", "safra", "plano_operacional",
        "autor", "reconhecido_por", "resolvido_por", "descartado_por"
    ).all()
    serializer_class = JanelaOportunidadeSerializer

    def get_permissions(self):
        if self.action in ["list", "retrieve", "indicadores", "historico_auditoria"]:
            return [IsAuthenticated()]
        if self.action in ["reconhecer", "resolver", "descartar", "avaliar_regras"]:
            return [IsFieldOperatorOrAbove()]
        return [IsAdminOrManager()]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user

        # Isolamento e controle de acesso baseado no perfil do usuário
        if user.is_authenticated and not (user.is_superuser or user.is_staff):
            profile = getattr(user, "profile", None)
            if profile and profile.role != "ADMIN" and profile.fazendas.exists():
                qs = qs.filter(Q(fazenda__in=profile.fazendas.all()) | Q(fazenda__isnull=True))

        # Filtros relacionais estruturais e agrícolas
        empresa_id = self.request.query_params.get("empresa")
        if empresa_id:
            qs = qs.filter(empresa_id=empresa_id)

        fazenda_id = self.request.query_params.get("fazenda")
        if fazenda_id:
            qs = qs.filter(fazenda_id=fazenda_id)

        talhao_id = self.request.query_params.get("talhao")
        if talhao_id:
            qs = qs.filter(talhao_id=talhao_id)

        pivo_id = self.request.query_params.get("pivo")
        if pivo_id:
            qs = qs.filter(pivo_id=pivo_id)

        cultura_id = self.request.query_params.get("cultura")
        if cultura_id:
            qs = qs.filter(cultura_id=cultura_id)

        safra_id = self.request.query_params.get("safra")
        if safra_id:
            qs = qs.filter(safra_id=safra_id)

        plano_id = self.request.query_params.get("plano_operacional") or self.request.query_params.get("plano")
        if plano_id:
            qs = qs.filter(plano_operacional_id=plano_id)

        # Filtros de classificação e ciclo de vida
        tipo = self.request.query_params.get("tipo")
        if tipo:
            qs = qs.filter(tipo=tipo)

        prioridade = self.request.query_params.get("prioridade")
        if prioridade:
            qs = qs.filter(prioridade=prioridade)

        st = self.request.query_params.get("status") or self.request.query_params.get("situacao")
        if st:
            qs = qs.filter(status=st)

        origem = self.request.query_params.get("origem")
        if origem:
            qs = qs.filter(origem=origem)

        aproveitada = self.request.query_params.get("aproveitada")
        if aproveitada is not None:
            if aproveitada.lower() in ["true", "1"]:
                qs = qs.filter(aproveitada=True)
            elif aproveitada.lower() in ["false", "0"]:
                qs = qs.filter(aproveitada=False)

        # Filtro de janelas vencidas
        vencida = self.request.query_params.get("vencida")
        if vencida is not None:
            agora = timezone.now()
            if vencida.lower() in ["true", "1"]:
                qs = qs.filter(fim_previsto__lt=agora, status__in=["DETECTADA", "RECONHECIDA"])
            elif vencida.lower() in ["false", "0"]:
                qs = qs.filter(Q(fim_previsto__gte=agora) | Q(status__in=["RESOLVIDA", "DESCARTADA"]))

        data_inicio = self.request.query_params.get("data_inicio")
        if data_inicio:
            qs = qs.filter(inicio_previsto__gte=data_inicio)

        data_fim = self.request.query_params.get("data_fim")
        if data_fim:
            qs = qs.filter(fim_previsto__lte=data_fim)

        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(
                Q(titulo__icontains=search) |
                Q(descricao__icontains=search) |
                Q(motivo__icontains=search) |
                Q(justificativa__icontains=search) |
                Q(pivo__codigo__icontains=search) |
                Q(pivo__nome__icontains=search) |
                Q(fazenda__nome__icontains=search) |
                Q(cultura__descricao__icontains=search) |
                Q(safra__nome__icontains=search)
            )

        ordering = self.request.query_params.get("ordering")
        if ordering:
            qs = qs.order_by(ordering)

        return qs

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        instance = serializer.save(autor=user)
        AuditLog.objects.create(
            tabela="JanelaOportunidade",
            entidade_id=str(instance.id),
            acao="CREATE",
            detalhes={
                "titulo": instance.titulo,
                "tipo": instance.tipo,
                "prioridade": instance.prioridade,
                "status": instance.status,
                "inicio_previsto": instance.inicio_previsto.isoformat() if instance.inicio_previsto else "",
                "fim_previsto": instance.fim_previsto.isoformat() if instance.fim_previsto else "",
                "fazenda": instance.fazenda.nome if instance.fazenda else "",
                "pivo": instance.pivo.codigo if instance.pivo else "",
            },
            usuario=user,
        )

    def perform_update(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        old_status = serializer.instance.status
        instance = serializer.save()
        AuditLog.objects.create(
            tabela="JanelaOportunidade",
            entidade_id=str(instance.id),
            acao="UPDATE",
            detalhes={
                "titulo": instance.titulo,
                "antigo_status": old_status,
                "novo_status": instance.status,
                "prioridade": instance.prioridade,
            },
            usuario=user,
        )

    def perform_destroy(self, instance):
        if instance.status == "RESOLVIDA":
            raise serializers.ValidationError({
                "detail": "Oportunidades já resolvidas não podem ser excluídas para preservar o histórico operacional. Descarte a oportunidade caso necessário."
            })
        user = self.request.user if self.request.user.is_authenticated else None
        AuditLog.objects.create(
            tabela="JanelaOportunidade",
            entidade_id=str(instance.id),
            acao="DELETE",
            detalhes={
                "titulo": instance.titulo,
                "status": instance.status,
                "motivo": instance.motivo,
            },
            usuario=user,
        )
        instance.delete()

    @action(detail=True, methods=["post"], url_path="reconhecer")
    def reconhecer(self, request, pk=None):
        """Transiciona oportunidade para RECONHECIDA pela equipe de campo."""
        janela = self.get_object()
        janela = executar_transicao_oportunidade(janela, "RECONHECIDA", user=request.user)
        return Response(JanelaOportunidadeSerializer(janela).data)

    @action(detail=True, methods=["post"], url_path="resolver")
    def resolver(self, request, pk=None):
        """Marca oportunidade como RESOLVIDA / aproveitada."""
        janela = self.get_object()
        justificativa = request.data.get("justificativa", "")
        janela = executar_transicao_oportunidade(janela, "RESOLVIDA", user=request.user, justificativa=justificativa)
        return Response(JanelaOportunidadeSerializer(janela).data)

    @action(detail=True, methods=["post"], url_path="descartar")
    def descartar(self, request, pk=None):
        """Marca oportunidade como DESCARTADA mediante justificativa obrigatória."""
        janela = self.get_object()
        justificativa = request.data.get("justificativa") or request.data.get("motivo_descarte", "")
        janela = executar_transicao_oportunidade(janela, "DESCARTADA", user=request.user, justificativa=justificativa)
        return Response(JanelaOportunidadeSerializer(janela).data)

    @action(detail=False, methods=["post"], url_path="avaliar-regras")
    def avaliar_regras(self, request):
        """Executa regras automáticas para geração/atualização de oportunidades sem duplicidade."""
        fazenda_id = request.data.get("fazenda") or request.query_params.get("fazenda")
        fazenda = None
        if fazenda_id:
            fazenda = Fazenda.objects.filter(id=fazenda_id).first()
        res = avaliar_regras_oportunidades(fazenda=fazenda, user=request.user)
        return Response(res, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"], url_path="indicadores")
    def indicadores(self, request):
        """Métricas e contadores consolidados de oportunidades."""
        qs = self.get_queryset()
        agora = timezone.now()
        total = qs.count()
        detectadas = qs.filter(status="DETECTADA").count()
        reconhecidas = qs.filter(status="RECONHECIDA").count()
        resolvidas = qs.filter(status="RESOLVIDA").count()
        descartadas = qs.filter(status="DESCARTADA").count()
        ativas = detectadas + reconhecidas
        vencidas = qs.filter(fim_previsto__lt=agora, status__in=["DETECTADA", "RECONHECIDA"]).count()

        por_prioridade = {
            "CRITICA": qs.filter(prioridade="CRITICA").count(),
            "ALTA": qs.filter(prioridade="ALTA").count(),
            "MEDIA": qs.filter(prioridade="MEDIA").count(),
            "BAIXA": qs.filter(prioridade="BAIXA").count(),
        }

        por_tipo = {}
        for t, _ in TipoOportunidade.choices:
            por_tipo[t] = qs.filter(tipo=t).count()

        return Response({
            "total": total,
            "ativas": ativas,
            "detectadas": detectadas,
            "reconhecidas": reconhecidas,
            "resolvidas": resolvidas,
            "descartadas": descartadas,
            "vencidas": vencidas,
            "por_prioridade": por_prioridade,
            "por_tipo": por_tipo,
        })

    @action(detail=True, methods=["get"], url_path="historico-auditoria")
    def historico_auditoria(self, request, pk=None):
        """Retorna histórico de auditoria associado à oportunidade."""
        janela = self.get_object()
        logs = AuditLog.objects.filter(tabela="JanelaOportunidade", entidade_id=str(janela.id)).order_by("-criado_em")
        data = [
            {
                "id": str(log.id),
                "acao": log.acao,
                "detalhes": log.detalhes,
                "usuario": log.usuario.username if log.usuario else "Sistema",
                "criado_em": log.criado_em.isoformat(),
            }
            for log in logs
        ]
        return Response({"results": data, "total": len(data)})

@extend_schema(responses={200: serializers.DictField()})
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def cockpit_resumo(request):
    """Endpoint consolidado de indicadores operacionais (requer autenticação)."""
    pivos = Pivo.objects.filter(ativo=True)
    total_pivos = pivos.count()
    irrigando = pivos.filter(status_operacional__in=["IRRIGANDO", "FERTIRRIGANDO"]).count()
    parados = pivos.filter(status_operacional="PARADO").count()
    falhas = pivos.filter(status_operacional="FALHA").count()
    manutencao = pivos.filter(status_operacional="MANUTENCAO").count()
    
    area_total_ha = sum(float(p.area_irrigada_ha) for p in pivos)
    
    alertas_criticos = Alerta.objects.filter(resolvido_em__isnull=True, severidade="CRITICO").count()
    alertas_atencao = Alerta.objects.filter(resolvido_em__isnull=True, severidade="ATENCAO").count()
    
    janelas_ativas = JanelaOportunidade.objects.filter(aproveitada=False).count()
    
    return Response({
        "timestamp": timezone.now().isoformat(),
        "indicadores": {
            "total_pivos": total_pivos,
            "irrigando_count": irrigando,
            "parados_count": parados,
            "falhas_count": falhas,
            "manutencao_count": manutencao,
            "area_total_ha": round(area_total_ha, 2),
            "taxa_operacao_pct": round((irrigando / total_pivos * 100), 1) if total_pivos > 0 else 0,
            "alertas_criticos": alertas_criticos,
            "alertas_atencao": alertas_atencao,
            "janelas_ativas": janelas_ativas,
        }
    })
