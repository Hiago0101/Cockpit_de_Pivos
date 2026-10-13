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

    def perform_create(self, serializer):
        instance = serializer.save()
        user = self.request.user if self.request.user.is_authenticated else None
        AuditLog.objects.create(
            tabela="Fazenda",
            entidade_id=str(instance.id),
            acao="CREATE",
            detalhes={
                "nome": instance.nome,
                "filial": instance.filial,
                "id_pims": instance.id_pims,
                "codigo": instance.codigo,
            },
            usuario=user,
        )

    def perform_update(self, serializer):
        instance = serializer.save()
        user = self.request.user if self.request.user.is_authenticated else None
        AuditLog.objects.create(
            tabela="Fazenda",
            entidade_id=str(instance.id),
            acao="UPDATE",
            detalhes={
                "nome": instance.nome,
                "filial": instance.filial,
                "id_pims": instance.id_pims,
                "codigo": instance.codigo,
            },
            usuario=user,
        )

    def destroy(self, request, *args, **kwargs):
        from django.db.models import ProtectedError
        instance = self.get_object()
        user = request.user if request.user.is_authenticated else None

        # Validação 1: Bloquear exclusão se existirem talhões vinculados
        talhoes_count = instance.talhoes.count()
        if talhoes_count > 0:
            talhoes_codigos = list(instance.talhoes.values_list("codigo", flat=True)[:3])
            exemplo = f" ({', '.join(talhoes_codigos)}{'...' if talhoes_count > 3 else ''})"
            return Response(
                {
                    "detail": f"Não é possível excluir a fazenda '{instance.nome}' pois existem {talhoes_count} talhão(ões) vinculado(s) a ela{exemplo}. Exclua ou desvincule os talhões antes de excluir a fazenda."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validação 2: Bloquear exclusão se existirem pivôs vinculados
        pivos_count = instance.pivos.count()
        if pivos_count > 0:
            pivos_codigos = list(instance.pivos.values_list("codigo", flat=True)[:3])
            exemplo = f" ({', '.join(pivos_codigos)}{'...' if pivos_count > 3 else ''})"
            return Response(
                {
                    "detail": f"Não é possível excluir a fazenda '{instance.nome}' pois existem {pivos_count} pivô(s) vinculado(s) a ela{exemplo}. Desvincule ou remova os pivôs antes de excluir a fazenda."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            nome_fazenda = instance.nome
            filial_fazenda = instance.filial
            id_pims_fazenda = instance.id_pims
            codigo_fazenda = instance.codigo
            entidade_id = str(instance.id)

            instance.delete()

            AuditLog.objects.create(
                tabela="Fazenda",
                entidade_id=entidade_id,
                acao="DELETE",
                detalhes={
                    "nome": nome_fazenda,
                    "filial": filial_fazenda,
                    "id_pims": id_pims_fazenda,
                    "codigo": codigo_fazenda,
                },
                usuario=user,
            )
            return Response(status=status.HTTP_204_NO_CONTENT)
        except ProtectedError as pe:
            pivos_nomes = [getattr(obj, "nome", str(obj)) for obj in pe.protected_objects if hasattr(obj, "codigo") or hasattr(obj, "nome")]
            lista_objs = f" ({', '.join(pivos_nomes[:3])})" if pivos_nomes else ""
            return Response(
                {
                    "detail": f"Não é possível excluir a fazenda '{instance.nome}' porque existem registros vinculados a ela{lista_objs}. Desvincule os registros associados antes de excluir."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            return Response(
                {
                    "detail": f"Não é possível excluir a fazenda '{instance.nome}' pois existem registros vinculados a ela. Remova os pivôs e talhões associados primeiro."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

class TalhaoViewSet(viewsets.ModelViewSet):
    """Gestão de Talhões vinculados às Fazendas."""
    queryset = Talhao.objects.select_related("fazenda").all()
    serializer_class = TalhaoSerializer
    filterset_fields = ["fazenda"]
    search_fields = ["codigo", "nome", "descricao", "fazenda__nome", "fazenda__filial"]

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

    def perform_create(self, serializer):
        instance = serializer.save()
        user = self.request.user if self.request.user.is_authenticated else None
        AuditLog.objects.create(
            tabela="Talhao",
            entidade_id=str(instance.id),
            acao="CREATE",
            detalhes={
                "fazenda_id": str(instance.fazenda_id),
                "fazenda_nome": instance.fazenda.nome,
                "codigo": instance.codigo,
                "descricao": instance.descricao or instance.nome,
            },
            usuario=user,
        )

    def perform_update(self, serializer):
        instance = serializer.save()
        user = self.request.user if self.request.user.is_authenticated else None
        AuditLog.objects.create(
            tabela="Talhao",
            entidade_id=str(instance.id),
            acao="UPDATE",
            detalhes={
                "fazenda_id": str(instance.fazenda_id),
                "fazenda_nome": instance.fazenda.nome,
                "codigo": instance.codigo,
                "descricao": instance.descricao or instance.nome,
            },
            usuario=user,
        )

    def destroy(self, request, *args, **kwargs):
        from django.db.models import ProtectedError
        instance = self.get_object()
        user = request.user if request.user.is_authenticated else None
        try:
            entidade_id = str(instance.id)
            codigo = instance.codigo
            descricao = instance.descricao or instance.nome
            fazenda_nome = instance.fazenda.nome
            instance.delete()

            AuditLog.objects.create(
                tabela="Talhao",
                entidade_id=entidade_id,
                acao="DELETE",
                detalhes={
                    "fazenda_nome": fazenda_nome,
                    "codigo": codigo,
                    "descricao": descricao,
                },
                usuario=user,
            )
            return Response(status=status.HTTP_204_NO_CONTENT)
        except ProtectedError as pe:
            pivos_nomes = [getattr(obj, "nome", str(obj)) for obj in pe.protected_objects if hasattr(obj, "codigo") or hasattr(obj, "nome")]
            lista_objs = f" ({', '.join(pivos_nomes[:3])})" if pivos_nomes else ""
            return Response(
                {
                    "detail": f"Não é possível excluir o talhão '{instance.codigo}' porque existem registros vinculados a ele{lista_objs}. Desvincule ou remova os pivôs associados antes de excluir."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            return Response(
                {
                    "detail": f"Não é possível excluir o talhão '{instance.codigo}' pois existem registros vinculados a ele."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

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
