import { getStoredUser, type ModuloPermissao, type UserData } from "@/services/api";

/**
 * Hook para controle de acesso baseado em permissões granulares por tela e cadastro.
 */
export function usePermissions() {
  const user: UserData | null = getStoredUser();
  const isAdmin = Boolean(
    user?.profile?.role === "ADMIN" ||
    user?.is_superuser ||
    user?.is_staff ||
    user?.profile?.grupo?.is_admin_padrao
  );

  const getModulePermission = (modulo: string): ModuloPermissao => {
    if (isAdmin) {
      return {
        pode_acessar_tela: true,
        pode_visualizar_completo: true,
        pode_incluir: true,
        pode_alterar: true,
        pode_excluir: true,
      };
    }
    const perm = user?.permissoes?.[modulo];
    if (perm) return perm;
    return {
      pode_acessar_tela: false,
      pode_visualizar_completo: false,
      pode_incluir: false,
      pode_alterar: false,
      pode_excluir: false,
    };
  };

  const canAccess = (modulo: string) => getModulePermission(modulo).pode_acessar_tela;
  const canViewFull = (modulo: string) => getModulePermission(modulo).pode_visualizar_completo;
  const canCreate = (modulo: string) => getModulePermission(modulo).pode_incluir;
  const canEdit = (modulo: string) => getModulePermission(modulo).pode_alterar;
  const canDelete = (modulo: string) => getModulePermission(modulo).pode_excluir;

  return {
    user,
    isAdmin,
    getModulePermission,
    canAccess,
    canViewFull,
    canCreate,
    canEdit,
    canDelete,
  };
}
