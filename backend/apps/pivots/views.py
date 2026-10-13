from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.core.models import AuditLog
from apps.core.permissions import IsAdminOrManager, IsFieldOperatorOrAbove
from .models import Empresa, Fazenda, Talhao, Pivo
from .serializers import EmpresaSerializer, FazendaSerializer, TalhaoSerializer, PivoSerializer

class EmpresaViewSet(viewsets.ModelViewSet):
    """Gestão de Empresas e Organizações Agrícolas."""
    queryset = Empresa.objects.all()
    serializer_class = EmpresaSerializer

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [IsAuthenticated()]
        return [IsAdminOrManager()]

class FazendaViewSet(viewsets.ModelViewSet):
    """Gestão de Fazendas e Unidades Agrícolas."""
    queryset = Fazenda.objects.all()
    serializer_class = FazendaSerializer

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
                qs = qs.filter(id__in=profile.fazendas.values_list("id", flat=True))
        return qs

class TalhaoViewSet(viewsets.ModelViewSet):
    """Gestão de Talhões vinculados às Fazendas."""
    queryset = Talhao.objects.select_related("fazenda").all()
    serializer_class = TalhaoSerializer
    filterset_fields = ["fazenda"]

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [IsAuthenticated()]
        return [IsAdminOrManager()]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        fazenda_id = self.request.query_params.get("fazenda")
        if fazenda_id:
            qs = qs.filter(fazenda_id=fazenda_id)
        if user.is_authenticated and not (user.is_superuser or user.is_staff):
            profile = getattr(user, "profile", None)
            if profile and profile.role != "ADMIN" and profile.fazendas.exists():
                qs = qs.filter(fazenda__in=profile.fazendas.all())
        return qs

class PivoViewSet(viewsets.ModelViewSet):
    """Cadastro, consulta e operação de Pivôs Centrais."""
    queryset = Pivo.objects.select_related("fazenda").filter(ativo=True)
    serializer_class = PivoSerializer

    def get_permissions(self):
        """
        Permissões granulares:
        - Leitura (list/retrieve): Exige autenticação (IsAuthenticated).
        - Comando rápido: Exige papel de Operador ou superior (IsFieldOperatorOrAbove).
        - Mutações estruturais (create/update/destroy): Exige Administrador ou Gestor (IsAdminOrManager).
        """
        if self.action in ["list", "retrieve"]:
            return [IsAuthenticated()]
        if self.action == "comando_rapido":
            return [IsFieldOperatorOrAbove()]
        return [IsAdminOrManager()]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_authenticated and not (user.is_superuser or user.is_staff):
            profile = getattr(user, "profile", None)
            if profile and profile.role != "ADMIN" and profile.fazendas.exists():
                qs = qs.filter(fazenda__in=profile.fazendas.all())
        fazenda_id = self.request.query_params.get("fazenda")
        status_op = self.request.query_params.get("status")
        if fazenda_id:
            qs = qs.filter(fazenda_id=fazenda_id)
        if status_op:
            qs = qs.filter(status_operacional=status_op)
        return qs

    def perform_create(self, serializer):
        instance = serializer.save()
        AuditLog.objects.create(
            tabela="pivos_pivo",
            entidade_id=str(instance.id),
            acao="CREATE",
            detalhes={"codigo": instance.codigo, "nome": instance.nome, "fazenda": str(instance.fazenda_id)},
            usuario=self.request.user if self.request.user.is_authenticated else None,
        )

    def perform_update(self, serializer):
        instance = serializer.save()
        AuditLog.objects.create(
            tabela="pivos_pivo",
            entidade_id=str(instance.id),
            acao="UPDATE",
            detalhes={"codigo": instance.codigo, "status": instance.status_operacional, "percentimetro": instance.percentimetro_atual},
            usuario=self.request.user if self.request.user.is_authenticated else None,
        )

    @action(detail=True, methods=["post"], url_path="comando-rapido")
    def comando_rapido(self, request, pk=None):
        """
        Atualização de estado operacional do pivô no banco de dados.
        NOTA TÉCNICA E OPERACIONAL:
        Esta funcionalidade atua estritamente como apontamento/simulação no banco de dados.
        Não existe integração direta com CLPs ou painéis físicos de pivôs (Zimmatic FieldNET, Valley AgSense).
        O estado retornado é o 'estado_registrado', e não 'estado_confirmado_hardware'.
        """
        pivo = self.get_object()
        novo_status = request.data.get("status_operacional")
        percentimetro = request.data.get("percentimetro_atual")
        sentido = request.data.get("sentido_rotacao")
        lamina = request.data.get("lamina_atual_mm")

        estado_anterior = pivo.status_operacional

        if novo_status:
            pivo.status_operacional = novo_status
        if percentimetro is not None:
            pivo.percentimetro_atual = int(percentimetro)
        if sentido:
            pivo.sentido_rotacao = sentido
        if lamina is not None:
            pivo.lamina_atual_mm = float(lamina)

        pivo.save()
        
        AuditLog.objects.create(
            tabela="pivos_pivo",
            entidade_id=str(pivo.id),
            acao="COMANDO_RAPIDO_SIMULADO",
            detalhes={
                "modo": "SIMULACAO_INTERNA",
                "estado_anterior": estado_anterior,
                "estado_solicitado": novo_status,
                "percentimetro": percentimetro,
                "sentido": sentido,
            },
            usuario=request.user if request.user.is_authenticated else None,
        )

        response_data = PivoSerializer(pivo).data
        response_data["_telemetria_info"] = {
            "integracao_fisica": False,
            "aviso": "Comando registrado no sistema. Não enviado a controlador físico em campo.",
            "estado_solicitado": novo_status,
            "estado_registrado": pivo.status_operacional,
            "confirmacao_hardware": None
        }

        return Response(response_data)
