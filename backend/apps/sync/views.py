from django.db import transaction
from django.utils.dateparse import parse_datetime
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.exceptions import ValidationError, PermissionDenied
from django.utils import timezone
from apps.pivots.models import Empresa, Fazenda, Talhao, Pivo
from apps.pivots.serializers import EmpresaSerializer, FazendaSerializer, TalhaoSerializer, PivoSerializer
from apps.operations.models import Cultura, Safra, PlanoOperacional, RegistroIrrigacao, Alerta, JanelaOportunidade
from apps.operations.services import validar_transicao_status, executar_transicao_status
from apps.operations.serializers import (
    CulturaSerializer,
    SafraSerializer,
    PlanoOperacionalSerializer,
    RegistroIrrigacaoSerializer,
    AlertaSerializer,
    JanelaOportunidadeSerializer,
)
from apps.core.models import AuditLog
from .models import ProcessedOperation
from .serializers import SyncPushBatchSerializer
from drf_spectacular.utils import extend_schema
from rest_framework import serializers

from apps.core.permissions import IsFieldOperatorOrAbove
from rest_framework.permissions import IsAuthenticated

class SyncConflictError(Exception):
    """Exceção levantada quando há conflito de concorrência ou versão desatualizada na sincronização."""
    def __init__(self, message, server_entity_id=None):
        super().__init__(message)
        self.server_entity_id = server_entity_id

