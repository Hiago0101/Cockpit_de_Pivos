from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from apps.core.models import GrupoPermissao, PermissaoModulo, ModuloSistema, UserProfile

class Command(BaseCommand):
    help = "Cria ou sincroniza os grupos de permissões padrão e suas matrizes granulares de acesso."

    def handle(self, *args, **options):
        self.stdout.write("Criando grupos de permissões e matrizes de acesso RBAC...")

        modulos = [choice[0] for choice in ModuloSistema.choices]

        # 1. Grupo Administrador Geral (Acesso irrestrito a tudo)
        admin_group, _ = GrupoPermissao.objects.get_or_create(
            nome="Administrador Geral",
            defaults={
                "descricao": "Acesso irrestrito a todos os cadastros, operações e configurações do sistema.",
                "is_admin_padrao": True,
                "ativo": True,
            }
        )
        for m in modulos:
            PermissaoModulo.objects.update_or_create(
                grupo=admin_group,
                modulo=m,
                defaults={
                    "pode_acessar_tela": True,
                    "pode_visualizar_completo": True,
                    "pode_incluir": True,
                    "pode_alterar": True,
                    "pode_excluir": True,
                }
            )

        # 2. Grupo Gestor Agrícola
        gestor_group, _ = GrupoPermissao.objects.get_or_create(
            nome="Gestor Agrícola",
            defaults={
                "descricao": "Gestão agronômica, planejamento de safras, infraestrutura e supervisão de irrigação.",
                "is_admin_padrao": False,
                "ativo": True,
            }
        )
        for m in modulos:
            # Gestor não tem acesso ao cadastro de usuários/grupos nem ao status técnico do sistema
            if m in [ModuloSistema.USUARIOS_GRUPOS, ModuloSistema.SISTEMA]:
                PermissaoModulo.objects.update_or_create(
                    grupo=gestor_group,
                    modulo=m,
                    defaults={
                        "pode_acessar_tela": False,
                        "pode_visualizar_completo": False,
                        "pode_incluir": False,
                        "pode_alterar": False,
                        "pode_excluir": False,
                    }
                )
            else:
                PermissaoModulo.objects.update_or_create(
                    grupo=gestor_group,
                    modulo=m,
                    defaults={
                        "pode_acessar_tela": True,
                        "pode_visualizar_completo": True,
                        "pode_incluir": True,
                        "pode_alterar": True,
                        "pode_excluir": False, # Exclusão restrita
                    }
                )

        # 3. Grupo Operador de Pivô (Campo)
        operador_group, _ = GrupoPermissao.objects.get_or_create(
            nome="Operador de Pivô",
            defaults={
                "descricao": "Execução operacional direta, apontamentos de campo, comandos de pivô e alertas.",
                "is_admin_padrao": False,
                "ativo": True,
            }
        )
        telas_operador = [
            ModuloSistema.COCKPIT,
            ModuloSistema.IRRIGACAO,
            ModuloSistema.MAPA,
            ModuloSistema.OPERACOES,
            ModuloSistema.ALERTAS,
            ModuloSistema.JANELAS,
            ModuloSistema.CALENDARIO,
        ]
        for m in modulos:
            if m in telas_operador:
                PermissaoModulo.objects.update_or_create(
                    grupo=operador_group,
                    modulo=m,
                    defaults={
                        "pode_acessar_tela": True,
                        "pode_visualizar_completo": True,
                        "pode_incluir": m in [ModuloSistema.OPERACOES, ModuloSistema.IRRIGACAO, ModuloSistema.ALERTAS],
                        "pode_alterar": m in [ModuloSistema.OPERACOES, ModuloSistema.IRRIGACAO],
                        "pode_excluir": False,
                    }
                )
            else:
                PermissaoModulo.objects.update_or_create(
                    grupo=operador_group,
                    modulo=m,
                    defaults={
                        "pode_acessar_tela": False,
                        "pode_visualizar_completo": False,
                        "pode_incluir": False,
                        "pode_alterar": False,
                        "pode_excluir": False,
                    }
                )

        # 4. Grupo Auditor / Consultor
        auditor_group, _ = GrupoPermissao.objects.get_or_create(
            nome="Auditor / Consulta",
            defaults={
                "descricao": "Auditoria de processos, visualização de lâminas, eficiência e relatórios sem permissão de escrita.",
                "is_admin_padrao": False,
                "ativo": True,
            }
        )
        for m in modulos:
            pode_ver = m not in [ModuloSistema.USUARIOS_GRUPOS, ModuloSistema.SISTEMA]
            PermissaoModulo.objects.update_or_create(
                grupo=auditor_group,
                modulo=m,
                defaults={
                    "pode_acessar_tela": pode_ver,
                    "pode_visualizar_completo": pode_ver,
                    "pode_incluir": False,
                    "pode_alterar": False,
                    "pode_excluir": False,
                }
            )

        # 5. Garante a criação do superusuário padrão de sistemas Farroupilha
        superuser_email = "sistemas@grupofarroupilha.com"
        sys_user, sys_created = User.objects.get_or_create(
            email=superuser_email,
            defaults={
                "username": "sistemas",
                "first_name": "Sistemas",
                "last_name": "Farroupilha",
                "is_staff": True,
                "is_superuser": True,
                "is_active": True,
            }
        )
        sys_user.is_staff = True
        sys_user.is_superuser = True
        sys_user.is_active = True
        sys_user.set_unusable_password()
        sys_user.save()

        sys_profile, _ = UserProfile.objects.get_or_create(user=sys_user)
        sys_profile.grupo = admin_group
        sys_profile.role = "ADMIN"
        sys_profile.cargo = "Administrador de Sistemas"
        sys_profile.departamento = "Tecnologia da Informação"
        sys_profile.empresa_nome = "Grupo Farroupilha"
        sys_profile.ativo = True
        sys_profile.save()
        if sys_created:
            self.stdout.write(f"Superusuário '{superuser_email}' criado com sucesso.")

        # 6. Atribui grupo de Administrador a todos os superusuários ou usuários sem grupo
        for user in User.objects.all():
            profile, _ = UserProfile.objects.get_or_create(user=user)
            if not profile.grupo or user.is_superuser:
                profile.grupo = admin_group
                profile.role = "ADMIN"
                profile.save()
                self.stdout.write(f"Usuário @{user.username} vinculado ao grupo '{admin_group.nome}'.")

        self.stdout.write(self.style.SUCCESS("Grupos e permissões RBAC configurados com sucesso!"))
