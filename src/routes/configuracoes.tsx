import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Users,
  Shield,
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
  type UserRole,
  type Farm,
  type CreateUserData,
  type UpdateUserData,
} from "@/services/api";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações e Acessos — Cockpit de Pivôs" },
      { name: "description", content: "Gerenciamento de usuários, perfis RBAC e políticas de acesso." },
      { property: "og:title", content: "Configurações e Acessos — Cockpit de Pivôs" },
      { property: "og:description", content: "Gerenciamento de usuários, perfis RBAC e políticas de acesso." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConfiguracoesPage,
});

function ConfiguracoesPage() {
  const currentUser = getStoredUser();
  const isAdmin = currentUser?.profile?.role === "ADMIN";

  const [users, setUsers] = useState<UserData[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("TODOS");

  // Modal de Criação / Edição
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Dados do formulário
  const [formUsername, setFormUsername] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formFirstName, setFormFirstName] = useState("");
  const [formLastName, setFormLastName] = useState("");
  const [formRole, setFormRole] = useState<UserRole>("OPERADOR");
  const [formCargo, setFormCargo] = useState("");
  const [formEmpresa, setFormEmpresa] = useState("");
  const [formTelefone, setFormTelefone] = useState("");
  const [formAtivo, setFormAtivo] = useState(true);
  const [formSelectedFarms, setFormSelectedFarms] = useState<string[]>([]);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const farmsData = await api.getFarms().catch(() => []);
      setFarms(farmsData);

      if (isAdmin) {
        const usersData = await api.getUsers();
        setUsers(usersData);
      }
    } catch (err: any) {
      setError(err?.message || "Erro ao carregar dados de usuários.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [isAdmin]);

  const handleOpenCreate = () => {
    setEditingUser(null);
    setFormUsername("");
    setFormEmail("");
    setFormPassword("");
    setFormFirstName("");
    setFormLastName("");
    setFormRole("OPERADOR");
    setFormCargo("");
    setFormEmpresa("");
    setFormTelefone("");
    setFormAtivo(true);
    setFormSelectedFarms([]);
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user: UserData) => {
    setEditingUser(user);
    setFormUsername(user.username);
    setFormEmail(user.email);
    setFormPassword("");
    setFormFirstName(user.first_name || "");
    setFormLastName(user.last_name || "");
    setFormRole(user.profile?.role || "OPERADOR");
    setFormCargo(user.profile?.cargo || "");
    setFormEmpresa(user.profile?.empresa_nome || "");
    setFormTelefone(user.profile?.telefone || "");
    setFormAtivo(user.is_active && (user.profile?.ativo ?? true));
    setFormSelectedFarms(user.profile?.fazendas || []);
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleToggleFarm = (farmId: string) => {
    setFormSelectedFarms((prev) =>
      prev.includes(farmId) ? prev.filter((id) => id !== farmId) : [...prev, farmId]
    );
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!formUsername.trim() || !formEmail.trim()) {
      setModalError("Nome de usuário e e-mail são obrigatórios.");
      return;
    }

    if (!editingUser && !formPassword) {
      setModalError("Uma senha inicial é obrigatória para cadastrar um novo usuário.");
      return;
    }

    setIsSubmitting(true);

    try {
      if (editingUser) {
        const updatePayload: UpdateUserData = {
          username: formUsername.trim(),
          email: formEmail.trim(),
          first_name: formFirstName.trim(),
          last_name: formLastName.trim(),
          role: formRole,
          cargo: formCargo.trim(),
          empresa_nome: formEmpresa.trim(),
          telefone: formTelefone.trim(),
          ativo: formAtivo,
          fazendas: formSelectedFarms,
        };
        if (formPassword.trim()) {
          updatePayload.password = formPassword.trim();
        }

        await api.updateUser(editingUser.id, updatePayload);
        setSuccessMessage(`Usuário ${formUsername} atualizado com sucesso.`);
      } else {
        const createPayload: CreateUserData = {
          username: formUsername.trim(),
          email: formEmail.trim(),
          password: formPassword.trim(),
          first_name: formFirstName.trim(),
          last_name: formLastName.trim(),
          role: formRole,
          cargo: formCargo.trim(),
          empresa_nome: formEmpresa.trim(),
          telefone: formTelefone.trim(),
          ativo: formAtivo,
          fazendas: formSelectedFarms,
        };

        await api.createUser(createPayload);
        setSuccessMessage(`Novo usuário ${formUsername} cadastrado com sucesso.`);
      }

      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      setModalError(err?.message || "Erro ao salvar usuário no servidor.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (user: UserData) => {
    try {
      const res = await api.toggleUserActive(user.id);
      setSuccessMessage(res.message);
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Não foi possível alterar o status do usuário.");
    }
  };

  // Filtragem
  const filteredUsers = users.filter((u) => {
    const matchSearch =
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${u.first_name} ${u.last_name}`.toLowerCase().includes(searchTerm.toLowerCase());

    const matchRole = roleFilter === "TODOS" || u.profile?.role === roleFilter;

    return matchSearch && matchRole;
  });

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "ADMIN":
        return "border-primary/40 bg-primary/10 text-primary font-bold";
      case "GESTOR":
        return "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold";
      case "OPERADOR":
        return "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold";
      case "CONSULTOR":
        return "border-purple-500/40 bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold";
      default:
        return "border-slate-500/40 bg-slate-500/10 text-slate-600";
    }
  };

  return (
    <div className="flex-1 space-y-6 p-6 sm:p-8">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Configurações & Controle de Acesso
          </h1>
          <p className="text-sm text-muted-foreground">
            Gerenciamento de contas, perfis RBAC e políticas de segurança do Cockpit de Pivôs.
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
              onClick={handleOpenCreate}
              className="cursor-pointer gap-1.5 font-semibold shadow-sm"
            >
              <UserPlus className="size-4" />
              Novo Usuário
            </Button>
          )}
        </div>
      </div>

      {/* Alertas de Notificação */}
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

      {/* Tabs Principais */}
      <Tabs defaultValue="usuarios" className="space-y-6">
        <TabsList className="bg-muted/70 p-1">
          <TabsTrigger value="usuarios" className="gap-2 cursor-pointer text-xs sm:text-sm">
            <Users className="size-4" />
            Gestão de Usuários (RBAC)
          </TabsTrigger>
          <TabsTrigger value="perfis" className="gap-2 cursor-pointer text-xs sm:text-sm">
            <Shield className="size-4" />
            Matriz de Permissões
          </TabsTrigger>
          <TabsTrigger value="seguranca" className="gap-2 cursor-pointer text-xs sm:text-sm">
            <KeyRound className="size-4" />
            Sessão & Minha Conta
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Gestão de Usuários */}
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
                      Seu usuário atual possui o perfil{" "}
                      <strong className="text-foreground">{currentUser?.profile?.role_display || "Operacional"}</strong>.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground leading-relaxed">
                Apenas usuários com privilégios de Administrador (`ADMIN`) têm autorização para listar,
                cadastrar, editar ou alterar o status de outras contas corporativas. Para solicitar alterações em seu
                acesso, contate o responsável técnico do sistema.
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
                    placeholder="Buscar por nome, usuário ou e-mail..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 h-10 text-sm bg-background"
                  />
                </div>
                <div className="sm:col-span-5 flex gap-2">
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    <option value="TODOS">Todos os Perfis</option>
                    <option value="ADMIN">Administrador (ADMIN)</option>
                    <option value="GESTOR">Gestor (GESTOR)</option>
                    <option value="OPERADOR">Operador de Campo (OPERADOR)</option>
                    <option value="CONSULTOR">Consultor Técnico (CONSULTOR)</option>
                  </select>
                </div>
              </div>

              {/* Tabela de Usuários */}
              <Card className="border-border">
                <CardHeader className="pb-3 border-b border-border/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Contas de Usuários Registradas</CardTitle>
                      <CardDescription className="text-xs">
                        {filteredUsers.length} usuário(s) encontrado(s) no banco local.
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
                    <div className="py-12 text-center text-sm text-muted-foreground">
                      Nenhum usuário localizado com os critérios informados.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                          <tr>
                            <th className="px-6 py-3.5">Usuário & Nome</th>
                            <th className="px-6 py-3.5">E-mail</th>
                            <th className="px-6 py-3.5">Perfil RBAC</th>
                            <th className="px-6 py-3.5">Empresa / Cargo</th>
                            <th className="px-6 py-3.5 text-center">Status</th>
                            <th className="px-6 py-3.5 text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {filteredUsers.map((u) => {
                            const isUserActive = u.is_active && (u.profile?.ativo ?? true);
                            const isSelf = currentUser?.id === u.id;
                            return (
                              <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="grid size-9 place-items-center rounded-full bg-primary/10 font-bold text-primary text-xs">
                                      {u.first_name ? u.first_name[0]?.toUpperCase() : (u.username[0]?.toUpperCase() ?? "U")}
                                    </div>
                                    <div>
                                      <div className="font-semibold text-foreground flex items-center gap-1.5">
                                        {u.first_name ? `${u.first_name} ${u.last_name || ""}` : u.username}
                                        {isSelf && (
                                          <span className="text-[10px] bg-muted px-1.5 py-0.2 rounded text-muted-foreground">
                                            Você
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-xs text-muted-foreground">@{u.username}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-xs text-muted-foreground">
                                  {u.email || "—"}
                                </td>
                                <td className="px-6 py-4">
                                  <Badge variant="outline" className={`text-[11px] ${getRoleBadgeVariant(u.profile?.role)}`}>
                                    {u.profile?.role_display || u.profile?.role}
                                  </Badge>
                                </td>
                                <td className="px-6 py-4 text-xs text-muted-foreground">
                                  <div>{u.profile?.empresa_nome || "Fazenda Principal"}</div>
                                  <div className="text-[11px] text-muted-foreground/75">{u.profile?.cargo || "Operador"}</div>
                                </td>
                                <td className="px-6 py-4 text-center">
                                  {isUserActive ? (
                                    <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-semibold">
                                      Ativo
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-slate-500/15 text-slate-500 border-slate-500/30 text-[10px] font-semibold">
                                      Inativo
                                    </Badge>
                                  )}
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleOpenEdit(u)}
                                      className="h-8 px-2 text-xs cursor-pointer hover:bg-muted"
                                      title="Editar Usuário"
                                    >
                                      <Edit2 className="size-3.5 mr-1" />
                                      Editar
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleToggleActive(u)}
                                      disabled={isSelf}
                                      className={`h-8 px-2 text-xs cursor-pointer ${
                                        isUserActive
                                          ? "text-destructive hover:bg-destructive/10"
                                          : "text-emerald-600 hover:bg-emerald-500/10"
                                      }`}
                                      title={isUserActive ? "Desativar Conta" : "Ativar Conta"}
                                    >
                                      {isUserActive ? (
                                        <>
                                          <PowerOff className="size-3.5 mr-1" />
                                          Desativar
                                        </>
                                      ) : (
                                        <>
                                          <Power className="size-3.5 mr-1" />
                                          Ativar
                                        </>
                                      )}
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

        {/* TAB 2: Matriz de Perfis RBAC */}
        <TabsContent value="perfis" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {/* Card Administrador */}
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader className="pb-3">
                <Badge className="w-fit mb-2 border-primary/40 bg-primary/20 text-primary font-bold">
                  ADMIN
                </Badge>
                <CardTitle className="text-base text-foreground">Administrador</CardTitle>
                <CardDescription className="text-xs">
                  Controle total sobre a infraestrutura e segurança.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-muted-foreground leading-relaxed">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="size-3.5 text-primary shrink-0 mt-0.5" />
                  <span>CRUD completo de usuários e senhas</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="size-3.5 text-primary shrink-0 mt-0.5" />
                  <span>Cadastrar e editar fazendas e pivôs</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="size-3.5 text-primary shrink-0 mt-0.5" />
                  <span>Acesso a todas as fazendas sem restrição</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="size-3.5 text-primary shrink-0 mt-0.5" />
                  <span>Visualização de logs de auditoria</span>
                </div>
              </CardContent>
            </Card>

            {/* Card Gestor */}
            <Card className="border-blue-500/30 bg-blue-500/5">
              <CardHeader className="pb-3">
                <Badge className="w-fit mb-2 border-blue-500/40 bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold">
                  GESTOR
                </Badge>
                <CardTitle className="text-base text-foreground">Gestor de Fazenda</CardTitle>
                <CardDescription className="text-xs">
                  Gerenciamento operacional e supervisão tática.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-muted-foreground leading-relaxed">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="size-3.5 text-blue-500 shrink-0 mt-0.5" />
                  <span>Acesso às fazendas expressamente autorizadas</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="size-3.5 text-blue-500 shrink-0 mt-0.5" />
                  <span>Criação e edição de programas de irrigação</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="size-3.5 text-blue-500 shrink-0 mt-0.5" />
                  <span>Reconhecimento de alertas e janelas</span>
                </div>
                <div className="flex items-start gap-2">
                  <XCircle className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  <span>Bloqueado para administração de usuários</span>
                </div>
              </CardContent>
            </Card>

            {/* Card Operador */}
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardHeader className="pb-3">
                <Badge className="w-fit mb-2 border-amber-500/40 bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold">
                  OPERADOR
                </Badge>
                <CardTitle className="text-base text-foreground">Operador de Campo</CardTitle>
                <CardDescription className="text-xs">
                  Execução e apontamentos diretos no campo e mobile.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-muted-foreground leading-relaxed">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="size-3.5 text-amber-500 shrink-0 mt-0.5" />
                  <span>Apontamentos de irrigação via Web e Mobile</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="size-3.5 text-amber-500 shrink-0 mt-0.5" />
                  <span>Envio de comandos rápidos operacionais</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="size-3.5 text-amber-500 shrink-0 mt-0.5" />
                  <span>Sincronização offline e outbox queue</span>
                </div>
                <div className="flex items-start gap-2">
                  <XCircle className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  <span>Bloqueado para alterar parâmetros estruturais</span>
                </div>
              </CardContent>
            </Card>

            {/* Card Consultor */}
            <Card className="border-purple-500/30 bg-purple-500/5">
              <CardHeader className="pb-3">
                <Badge className="w-fit mb-2 border-purple-500/40 bg-purple-500/20 text-purple-600 dark:text-purple-400 font-bold">
                  CONSULTOR
                </Badge>
                <CardTitle className="text-base text-foreground">Consultor Técnico</CardTitle>
                <CardDescription className="text-xs">
                  Análise agronômica, relatórios e auditoria.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-muted-foreground leading-relaxed">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="size-3.5 text-purple-500 shrink-0 mt-0.5" />
                  <span>Consulta a telemetrias e status em tempo real</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="size-3.5 text-purple-500 shrink-0 mt-0.5" />
                  <span>Relatórios de lâmina acumulada e eficiência</span>
                </div>
                <div className="flex items-start gap-2">
                  <XCircle className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  <span>Sem permissão de acionamento ou escrita</span>
                </div>
                <div className="flex items-start gap-2">
                  <XCircle className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  <span>Bloqueado para administração de usuários</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 3: Sessão & Minha Conta */}
        <TabsContent value="seguranca" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Informações da Conta Conectada</CardTitle>
                <CardDescription className="text-xs">
                  Dados do seu usuário autenticado atualmente no Cockpit.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex justify-between border-b border-border/50 pb-2">
                  <span className="text-muted-foreground">Identificação:</span>
                  <span className="font-semibold text-foreground">@{currentUser?.username || "—"}</span>
                </div>
                <div className="flex justify-between border-b border-border/50 pb-2">
                  <span className="text-muted-foreground">Nome Completo:</span>
                  <span className="font-semibold text-foreground">
                    {currentUser?.first_name ? `${currentUser.first_name} ${currentUser.last_name || ""}` : "—"}
                  </span>
                </div>
                <div className="flex justify-between border-b border-border/50 pb-2">
                  <span className="text-muted-foreground">E-mail:</span>
                  <span className="font-semibold text-foreground">{currentUser?.email || "—"}</span>
                </div>
                <div className="flex justify-between border-b border-border/50 pb-2">
                  <span className="text-muted-foreground">Perfil Atribuído:</span>
                  <Badge variant="outline" className={getRoleBadgeVariant(currentUser?.profile?.role || "")}>
                    {currentUser?.profile?.role_display || currentUser?.profile?.role || "Usuário"}
                  </Badge>
                </div>
                <div className="flex justify-between border-b border-border/50 pb-2">
                  <span className="text-muted-foreground">Empresa:</span>
                  <span className="font-medium text-foreground">{currentUser?.profile?.empresa_nome || "—"}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Token de Sessão & Autenticação</CardTitle>
                <CardDescription className="text-xs">
                  Detalhes do token criptográfico de comunicação com a API Django.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="rounded-md border border-border bg-muted/40 p-3 font-mono text-xs break-all">
                  <span className="text-muted-foreground block mb-1">Authorization Header:</span>
                  <span className="text-foreground">
                    Token {getAuthToken() ? `${getAuthToken()?.substring(0, 8)}••••••••••••••••••••••••` : "Não autenticado"}
                  </span>
                </div>

                <div className="text-xs text-muted-foreground leading-relaxed">
                  Este token é emitido pelo Django REST Framework e validado em cada requisição HTTP para os endpoints protegidos.
                  Ao clicar em <strong>Encerrar Sessão</strong>, o token é revogado no backend e removido deste navegador.
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

      {/* Modal / Dialog de Cadastro e Edição de Usuário */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? `Editar Usuário: @${editingUser.username}` : "Cadastrar Novo Usuário"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Defina as credenciais, o papel RBAC e o escopo de fazendas autorizadas.
            </DialogDescription>
          </DialogHeader>

          {modalError && (
            <Alert variant="destructive" className="py-2 text-xs">
              <AlertTriangle className="size-3.5 inline mr-1" />
              {modalError}
            </Alert>
          )}

          <form onSubmit={handleSaveUser} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="form-username" className="text-xs font-semibold">
                  Usuário (Username)*
                </Label>
                <Input
                  id="form-username"
                  required
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.target.value)}
                  placeholder="Ex: joao.silva"
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="form-email" className="text-xs font-semibold">
                  E-mail Corporativo*
                </Label>
                <Input
                  id="form-email"
                  type="email"
                  required
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="joao@empresa.com.br"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="form-password" className="text-xs font-semibold">
                {editingUser ? "Nova Senha (deixe em branco para manter a atual)" : "Senha Inicial*"}
              </Label>
              <Input
                id="form-password"
                type="password"
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                placeholder={editingUser ? "••••••••" : "Mínimo 6 caracteres"}
                className="h-9 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="form-first-name" className="text-xs">
                  Nome
                </Label>
                <Input
                  id="form-first-name"
                  value={formFirstName}
                  onChange={(e) => setFormFirstName(e.target.value)}
                  placeholder="João"
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="form-last-name" className="text-xs">
                  Sobrenome
                </Label>
                <Input
                  id="form-last-name"
                  value={formLastName}
                  onChange={(e) => setFormLastName(e.target.value)}
                  placeholder="Silva"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="form-role" className="text-xs font-semibold">
                  Perfil de Acesso (RBAC)*
                </Label>
                <select
                  id="form-role"
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value as UserRole)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="ADMIN">Administrador (ADMIN)</option>
                  <option value="GESTOR">Gestor de Fazenda (GESTOR)</option>
                  <option value="OPERADOR">Operador de Campo (OPERADOR)</option>
                  <option value="CONSULTOR">Consultor Técnico (CONSULTOR)</option>
                </select>
              </div>

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
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="form-empresa" className="text-xs">
                  Empresa / Unidade
                </Label>
                <Input
                  id="form-empresa"
                  value={formEmpresa}
                  onChange={(e) => setFormEmpresa(e.target.value)}
                  placeholder="Ex: Grupo Agro Santa Fé"
                  className="h-9 text-xs"
                />
              </div>
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
            </div>

            {/* Fazendas Autorizadas */}
            {farms.length > 0 && (
              <div className="space-y-2 border-t border-border pt-3">
                <Label className="text-xs font-semibold block">
                  Fazendas com Acesso Autorizado
                </Label>
                <p className="text-[11px] text-muted-foreground mb-2">
                  (Administradores têm acesso a todas as fazendas automaticamente. Para Gestores e Operadores, restrinja o escopo abaixo).
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

            {/* Ativo / Inativo */}
            <div className="flex items-center gap-2 border-t border-border pt-3">
              <input
                id="form-ativo"
                type="checkbox"
                checked={formAtivo}
                onChange={(e) => setFormAtivo(e.target.checked)}
                className="size-4 rounded border-input text-primary focus:ring-primary cursor-pointer"
              />
              <Label htmlFor="form-ativo" className="text-xs font-medium cursor-pointer">
                Conta ativa (permite login no sistema e mobile)
              </Label>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsModalOpen(false)}
                disabled={isSubmitting}
                className="cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="cursor-pointer font-semibold"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Salvar Usuário"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}