class SyncPushView(APIView):
    """Endpoint de sincronização em lote com proteção estrita de idempotência, validação de transições e detecção de conflitos."""
    permission_classes = [IsFieldOperatorOrAbove]

    @extend_schema(request=SyncPushBatchSerializer, responses={200: serializers.DictField()})
    def post(self, request):
        serializer = SyncPushBatchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        device_id = serializer.validated_data.get("client_device_id", "DESCONHECIDO")
        operations = serializer.validated_data.get("operations", [])
        results = []

        for op in operations:
            client_op_id = op["client_op_id"]
            entity = op["entity"]
            action = op["action"]
            payload = op["payload"]

            # 1. Verificação de idempotência (já foi processado anteriormente?)
            already_processed = ProcessedOperation.objects.filter(client_op_id=client_op_id).first()
            if already_processed:
                results.append({
                    "client_op_id": str(client_op_id),
                    "status": already_processed.status,
                    "server_id": already_processed.server_entity_id or None,
                    "idempotent": True,
                    "message": already_processed.response_payload.get("message", "Operação já processada anteriormente no servidor.")
                })
                continue

            # 2. Execução da mutação com isolamento transacional
            try:
                server_id = None
                with transaction.atomic():
                    if entity == "registro_irrigacao" and action == "CREATE":
                        pivo_id = payload.get("pivo_id") or payload.get("pivo")
                        pivo = Pivo.objects.get(id=pivo_id)
                        reg = RegistroIrrigacao.objects.create(
                            client_op_id=client_op_id,
                            pivo=pivo,
                            inicio_em=payload.get("inicio_em", timezone.now()),
                            fim_em=payload.get("fim_em"),
                            percentimetro=payload.get("percentimetro", 100),
                            lamina_aplicada_mm=payload.get("lamina_aplicada_mm", 0.0),
                            sentido=payload.get("sentido", "HORARIO"),
                            origem="MOBILE_OFFLINE",
                            observacoes=payload.get("observacoes", "")
                        )
                        server_id = str(reg.id)

                    elif entity == "pivo" and action == "UPDATE":
                        pivo_id = payload.get("id") or payload.get("pivo_id")
                        pivo = Pivo.objects.get(id=pivo_id)
                        if "status_operacional" in payload:
                            pivo.status_operacional = payload["status_operacional"]
                        if "percentimetro_atual" in payload:
                            pivo.percentimetro_atual = int(payload["percentimetro_atual"])
                        if "sentido_rotacao" in payload:
                            pivo.sentido_rotacao = payload["sentido_rotacao"]
                        pivo.save()
                        server_id = str(pivo.id)

                    elif entity == "plano" and action in ["UPDATE", "UPDATE_STATUS"]:
                        plano_id = payload.get("id") or payload.get("plano_id")
                        if not plano_id:
                            raise ValidationError("Identificador do plano ('id' ou 'plano_id') não informado no payload.")

                        try:
                            plano = PlanoOperacional.objects.select_related("fazenda").get(id=plano_id)
                        except PlanoOperacional.DoesNotExist:
                            raise ValidationError(f"Plano operacional com id '{plano_id}' não encontrado no servidor.")

                        # Verificação de escopo de fazenda para usuário autenticado
                        user = request.user
                        if user.is_authenticated and not (user.is_superuser or user.is_staff):
                            profile = getattr(user, "profile", None)
                            if profile and profile.role != "ADMIN" and profile.fazendas.exists():
                                if plano.fazenda and not profile.fazendas.filter(id=plano.fazenda_id).exists():
                                    raise PermissionDenied(f"Usuário não possui acesso à fazenda '{plano.fazenda.nome}'.")

                        novo_status = payload.get("status")
                        expected_status = payload.get("expected_status") or payload.get("base_status")

                        # Extração do timestamp base (versão conhecida pelo cliente)
                        base_ts_raw = payload.get("base_updated_at") or payload.get("base_atualizado_em") or payload.get("atualizado_em")
                        base_dt = None
                        if base_ts_raw:
                            if isinstance(base_ts_raw, str):
                                base_dt = parse_datetime(base_ts_raw)
                            elif hasattr(base_ts_raw, "tzinfo"):
                                base_dt = base_ts_raw
                            if base_dt and timezone.is_naive(base_dt):
                                base_dt = timezone.make_aware(base_dt)

                        # DETECÇÃO DE CONFLITOS:
                        # 1. Se o plano foi cancelado no servidor enquanto o dispositivo estava offline
                        if plano.status == "CANCELADO" and novo_status != "CANCELADO":
                            raise SyncConflictError(
                                f"Conflito: o plano '{plano.id}' foi cancelado no servidor e não aceita mais transições offline.",
                                server_entity_id=str(plano.id)
                            )

                        # 2. Se o status esperado pelo cliente não coincide com o status atual do servidor
                        if expected_status and plano.status != expected_status:
                            raise SyncConflictError(
                                f"Conflito de concorrência: o status atual no servidor é '{plano.status}', "
                                f"mas a operação offline esperava '{expected_status}'.",
                                server_entity_id=str(plano.id)
                            )

                        # 3. Se o plano foi alterado concorrentemente no servidor após a versão base sincronizada
                        if base_dt and plano.atualizado_em:
                            # Tolerância de 1 segundo para variações de precisão de milissegundos
                            if (plano.atualizado_em - base_dt).total_seconds() > 1.0:
                                raise SyncConflictError(
                                    f"Conflito de concorrência: o plano foi alterado no servidor em {plano.atualizado_em.isoformat()} "
                                    f"após a versão base conhecida pelo dispositivo ({base_dt.isoformat()}).",
                                    server_entity_id=str(plano.id)
                                )

                        # 4. Se o plano já estiver concluído no servidor e a operação tentar alterar status ou reabrir
                        if plano.status == "CONCLUIDO" and novo_status and novo_status != "CONCLUIDO":
                            raise SyncConflictError(
                                f"Conflito: o plano já está 'CONCLUIDO' no servidor e não aceita modificações concorrentes.",
                                server_entity_id=str(plano.id)
                            )

                        # Atualização de observações operacionais, se fornecidas
                        if "observacoes" in payload and payload["observacoes"]:
                            obs_nova = str(payload["observacoes"]).strip()
                            if obs_nova:
                                if plano.observacoes:
                                    plano.observacoes = f"{plano.observacoes}\n[Offline] {obs_nova}"
                                else:
                                    plano.observacoes = obs_nova
                                plano.save(update_fields=["observacoes", "atualizado_em"])

                        # Transição de status
                        if novo_status and novo_status != plano.status:
                            executar_transicao_status(
                                plano=plano,
                                novo_status=novo_status,
                                user=user,
                                motivo=payload.get("motivo", payload.get("observacoes", "Sincronização offline")),
                                origem="MOBILE_OFFLINE",
                                audit_extra={"client_op_id": str(client_op_id), "device_id": device_id}
                            )
                        elif not novo_status and action == "UPDATE":
                            AuditLog.objects.create(
                                tabela="PlanoOperacional",
                                entidade_id=str(plano.id),
                                acao="SYNC_UPDATE",
                                detalhes={
                                    "origem": "MOBILE_OFFLINE",
                                    "status": plano.status,
                                    "client_op_id": str(client_op_id),
                                },
                                usuario=user if user.is_authenticated else None,
                            )

                        server_id = str(plano.id)

                    elif entity == "alerta" and action == "ACKNOWLEDGE":
                        alerta_id = payload.get("id") or payload.get("alerta_id")
                        alerta = Alerta.objects.get(id=alerta_id)
                        alerta.reconhecido_em = timezone.now()
                        alerta.save()
                        server_id = str(alerta.id)

                    else:
                        raise ValueError(f"Entidade ou ação desconhecida: {entity}/{action}")

                # Registrar sucesso na tabela de idempotência
                ProcessedOperation.objects.create(
                    client_op_id=client_op_id,
                    client_device_id=device_id,
                    entity=entity,
                    action=action,
                    server_entity_id=server_id or "",
                    status="SUCCESS",
                    response_payload={"message": "Operação processada com sucesso no servidor."},
                )

                results.append({
                    "client_op_id": str(client_op_id),
                    "status": "SUCCESS",
                    "server_id": server_id,
                    "idempotent": False,
                    "message": "Operação processada com sucesso no servidor."
                })

            except SyncConflictError as exc:
                msg = str(exc)
                server_id_conflict = str(exc.server_entity_id or "")
                ProcessedOperation.objects.create(
                    client_op_id=client_op_id,
                    client_device_id=device_id,
                    entity=entity,
                    action=action,
                    server_entity_id=server_id_conflict,
                    status="CONFLICT",
                    response_payload={"message": msg},
                )
                results.append({
                    "client_op_id": str(client_op_id),
                    "status": "CONFLICT",
                    "server_id": server_id_conflict or None,
                    "idempotent": False,
                    "message": msg
                })

            except (ValidationError, PermissionDenied) as exc:
                msg = exc.detail if hasattr(exc, "detail") else str(exc)
                if isinstance(msg, dict):
                    msg_str = "; ".join(f"{k}: {v}" for k, v in msg.items())
                elif isinstance(msg, list):
                    msg_str = "; ".join(str(m) for m in msg)
                else:
                    msg_str = str(msg)

                server_target = payload.get("id") or payload.get("plano_id") or ""
                ProcessedOperation.objects.create(
                    client_op_id=client_op_id,
                    client_device_id=device_id,
                    entity=entity,
                    action=action,
                    server_entity_id=str(server_target),
                    status="REJECTED",
                    response_payload={"message": msg_str},
                )
                results.append({
                    "client_op_id": str(client_op_id),
                    "status": "REJECTED",
                    "server_id": None,
                    "idempotent": False,
                    "message": msg_str
                })

            except Exception as exc:
                results.append({
                    "client_op_id": str(client_op_id),
                    "status": "ERROR",
                    "server_id": None,
                    "idempotent": False,
                    "message": str(exc)
                })

        return Response({
            "status": "COMPLETED",
            "processed_at": timezone.now().isoformat(),
            "results": results
        })

