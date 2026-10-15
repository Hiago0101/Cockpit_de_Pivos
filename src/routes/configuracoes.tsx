import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Users,
  Shield,
  ShieldCheck,
  UserPlus,
  KeyRound,
  CheckCircle2,
  XCircle,
  Search,
  Building,
  Briefcase,
  AlertTriangle,
  Loader2,
  RefreshCw,
  LogOut,
  Edit2,
  PowerOff,
  Power,
  Copy,
  Trash2,
  Cloud,
  Check,
  HelpCircle,
  Sparkles,
  ExternalLink,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  api,
  getStoredUser,
  getAuthToken,
  type UserData,
  type Farm,
  type CreateUserData,
  type UpdateUserData,
  type GrupoPermissao,
  type GrupoPermissaoItem,
  type AzureUserInfo,
} from "@/services/api";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({
    meta: [
      { title: "Usuários e Permissões — Cockpit de Pivôs" },
      { name: "description", content: "Gerenciamento de usuários Microsoft 365, grupos de permissões e matriz RBAC." },
      { property: "og:title", content: "Usuários e Permissões — Cockpit de Pivôs" },
      { property: "og:description", content: "Gerenciamento de usuários Microsoft 365, grupos de permissões e matriz RBAC." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConfiguracoesPage,
});

function ConfiguracoesPage() {
  const currentUser = getStoredUser();
  const isAdmin =
    currentUser?.profile?.role === "ADMIN" ||
    currentUser?.is_superuser ||
    currentUser?.is_staff ||
    currentUser?.profile?.grupo?.is_admin_padrao;

  // Estados principais
  const [users, setUsers] = useState<UserData[]>([]);
  const [grupos, setGrupos] = useState<GrupoPermissao[]>([]);
  const [modulosDisponiveis, setModulosDisponiveis] = useState<{ codigo: string; nome: string }[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [azureStatus, setAzureStatus] = useState<any>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filtros de Usuários
  const [searchTerm, setSearchTerm] = useState("");
  const [grupoFilter, setGrupoFilter] = useState<string>("TODOS");

  // --- Modal de Usuário (AD 365) ---
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [isSubmittingUser, setIsSubmittingUser] = useState(false);
  const [userModalError, setUserModalError] = useState<string | null>(null);

  // Formulário de Usuário (SEM SENHA)
  const [formEmail, setFormEmail] = useState("");
  const [formFirstName, setFormFirstName] = useState("");
  const [formLastName, setFormLastName] = useState("");
  const [formGrupoId, setFormGrupoId] = useState("");
  const [formCargo, setFormCargo] = useState("");
  const [formDepartamento, setFormDepartamento] = useState("Operações Agrícolas");
  const [formEmpresa, setFormEmpresa] = useState("Grupo Farroupilha");
  const [formTelefone, setFormTelefone] = useState("");
  const [formAtivo, setFormAtivo] = useState(true);
  const [formSelectedFarms, setFormSelectedFarms] = useState<string[]>([]);
  const [formAdOid, setFormAdOid] = useState("");

  // Estado de Busca no Azure AD
  const [isSearchingAzure, setIsSearchingAzure] = useState(false);
  const [azureSearchResult, setAzureSearchResult] = useState<AzureUserInfo | null>(null);

  // --- Modal de Grupo de Permissões ---
  const [isGrupoModalOpen, setIsGrupoModalOpen] = useState(false);
  const [editingGrupo, setEditingGrupo] = useState<GrupoPermissao | null>(null);
  const [isSubmittingGrupo, setIsSubmittingGrupo] = useState(false);
  const [grupoModalError, setGrupoModalError] = useState<string | null>(null);

  // Formulário de Grupo
  const [grupoNome, setGrupoNome] = useState("");
  const [grupoDescricao, setGrupoDescricao] = useState("");
  const [grupoIsAdmin, setGrupoIsAdmin] = useState(false);
  const [grupoAtivo, setGrupoAtivo] = useState(true);
  const [grupoPermissoes, setGrupoPermissoes] = useState<Record<string, GrupoPermissaoItem>>({});

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [farmsData, gruposData, modulosData, azureCfg] = await Promise.all([
        api.getFarms().catch(() => []),
        api.getGruposPermissao().catch(() => []),
        api.getModulosDisponiveis().catch(() => []),
        api.getAzureStatus().catch(() => null),
      ]);
      setFarms(farmsData);
      setGrupos(gruposData);
      setModulosDisponiveis(modulosData);
      setAzureStatus(azureCfg);

      if (isAdmin) {
        const usersData = await api.getUsers();
        setUsers(usersData);
      }
    } catch (err: any) {
      setError(err?.message || "Erro ao carregar dados de usuários e grupos.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [isAdmin]);

  // Limpa mensagens após 5 segundos
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // =========================================================================
  // GESTÃO DE USUÁRIOS
  // =========================================================================
  const handleOpenCreateUser = () => {
    setEditingUser(null);
    setFormEmail("");
    setFormFirstName("");
    setFormLastName("");
    setFormGrupoId(grupos[0]?.id || "");
    setFormCargo("");
    setFormDepartamento("Operações Agrícolas");
    setFormEmpresa("Grupo Farroupilha");
    setFormTelefone("");
    setFormAtivo(true);
    setFormSelectedFarms([]);
    setFormAdOid("");
    setAzureSearchResult(null);
    setUserModalError(null);
    setIsUserModalOpen(true);
  };

  const handleOpenEditUser = (user: UserData) => {
    setEditingUser(user);
    setFormEmail(user.email);
    setFormFirstName(user.first_name || "");
    setFormLastName(user.last_name || "");
    setFormGrupoId(user.profile?.grupo?.id || grupos[0]?.id || "");
    setFormCargo(user.profile?.cargo || "");
    setFormDepartamento(user.profile?.departamento || "Operações Agrícolas");
    setFormEmpresa(user.profile?.empresa_nome || "Grupo Farroupilha");
    setFormTelefone(user.profile?.telefone || "");
    setFormAtivo(user.is_active && (user.profile?.ativo ?? true));
    setFormSelectedFarms(user.profile?.fazendas || []);
    setFormAdOid(user.profile?.ad_oid || "");
    setAzureSearchResult(null);
    setUserModalError(null);
    setIsUserModalOpen(true);
  };

  const handleLookupAzureUser = async () => {
    const emailToSearch = formEmail.trim().toLowerCase();
    if (!emailToSearch || !emailToSearch.includes("@")) {
      setUserModalError("Informe um e-mail corporativo válido para buscar no Azure AD.");
      return;
    }

    setIsSearchingAzure(true);
    setUserModalError(null);
    try {
      const info = await api.lookupAzureUser(emailToSearch);
      setAzureSearchResult(info);

      if (info.found) {
        if (info.givenName) setFormFirstName(info.givenName);
        if (info.surname) setFormLastName(info.surname);
        else if (info.displayName && !formFirstName) {
          const parts = info.displayName.split(" ");
          setFormFirstName(parts[0] || "");
          setFormLastName(parts.slice(1).join(" ") || "");
        }
        if (info.jobTitle) setFormCargo(info.jobTitle);
        if (info.department) setFormDepartamento(info.department);
        if (info.mobilePhone) setFormTelefone(info.mobilePhone);
        if (info.id) setFormAdOid(info.id);

        if (info.accountEnabled === false) {
          setUserModalError("Atenção: Este usuário está bloqueado no Active Directory (Azure AD). Ele não conseguirá acessar até ser desbloqueado no AD.");
        }
      } else if (info.detail) {
        setUserModalError(info.detail);
      }
    } catch (err: any) {
      setUserModalError(err.message || "Erro ao consultar usuário no Azure AD.");
    } finally {
      setIsSearchingAzure(false);
    }
  };

  const handleToggleFarm = (farmId: string) => {
    setFormSelectedFarms((prev) =>
      prev.includes(farmId) ? prev.filter((id) => id !== farmId) : [...prev, farmId]
    );
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserModalError(null);

    const emailClean = formEmail.trim().toLowerCase();
    if (!emailClean) {
      setUserModalError("O e-mail corporativo é obrigatório.");
      return;
    }
    if (!formFirstName.trim()) {
      setUserModalError("O primeiro nome é obrigatório.");
      return;
    }
    if (!formGrupoId) {
      setUserModalError("Selecione um grupo de permissões.");
      return;
    }

    setIsSubmittingUser(true);
    try {
      if (editingUser) {
        const updateData: UpdateUserData = {
          email: emailClean,
          first_name: formFirstName.trim(),
          last_name: formLastName.trim(),
          grupo_id: formGrupoId,
          cargo: formCargo.trim(),
          departamento: formDepartamento.trim(),
          empresa_nome: formEmpresa.trim(),
          telefone: formTelefone.trim(),
          ativo: formAtivo,
          fazendas: formSelectedFarms,
        };
        await api.updateUser(editingUser.id, updateData);
        setSuccessMessage(`Usuário @${editingUser.username} atualizado com sucesso.`);
      } else {
        const createData: CreateUserData = {
          email: emailClean,
          first_name: formFirstName.trim(),
          last_name: formLastName.trim(),
          grupo_id: formGrupoId,
          cargo: formCargo.trim(),
          departamento: formDepartamento.trim(),
          empresa_nome: formEmpresa.trim(),
          telefone: formTelefone.trim(),
          ativo: formAtivo,
          fazendas: formSelectedFarms,
          ad_oid: formAdOid,
          ad_upn: emailClean,
        };
        await api.createUser(createData);
        setSuccessMessage(`Colaborador ${emailClean} pré-cadastrado com sucesso via Microsoft 365.`);
      }
      setIsUserModalOpen(false);
      await loadData();
    } catch (err: any) {
      setUserModalError(err?.message || "Erro ao salvar usuário.");
    } finally {
      setIsSubmittingUser(false);
    }
  };

  const handleToggleUserActive = async (user: UserData) => {
    try {
      await api.toggleUserActive(user.id);
      setSuccessMessage(
        `Conta de @${user.username} ${user.is_active ? "desativada" : "ativada"} com sucesso.`
      );
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Não foi possível alterar o status do usuário.");
    }
  };

  // =========================================================================
  // GESTÃO DE GRUPOS DE PERMISSÕES (RBAC GRANULAR)
  // =========================================================================
  const handleOpenCreateGrupo = () => {
    setEditingGrupo(null);
    setGrupoNome("");
    setGrupoDescricao("");
    setGrupoIsAdmin(false);
    setGrupoAtivo(true);

    // Inicializa permissões de todos os módulos
    const initialPerms: Record<string, GrupoPermissaoItem> = {};
    modulosDisponiveis.forEach((m) => {
      initialPerms[m.codigo] = {
        modulo: m.codigo,
        modulo_display: m.nome,
        pode_acessar_tela: true,
        pode_visualizar_completo: true,
        pode_incluir: false,
        pode_alterar: false,
        pode_excluir: false,
      };
    });
    setGrupoPermissoes(initialPerms);
    setGrupoModalError(null);
    setIsGrupoModalOpen(true);
  };

  const handleOpenEditGrupo = (grupo: GrupoPermissao) => {
    setEditingGrupo(grupo);
    setGrupoNome(grupo.nome);
    setGrupoDescricao(grupo.descricao || "");
    setGrupoIsAdmin(grupo.is_admin_padrao);
    setGrupoAtivo(grupo.ativo);

    const permsMap: Record<string, GrupoPermissaoItem> = {};
    modulosDisponiveis.forEach((m) => {
      const existing = grupo.permissoes?.find((p) => p.modulo === m.codigo);
      permsMap[m.codigo] = {
        modulo: m.codigo,
        modulo_display: m.nome,
        pode_acessar_tela: existing ? existing.pode_acessar_tela : grupo.is_admin_padrao,
        pode_visualizar_completo: existing ? existing.pode_visualizar_completo : grupo.is_admin_padrao,
        pode_incluir: existing ? existing.pode_incluir : grupo.is_admin_padrao,
        pode_alterar: existing ? existing.pode_alterar : grupo.is_admin_padrao,
        pode_excluir: existing ? existing.pode_excluir : grupo.is_admin_padrao,
      };
    });
    setGrupoPermissoes(permsMap);
    setGrupoModalError(null);
    setIsGrupoModalOpen(true);
  };

  const handleTogglePermissao = (
    moduloCodigo: string,
    field: keyof Omit<GrupoPermissaoItem, "id" | "modulo" | "modulo_display">
  ) => {
    setGrupoPermissoes((prev) => {
      const current = prev[moduloCodigo] || {
        modulo: moduloCodigo,
        pode_acessar_tela: true,
        pode_visualizar_completo: true,
        pode_incluir: false,
        pode_alterar: false,
        pode_excluir: false,
      };
      return {
        ...prev,
        [moduloCodigo]: {
          ...current,
          [field]: !current[field],
        },
      };
    });
  };

  const handleSetAllInColumn = (
    field: keyof Omit<GrupoPermissaoItem, "id" | "modulo" | "modulo_display">,
    value: boolean
  ) => {
    setGrupoPermissoes((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        next[key] = {
          ...next[key],
          [field]: value,
        };
      });
      return next;
    });
  };

  const handleSaveGrupo = async (e: React.FormEvent) => {
    e.preventDefault();
    setGrupoModalError(null);

    const nomeClean = grupoNome.trim();
    if (!nomeClean) {
      setGrupoModalError("O nome do grupo de permissões é obrigatório.");
      return;
    }

    setIsSubmittingGrupo(true);
    try {
      const payload: Partial<GrupoPermissao> = {
        nome: nomeClean,
        descricao: grupoDescricao.trim(),
        is_admin_padrao: grupoIsAdmin,
        ativo: grupoAtivo,
        permissoes: Object.values(grupoPermissoes),
      };

      if (editingGrupo) {
        await api.updateGrupoPermissao(editingGrupo.id, payload);
        setSuccessMessage(`Grupo '${nomeClean}' atualizado com sucesso.`);
      } else {
        await api.createGrupoPermissao(payload);
        setSuccessMessage(`Grupo de permissões '${nomeClean}' criado com sucesso.`);
      }
      setIsGrupoModalOpen(false);
      await loadData();
    } catch (err: any) {
      setGrupoModalError(err?.message || "Erro ao salvar grupo de permissões.");
    } finally {
      setIsSubmittingGrupo(false);
    }
  };

  const handleCloneGrupo = async (grupo: GrupoPermissao) => {
    try {
      await api.cloneGrupoPermissao(grupo.id);
      setSuccessMessage(`Cópia do grupo '${grupo.nome}' criada com sucesso.`);
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Erro ao clonar grupo.");
    }
  };

  const handleDeleteGrupo = async (grupo: GrupoPermissao) => {
    if (grupo.is_admin_padrao) {
      setError("Não é permitido excluir o grupo de Administrador Padrão.");
      return;
    }
    if ((grupo.usuarios_count || 0) > 0) {
      setError(`O grupo possui ${grupo.usuarios_count} usuário(s) vinculado(s). Reatribua-os antes de excluir.`);
      return;
    }
    if (!confirm(`Deseja realmente remover o grupo de permissões '${grupo.nome}'?`)) {
      return;
    }

    try {
      await api.deleteGrupoPermissao(grupo.id);
      setSuccessMessage(`Grupo '${grupo.nome}' excluído com sucesso.`);
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Erro ao excluir grupo.");
    }
  };

  // Filtragem de usuários
  const filteredUsers = users.filter((u) => {
    const matchSearch =
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${u.first_name} ${u.last_name}`.toLowerCase().includes(searchTerm.toLowerCase());

    const matchGrupo =
      grupoFilter === "TODOS" ||
      u.profile?.grupo?.id === grupoFilter ||
      (grupoFilter === "SEM_GRUPO" && !u.profile?.grupo);

    return matchSearch && matchGrupo;
  });

  return (
    <div className="flex-1 space-y-6 p-6 sm:p-8">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Usuários & Controle de Permissões
          </h1>
          <p className="text-sm text-muted-foreground">
            Acesso corporativo exclusivo Microsoft 365 e matriz granular de permissões RBAC.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={isLoading}
            className="cursor-pointer gap-1.5"
          >
            <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          {isAdmin && (
            <Button
              size="sm"
              onClick={handleOpenCreateUser}
              className="cursor-pointer gap-1.5 font-semibold shadow-sm"
            >
              <UserPlus className="size-4" />
              Novo Usuário (AD 365)
            </Button>
          )}
        </div>
      </div>

      {/* Alertas */}
      {successMessage && (
        <Alert className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="size-4" />
          <AlertDescription className="text-xs font-medium">
            {successMessage}
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive" className="border-destructive/30 bg-destructive/10 text-destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription className="text-xs font-medium">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <Tabs defaultValue="usuarios" className="space-y-6">
        <TabsList className="bg-muted/70 p-1">
          <TabsTrigger value="usuarios" className="gap-2 cursor-pointer text-xs sm:text-sm">
            <Users className="size-4" />
            Usuários (AD 365)
          </TabsTrigger>
          <TabsTrigger value="grupos" className="gap-2 cursor-pointer text-xs sm:text-sm">
            <Shield className="size-4" />
            Grupos de Permissões (RBAC)
          </TabsTrigger>
          <TabsTrigger value="azure" className="gap-2 cursor-pointer text-xs sm:text-sm">
            <Cloud className="size-4" />
            Integração Azure Entra ID
          </TabsTrigger>
          <TabsTrigger value="minha-conta" className="gap-2 cursor-pointer text-xs sm:text-sm">
            <KeyRound className="size-4" />
            Minha Conta & Sessão
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Gestão de Usuários (AD 365) */}
        <TabsContent value="usuarios" className="space-y-6">
          {!isAdmin ? (
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Shield className="size-6 text-amber-500" />
                  <div>
                    <CardTitle className="text-base text-foreground">
                      Acesso Restrito a Administradores
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">
                      Seu usuário atual pertence ao grupo{" "}
                      <strong className="text-foreground">
                        {currentUser?.profile?.grupo?.nome || currentUser?.profile?.role_display || "Operacional"}
                      </strong>.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground leading-relaxed">
                Apenas Administradores do Sistema têm privilégios para pré-cadastrar colaboradores do Microsoft 365,
                atribuir grupos de permissões ou alterar o status de acesso.
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Filtros e Busca */}
              <div className="grid gap-4 sm:grid-cols-12">
                <div className="relative sm:col-span-7">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Buscar por nome, e-mail corporativo ou cargo..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 h-10 text-sm bg-background"
                  />
                </div>
                <div className="sm:col-span-5 flex gap-2">
                  <select
                    value={grupoFilter}
                    onChange={(e) => setGrupoFilter(e.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-xs sm:text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    <option value="TODOS">Todos os Grupos de Permissão</option>
                    {grupos.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.nome} {g.is_admin_padrao ? "(Admin Padrão)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tabela de Usuários */}
              <Card className="border-border">
                <CardHeader className="pb-3 border-b border-border/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Colaboradores Pré-Cadastrados (Microsoft 365)</CardTitle>
                      <CardDescription className="text-xs">
                        {filteredUsers.length} colaborador(es) autorizado(s) no sistema.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                      <Loader2 className="size-5 animate-spin text-primary" />
                      <span className="text-sm">Carregando usuários...</span>
                    </div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground text-sm">
                      Nenhum usuário encontrado com os filtros selecionados.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-muted/40 text-[11px] font-semibold uppercase text-muted-foreground border-b border-border">
                          <tr>
                            <th className="py-3 px-4">Colaborador / E-mail</th>
                            <th className="py-3 px-4">Grupo de Permissões</th>
                            <th className="py-3 px-4">Cargo / Depto</th>
                            <th className="py-3 px-4">Fazendas</th>
                            <th className="py-3 px-4 text-center">Status</th>
                            <th className="py-3 px-4 text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {filteredUsers.map((u) => {
                            const grupoName = u.profile?.grupo?.nome || u.profile?.role_display || "Sem Grupo";
                            const isUserActive = u.is_active && (u.profile?.ativo ?? true);
                            const isSelf = u.id === currentUser?.id;

                            return (
                              <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                                <td className="py-3 px-4">
                                  <div className="font-semibold text-foreground">
                                    {u.first_name ? `${u.first_name} ${u.last_name || ""}` : u.username}
                                  </div>
                                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
                                    <span className="microsoft-mark grid size-2.5 grid-cols-2 gap-0.5 shrink-0" aria-hidden="true">
                                      <span className="bg-[#f25022]" />
                                      <span className="bg-[#7fba00]" />
                                      <span className="bg-[#00a4ef]" />
                                      <span className="bg-[#ffb900]" />
                                    </span>
                                    <span>{u.email || "—"}</span>
                                  </div>
                                </td>
                                <td className="py-3 px-4">
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] font-bold ${
                                      u.profile?.grupo?.is_admin_padrao || u.profile?.role === "ADMIN"
                                        ? "border-primary/40 bg-primary/10 text-primary"
                                        : "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                    }`}
                                  >
                                    <Shield className="mr-1 size-2.5 inline" />
                                    {grupoName}
                                  </Badge>
                                </td>
                                <td className="py-3 px-4">
                                  <div className="text-foreground">{u.profile?.cargo || "—"}</div>
                                  <div className="text-[10px] text-muted-foreground">{u.profile?.departamento || "—"}</div>
                                </td>
                                <td className="py-3 px-4 text-muted-foreground">
                                  {u.profile?.grupo?.is_admin_padrao || u.profile?.role === "ADMIN" ? (
                                    <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                                      Todas as Fazendas
                                    </span>
                                  ) : u.profile?.fazendas?.length ? (
                                    <span>{u.profile.fazendas.length} fazenda(s)</span>
                                  ) : (
                                    <span className="text-muted-foreground/60">Nenhuma atribuída</span>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <Badge
                                    variant="outline"
                                    className={
                                      isUserActive
                                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
                                        : "border-destructive/30 bg-destructive/10 text-destructive"
                                    }
                                  >
                                    {isUserActive ? "Ativo" : "Bloqueado"}
                                  </Badge>
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleOpenEditUser(u)}
                                      className="h-8 px-2 text-xs cursor-pointer gap-1"
                                      title="Editar Usuário"
                                    >
                                      <Edit2 className="size-3.5" />
                                      <span className="hidden sm:inline">Editar</span>
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      disabled={isSelf}
                                      onClick={() => handleToggleUserActive(u)}
                                      className={`h-8 px-2 text-xs cursor-pointer gap-1 ${
                                        isUserActive
                                          ? "text-destructive hover:bg-destructive/10"
                                          : "text-emerald-600 hover:bg-emerald-50"
                                      }`}
                                      title={isUserActive ? "Desativar Conta" : "Ativar Conta"}
                                    >
                                      {isUserActive ? <PowerOff className="size-3.5" /> : <Power className="size-3.5" />}
                                      <span className="hidden sm:inline">{isUserActive ? "Desativar" : "Ativar"}</span>
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* TAB 2: Grupos de Permissões (RBAC Granular) */}
        <TabsContent value="grupos" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">Grupos de Permissões Cadastrados</h2>
              <p className="text-xs text-muted-foreground">
                Configuração granular de permissões por tela e cadastro: visualizar por completo, incluir, alterar e excluir.
              </p>
            </div>
            {isAdmin && (
              <Button size="sm" onClick={handleOpenCreateGrupo} className="cursor-pointer gap-1.5 font-semibold">
                <Shield className="size-4" />
                Novo Grupo de Permissões
              </Button>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {grupos.map((g) => (
              <Card key={g.id} className="border-border hover:border-primary/40 transition-colors flex flex-col justify-between">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between mb-1">
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-bold ${
                        g.is_admin_padrao
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                      }`}
                    >
                      {g.is_admin_padrao ? "ADMINISTRADOR GERAL" : "GRUPO RBAC"}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">
                      {g.usuarios_count || 0} usuário(s)
                    </span>
                  </div>
                  <CardTitle className="text-base text-foreground">{g.nome}</CardTitle>
                  <CardDescription className="text-xs line-clamp-2">
                    {g.descricao || "Sem descrição informada."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0 border-t border-border/50 py-3 mt-auto">
                  <div className="flex items-center justify-between gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEditGrupo(g)}
                      className="flex-1 h-8 text-xs cursor-pointer gap-1"
                    >
                      <Edit2 className="size-3" />
                      Editar Matriz
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCloneGrupo(g)}
                      className="h-8 px-2 text-xs cursor-pointer"
                      title="Clonar Grupo"
                    >
                      <Copy className="size-3" />
                    </Button>
                    {!g.is_admin_padrao && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteGrupo(g)}
                        className="h-8 px-2 text-xs text-destructive hover:bg-destructive/10 cursor-pointer"
                        title="Excluir Grupo"
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* TAB 3: Integração Azure Entra ID */}
        <TabsContent value="azure" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Cloud className="size-6 text-primary" />
                  <div>
                    <CardTitle className="text-base">App Registration no Azure AD</CardTitle>
                    <CardDescription className="text-xs">
                      Status da conexão com o locatário corporativo Microsoft 365.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 text-xs">
                <div className="flex justify-between border-b border-border/50 pb-2">
                  <span className="text-muted-foreground">Status da Integração:</span>
                  <Badge
                    variant="outline"
                    className={
                      azureStatus?.is_configured
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
                        : "border-amber-500/30 bg-amber-500/10 text-amber-600"
                    }
                  >
                    {azureStatus?.is_configured ? "Conectado ao Azure AD" : "Pendente de Chaves no .env"}
                  </Badge>
                </div>
                <div className="flex justify-between border-b border-border/50 pb-2">
                  <span className="text-muted-foreground">Application (Client) ID:</span>
                  <span className="font-mono text-foreground font-semibold">
                    {azureStatus?.client_id || "Não configurado"}
                  </span>
                </div>
                <div className="flex justify-between border-b border-border/50 pb-2">
                  <span className="text-muted-foreground">Directory (Tenant) ID:</span>
                  <span className="font-mono text-foreground">
                    {azureStatus?.tenant_id || "common"}
                  </span>
                </div>
                <div className="flex justify-between border-b border-border/50 pb-2">
                  <span className="text-muted-foreground">Client Secret:</span>
                  <span className="font-semibold text-foreground">
                    {azureStatus?.has_client_secret ? "✓ Registrado no backend" : "Ausente no .env"}
                  </span>
                </div>
                <div className="flex justify-between border-b border-border/50 pb-2">
                  <span className="text-muted-foreground">Redirect URI:</span>
                  <span className="font-mono text-[11px] text-foreground">
                    {azureStatus?.redirect_uri ||
                      (typeof window !== "undefined" ? window.location.origin + "/login" : "http://localhost:8080/login")}
                  </span>
                </div>

                <div className="rounded-lg bg-muted/40 p-3 text-muted-foreground leading-relaxed">
                  As chaves corporativas do Azure registradas permitem a busca automática de nomes e cargos
                  de novos colaboradores via Microsoft Graph API e validação estrita de contas ativas no Active Directory.
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <ShieldCheck className="size-6 text-primary" />
                  <div>
                    <CardTitle className="text-base">Políticas de Segurança e AD</CardTitle>
                    <CardDescription className="text-xs">
                      Regras de negócio de acesso 365 aplicadas no Cockpit.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-xs text-muted-foreground leading-relaxed">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="size-4 text-primary shrink-0 mt-0.5" />
                  <span>
                    <strong>Sem Autocadastro:</strong> Mesmo colaboradores com e-mails `@grupofarroupilha.com` só conseguem efetuar login após serem expressamente pré-cadastrados por um Administrador.
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="size-4 text-primary shrink-0 mt-0.5" />
                  <span>
                    <strong>Bloqueio Automático via AD:</strong> Se a conta do colaborador for bloqueada ou desativada no Azure Active Directory (`accountEnabled: false`), o login é imediatamente negado pelo sistema.
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="size-4 text-primary shrink-0 mt-0.5" />
                  <span>
                    <strong>Sem Senhas Locais:</strong> Nenhum hash de senha é mantido ou aceito. Toda a segurança criptográfica de login é delegada aos servidores da Microsoft.
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 4: Minha Conta & Sessão */}
        <TabsContent value="minha-conta" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Informações do Usuário Autenticado</CardTitle>
                <CardDescription className="text-xs">
                  Dados do colaborador conectado atualmente no Cockpit.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-xs sm:text-sm">
                <div className="flex justify-between border-b border-border/50 pb-2">
                  <span className="text-muted-foreground">Nome Completo:</span>
                  <span className="font-semibold text-foreground">
                    {currentUser?.first_name ? `${currentUser.first_name} ${currentUser.last_name || ""}` : currentUser?.username}
                  </span>
                </div>
                <div className="flex justify-between border-b border-border/50 pb-2">
                  <span className="text-muted-foreground">E-mail Microsoft 365:</span>
                  <span className="font-mono text-foreground font-medium">{currentUser?.email || "—"}</span>
                </div>
                <div className="flex justify-between border-b border-border/50 pb-2">
                  <span className="text-muted-foreground">Grupo de Permissões:</span>
                  <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary font-bold">
                    {currentUser?.profile?.grupo?.nome || currentUser?.profile?.role_display || "Usuário"}
                  </Badge>
                </div>
                <div className="flex justify-between border-b border-border/50 pb-2">
                  <span className="text-muted-foreground">Cargo:</span>
                  <span className="font-medium text-foreground">{currentUser?.profile?.cargo || "—"}</span>
                </div>
                <div className="flex justify-between border-b border-border/50 pb-2">
                  <span className="text-muted-foreground">Empresa:</span>
                  <span className="font-medium text-foreground">{currentUser?.profile?.empresa_nome || "Grupo Farroupilha"}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Token de Sessão & Revogação</CardTitle>
                <CardDescription className="text-xs">
                  Encerramento da sessão corporativa e revogação do token no backend.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-xs sm:text-sm">
                <div className="rounded-md border border-border bg-muted/40 p-3 font-mono text-xs break-all">
                  <span className="text-muted-foreground block mb-1">Authorization Token:</span>
                  <span className="text-foreground">
                    {getAuthToken() ? `${getAuthToken()?.substring(0, 10)}••••••••••••••••••••••••` : "Não autenticado"}
                  </span>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={async () => {
                    await api.logout();
                    window.location.href = "/login";
                  }}
                  className="w-full gap-2 cursor-pointer"
                >
                  <LogOut className="size-4" />
                  Encerrar Sessão e Revogar Token
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* =====================================================================
          MODAL DE CADASTRO / EDIÇÃO DE USUÁRIO (MICROSOFT 365 — SEM SENHA)
         ===================================================================== */}
      <Dialog open={isUserModalOpen} onOpenChange={setIsUserModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? `Editar Colaborador: @${editingUser.username}` : "Novo Colaborador (Microsoft 365)"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Pré-cadastro corporativo integrado ao Active Directory. O usuário utilizará a conta Microsoft 365 para login.
            </DialogDescription>
          </DialogHeader>

          {userModalError && (
            <Alert variant="destructive" className="py-2 text-xs">
              <AlertTriangle className="size-3.5 inline mr-1" />
              {userModalError}
            </Alert>
          )}

          {/* Banner de Usuário Localizado no Azure */}
          {azureSearchResult?.found && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold">
                <Check className="size-4 text-emerald-600" />
                <span>Colaborador verificado no Microsoft Active Directory</span>
              </div>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                Dados oficiais importados: {azureSearchResult.displayName} ({azureSearchResult.jobTitle || "Sem cargo"}) — {azureSearchResult.department || "Geral"}.
              </p>
            </div>
          )}

          <form onSubmit={handleSaveUser} className="space-y-4">
            {/* Campo E-mail + Botão Buscar no Azure AD */}
            <div className="space-y-1.5">
              <Label htmlFor="form-email" className="text-xs font-semibold">
                E-mail Corporativo (Microsoft 365)*
              </Label>
              <div className="flex gap-2">
                <Input
                  id="form-email"
                  type="email"
                  required
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="colaborador@grupofarroupilha.com"
                  className="h-9 text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleLookupAzureUser}
                  disabled={isSearchingAzure || !formEmail.trim()}
                  className="h-9 shrink-0 gap-1.5 text-xs font-semibold cursor-pointer"
                  title="Buscar dados do colaborador no Azure AD"
                >
                  {isSearchingAzure ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="size-3.5 text-primary" />
                  )}
                  Buscar no AD
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Ao clicar em "Buscar no AD", o sistema preenche automaticamente o nome, cargo e departamento do Microsoft Graph.
              </p>
            </div>

            {/* Nome e Sobrenome */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="form-first-name" className="text-xs font-semibold">
                  Nome*
                </Label>
                <Input
                  id="form-first-name"
                  required
                  value={formFirstName}
                  onChange={(e) => setFormFirstName(e.target.value)}
                  placeholder="Ex: Carlos"
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="form-last-name" className="text-xs font-semibold">
                  Sobrenome
                </Label>
                <Input
                  id="form-last-name"
                  value={formLastName}
                  onChange={(e) => setFormLastName(e.target.value)}
                  placeholder="Ex: Silveira"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Grupo de Permissões */}
            <div className="space-y-1.5">
              <Label htmlFor="form-grupo" className="text-xs font-semibold">
                Grupo de Permissões (RBAC)*
              </Label>
              <select
                id="form-grupo"
                required
                value={formGrupoId}
                onChange={(e) => setFormGrupoId(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              >
                {grupos.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nome} {g.is_admin_padrao ? "(Acesso Total Irrestrito)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Cargo e Departamento */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="form-cargo" className="text-xs">
                  Cargo
                </Label>
                <Input
                  id="form-cargo"
                  value={formCargo}
                  onChange={(e) => setFormCargo(e.target.value)}
                  placeholder="Ex: Engenheiro Agrônomo"
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="form-departamento" className="text-xs">
                  Departamento
                </Label>
                <Input
                  id="form-departamento"
                  value={formDepartamento}
                  onChange={(e) => setFormDepartamento(e.target.value)}
                  placeholder="Operações Agrícolas"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Telefone e Empresa */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="form-telefone" className="text-xs">
                  Telefone / WhatsApp
                </Label>
                <Input
                  id="form-telefone"
                  value={formTelefone}
                  onChange={(e) => setFormTelefone(e.target.value)}
                  placeholder="(00) 00000-0000"
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="form-empresa" className="text-xs">
                  Unidade / Empresa
                </Label>
                <Input
                  id="form-empresa"
                  value={formEmpresa}
                  onChange={(e) => setFormEmpresa(e.target.value)}
                  placeholder="Grupo Farroupilha"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Fazendas Autorizadas */}
            {farms.length > 0 && (
              <div className="space-y-2 border-t border-border pt-3">
                <Label className="text-xs font-semibold block">
                  Fazendas com Acesso Autorizado
                </Label>
                <p className="text-[11px] text-muted-foreground mb-2">
                  (Administradores têm acesso a todas as fazendas. Para demais grupos, restrinja o escopo abaixo).
                </p>
                <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto rounded-md border border-border p-2">
                  {farms.map((farm) => (
                    <label
                      key={farm.id}
                      className="flex items-center gap-2 text-xs text-foreground cursor-pointer hover:bg-muted/50 p-1 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={formSelectedFarms.includes(farm.id)}
                        onChange={() => handleToggleFarm(farm.id)}
                        className="rounded border-input text-primary focus:ring-primary"
                      />
                      <span className="truncate">{farm.nome}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Status Ativo / Inativo */}
            <div className="flex items-center gap-2 border-t border-border pt-3">
              <input
                type="checkbox"
                id="form-ativo"
                checked={formAtivo}
                onChange={(e) => setFormAtivo(e.target.checked)}
                className="rounded border-input text-primary focus:ring-primary"
              />
              <Label htmlFor="form-ativo" className="text-xs font-semibold cursor-pointer">
                Colaborador Ativo no Cockpit de Pivôs
              </Label>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsUserModalOpen(false)}
                disabled={isSubmittingUser}
                className="cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmittingUser}
                className="cursor-pointer font-semibold gap-1.5"
              >
                {isSubmittingUser ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Salvando...
                  </>
                ) : editingUser ? (
                  "Salvar Alterações"
                ) : (
                  "Concluir Pré-Cadastro 365"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* =====================================================================
          MODAL DE GRUPO DE PERMISSÕES & MATRIZ GRANULAR
         ===================================================================== */}
      <Dialog open={isGrupoModalOpen} onOpenChange={setIsGrupoModalOpen}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingGrupo ? `Editar Matriz de Permissões: ${editingGrupo.nome}` : "Novo Grupo de Permissões"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Defina as permissões granulares para cada tela e cadastro: visualizar por completo, incluir, alterar ou excluir.
            </DialogDescription>
          </DialogHeader>

          {grupoModalError && (
            <Alert variant="destructive" className="py-2 text-xs">
              <AlertTriangle className="size-3.5 inline mr-1" />
              {grupoModalError}
            </Alert>
          )}

          <form onSubmit={handleSaveGrupo} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="grupo-nome" className="text-xs font-semibold">
                  Nome do Grupo*
                </Label>
                <Input
                  id="grupo-nome"
                  required
                  value={grupoNome}
                  onChange={(e) => setGrupoNome(e.target.value)}
                  placeholder="Ex: Gestor de Irrigação Norte"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="grupo-descricao" className="text-xs">
                  Descrição
                </Label>
                <Input
                  id="grupo-descricao"
                  value={grupoDescricao}
                  onChange={(e) => setGrupoDescricao(e.target.value)}
                  placeholder="Finalidade e escopo de atuação do grupo"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Checkbox Administrador Padrão */}
            <div className="rounded-lg border border-border bg-muted/30 p-3 flex items-center justify-between">
              <div>
                <Label htmlFor="grupo-is-admin" className="text-xs font-semibold cursor-pointer block">
                  Administrador Padrão (Acesso Irrestrito Total)
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Se marcado, os usuários deste grupo terão acesso irrestrito a todas as telas, cadastros e ações sem restrições.
                </p>
              </div>
              <input
                type="checkbox"
                id="grupo-is-admin"
                checked={grupoIsAdmin}
                onChange={(e) => setGrupoIsAdmin(e.target.checked)}
                className="size-4 rounded border-input text-primary focus:ring-primary cursor-pointer"
              />
            </div>

            {/* Matriz Granular de Telas e Cadastros */}
            {!grupoIsAdmin && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Matriz de Permissões por Tela e Cadastro
                  </h3>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        handleSetAllInColumn("pode_acessar_tela", true);
                        handleSetAllInColumn("pode_visualizar_completo", true);
                        handleSetAllInColumn("pode_incluir", false);
                        handleSetAllInColumn("pode_alterar", false);
                        handleSetAllInColumn("pode_excluir", false);
                      }}
                      className="h-7 text-[11px] cursor-pointer"
                    >
                      Apenas Leitura
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        handleSetAllInColumn("pode_acessar_tela", true);
                        handleSetAllInColumn("pode_visualizar_completo", true);
                        handleSetAllInColumn("pode_incluir", true);
                        handleSetAllInColumn("pode_alterar", true);
                        handleSetAllInColumn("pode_excluir", false);
                      }}
                      className="h-7 text-[11px] cursor-pointer"
                    >
                      Operacional Completo
                    </Button>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/50 text-[11px] font-semibold text-muted-foreground uppercase border-b border-border">
                      <tr>
                        <th className="py-2.5 px-3">Tela / Cadastro</th>
                        <th className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleSetAllInColumn("pode_acessar_tela", true)}
                            className="hover:underline font-bold"
                            title="Marcar todos"
                          >
                            Acessar Tela
                          </button>
                        </th>
                        <th className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleSetAllInColumn("pode_visualizar_completo", true)}
                            className="hover:underline font-bold"
                            title="Marcar todos"
                          >
                            Visualizar Completo
                          </button>
                        </th>
                        <th className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleSetAllInColumn("pode_incluir", true)}
                            className="hover:underline font-bold"
                            title="Marcar todos"
                          >
                            Incluir
                          </button>
                        </th>
                        <th className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleSetAllInColumn("pode_alterar", true)}
                            className="hover:underline font-bold"
                            title="Marcar todos"
                          >
                            Alterar
                          </button>
                        </th>
                        <th className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleSetAllInColumn("pode_excluir", true)}
                            className="hover:underline font-bold text-destructive"
                            title="Marcar todos"
                          >
                            Excluir
                          </button>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {modulosDisponiveis.map((m) => {
                        const perm = grupoPermissoes[m.codigo] || {
                          modulo: m.codigo,
                          pode_acessar_tela: true,
                          pode_visualizar_completo: true,
                          pode_incluir: false,
                          pode_alterar: false,
                          pode_excluir: false,
                        };

                        return (
                          <tr key={m.codigo} className="hover:bg-muted/20 transition-colors">
                            <td className="py-2 px-3 font-semibold text-foreground">
                              {m.nome}
                              <span className="block text-[10px] text-muted-foreground font-mono font-normal">
                                {m.codigo}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={perm.pode_acessar_tela}
                                onChange={() => handleTogglePermissao(m.codigo, "pode_acessar_tela")}
                                className="size-4 rounded border-input text-primary focus:ring-primary cursor-pointer"
                              />
                            </td>
                            <td className="py-2 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={perm.pode_visualizar_completo}
                                onChange={() => handleTogglePermissao(m.codigo, "pode_visualizar_completo")}
                                className="size-4 rounded border-input text-primary focus:ring-primary cursor-pointer"
                              />
                            </td>
                            <td className="py-2 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={perm.pode_incluir}
                                onChange={() => handleTogglePermissao(m.codigo, "pode_incluir")}
                                className="size-4 rounded border-input text-primary focus:ring-primary cursor-pointer"
                              />
                            </td>
                            <td className="py-2 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={perm.pode_alterar}
                                onChange={() => handleTogglePermissao(m.codigo, "pode_alterar")}
                                className="size-4 rounded border-input text-primary focus:ring-primary cursor-pointer"
                              />
                            </td>
                            <td className="py-2 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={perm.pode_excluir}
                                onChange={() => handleTogglePermissao(m.codigo, "pode_excluir")}
                                className="size-4 rounded border-input text-destructive focus:ring-destructive cursor-pointer"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsGrupoModalOpen(false)}
                disabled={isSubmittingGrupo}
                className="cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmittingGrupo}
                className="cursor-pointer font-semibold gap-1.5"
              >
                {isSubmittingGrupo ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Salvando Matriz...
                  </>
                ) : (
                  "Salvar Grupo e Permissões"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}