class SyncPullView(APIView):
    """Retorna o catálogo completo de dados vigentes para cache no SQLite local do mobile."""
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: serializers.DictField()})
    def get(self, request):
        empresas = Empresa.objects.filter(ativo=True)
        fazendas = Fazenda.objects.filter(ativo=True)
        talhoes = Talhao.objects.filter(ativo=True)
        pivos = Pivo.objects.filter(ativo=True)
        culturas = Cultura.objects.all()
        safras = Safra.objects.filter(ativa=True)
        planos = PlanoOperacional.objects.select_related("safra", "cultura", "fazenda", "talhao", "pivo").all()
        irrigacoes = RegistroIrrigacao.objects.all()[:50]
        alertas = Alerta.objects.filter(resolvido_em__isnull=True)[:50]
        janelas = JanelaOportunidade.objects.select_related("pivo", "fazenda", "talhao", "cultura", "safra", "empresa").filter(status__in=["DETECTADA", "RECONHECIDA"])[:50]

        return Response({
            "synced_at": timezone.now().isoformat(),
            "empresas": EmpresaSerializer(empresas, many=True).data,
            "fazendas": FazendaSerializer(fazendas, many=True).data,
            "talhoes": TalhaoSerializer(talhoes, many=True).data,
            "pivos": PivoSerializer(pivos, many=True).data,
            "culturas": CulturaSerializer(culturas, many=True).data,
            "safras": SafraSerializer(safras, many=True).data,
            "planos": PlanoOperacionalSerializer(planos, many=True).data,
            "irrigacoes": RegistroIrrigacaoSerializer(irrigacoes, many=True).data,
            "alertas": AlertaSerializer(alertas, many=True).data,
            "janelas": JanelaOportunidadeSerializer(janelas, many=True).data,
        })
