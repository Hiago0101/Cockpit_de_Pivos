/**
 * Camada de comunicação com a API Central do Cockpit de Pivôs.
 * Consome os endpoints versionados sob /api/v1/ do backend Django REST Framework.
 */

function resolveApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    return "/api/v1";
  }
  return (import.meta.env as Record<string, string>)["VITE_API_URL"] || "http://localhost:8000/api/v1";
}

const API_BASE_URL = resolveApiBaseUrl();

export interface Company {
  id: string;
  nome: string;
  cnpj: string;
  ativo: boolean;
  fazendas_count?: number;
  criado_em?: string;
  atualizado_em?: string;
}

export interface Farm {
  id: string;
  empresa?: string | null;
  empresa_nome?: string;
  nome: string;
  codigo?: string;
  filial?: string;
  id_pims?: string;
  municipio?: string;
  uf?: string;
  latitude?: number | null;
  longitude?: number | null;
  area_total_ha?: number;
  ativo?: boolean;
  pivos_count?: number;
  criado_em?: string;
  atualizado_em?: string;
}

export interface Field {
  id: string;
  fazenda: string;
  fazenda_nome?: string;
  fazenda_filial?: string;
  codigo: string;
  nome?: string;
  descricao?: string;
  id_pims?: string;
  area_ha?: number;
  ativo?: boolean;
  criado_em?: string;
  atualizado_em?: string;
}

export interface Crop {
  id: string;
  descricao: string;
  fazenda?: string | null;
  fazenda_nome?: string;
  fazenda_filial?: string;
  id_pims?: string;
  criado_em?: string;
  atualizado_em?: string;
}

export type SeasonStatus = "PLANEJADA" | "EM_ANDAMENTO" | "CONCLUIDA" | "CANCELADA";

export interface Season {
  id: string;
  nome: string;
  data_inicio: string;
  data_fim: string;
  status: SeasonStatus;
  ativa: boolean;
  observacoes: string;
  fazenda?: string | null;
  fazenda_nome?: string;
  empresa?: string | null;
  empresa_nome?: string;
  planos_count?: number;
  area_total_planejada_ha?: number;
  criado_em?: string;
  atualizado_em?: string;
}

export type CropPlanStatus = "RASCUNHO" | "PLANEJADO" | "EM_ANDAMENTO" | "CONCLUIDO" | "CANCELADO";

export interface CropPlan {
  id: string;
  safra: string;
  safra_nome: string;
  safra_data_inicio?: string;
  safra_data_fim?: string;
  cultura: string;
  cultura_nome: string;
  fazenda?: string | null;
  fazenda_nome?: string;
  talhao?: string | null;
  talhao_codigo?: string;
  talhao_nome?: string;
  talhao_area_ha?: number;
  pivo?: string | null;
  pivo_codigo?: string;
  pivo_nome?: string;
  pivo_area_irrigada_ha?: number;
  data_plantio: string;
  data_colheita_prevista: string;
  data_plantio_real?: string | null;
  data_colheita_real?: string | null;
  area_planejada_ha: number;
  lamina_total_planejada_mm: number;
  lamina_acumulada_realizada_mm: number;
  status: CropPlanStatus;
  status_display: string;
  permite_sobreposicao?: boolean;
  justificativa_sobreposicao?: string;
  autorizado_por?: string | null;
  autorizado_por_nome?: string | null;
  observacoes: string;
  criado_em?: string;
  atualizado_em?: string;
}

export interface PlanCalendarEvent {
  id: string;
  title: string;
  safra_id: string;
  safra_nome: string;
  cultura_id: string;
  cultura_nome: string;
  fazenda_id?: string | null;
  fazenda_nome?: string;
  talhao_id?: string | null;
  talhao_codigo?: string;
  pivo_id?: string | null;
  pivo_codigo?: string;
  pivo_nome?: string;
  start: string;
  end: string;
  data_plantio: string;
  data_colheita_prevista: string;
  data_plantio_real?: string | null;
  data_colheita_real?: string | null;
  area_planejada_ha: number;
  duracao_planejada_dias?: number;
  duracao_real_dias?: number | null;
  status: CropPlanStatus;
  status_display: string;
  permite_sobreposicao?: boolean;
  justificativa_sobreposicao?: string;
  observacoes?: string;
}

export interface FreePeriodWindow {
  id: string;
  pivo_id?: string | null;
  pivo_codigo?: string;
  talhao_id?: string | null;
  talhao_codigo?: string;
  fazenda_id?: string | null;
  fazenda_nome?: string;
  start: string;
  end: string;
  dias_livres: number;
  label: string;
  tipo: "LIVRE";
  cultura_anterior: string;
  cultura_proxima: string;
  plano_anterior_id: string;
  plano_proximo_id: string;
}

export interface PlanningConflict {
  id: string;
  pivo_id?: string | null;
  pivo_codigo?: string;
  talhao_id?: string | null;
  talhao_codigo?: string;
  fazenda_id?: string | null;
  fazenda_nome?: string;
  start: string;
  end: string;
  dias_sobreposicao: number;
  label: string;
  tipo: "CONFLITO";
  cultura_anterior: string;
  cultura_proxima: string;
  plano_anterior_id: string;
  plano_proximo_id: string;
  mensagem: string;
}

export interface PlanCalendarResponse {
  events: PlanCalendarEvent[];
  total: number;
  periodos_livres?: FreePeriodWindow[];
  conflitos?: PlanningConflict[];
  sem_planejamento_futuro?: Array<{
    pivo_id?: string | null;
    pivo_codigo?: string;
    talhao_id?: string | null;
    talhao_codigo?: string;
    fazenda_id?: string | null;
    fazenda_nome?: string;
    apos_data: string;
    ultima_cultura: string;
    tipo: "SEM_PLANEJAMENTO_FUTURO";
  }>;
}

export interface PlanningIndicators {
  timestamp: string;
  total_planos: number;
  planos_por_status: Record<CropPlanStatus, number>;
  area_total_planejada_ha: number;
  area_por_cultura: Array<{
    cultura_id: string;
    cultura_nome: string;
    area_ha: number;
    planos_count: number;
  }>;
  area_por_safra: Array<{
    safra_id: string;
    safra_nome: string;
    area_ha: number;
    planos_count: number;
  }>;
  planos_por_fazenda: Array<{
    fazenda_id: string;
    fazenda_nome: string;
    area_ha: number;
    planos_count: number;
  }>;
  proximos_plantios: Array<{
    id: string;
    cultura_nome: string;
    safra_nome: string;
    fazenda_nome: string;
    alvo: string;
    data_plantio: string;
    area_planejada_ha: number;
    status: CropPlanStatus;
  }>;
}

export interface PlanAuditItem {
  id: string;
  acao: string;
  detalhes: any;
  usuario: string;
  ip_address?: string | null;
  criado_em: string;
}

// --- JANELAS DE OPORTUNIDADE AGRÍCOLA ---
export type OpportunityType =
  | "TARIFA_NOTURNA"
  | "JANELA_PLANTIO"
  | "JANELA_COLHEITA"
  | "MANUTENCAO_PREVENTIVA"
  | "APORTE_HIDRICO"
  | "TRATAMENTO_FITOSSANITARIO"
  | "OUTRO";

export type OpportunityPriority = "BAIXA" | "MEDIA" | "ALTA" | "CRITICA";

export type OpportunityStatus = "DETECTADA" | "RECONHECIDA" | "RESOLVIDA" | "DESCARTADA";

export type OpportunityOrigin = "MANUAL" | "REGRA_INTERNA" | "INTEGRACAO_EXTERNA";

export interface Opportunity {
  id: string;
  titulo: string;
  descricao: string;
  tipo: OpportunityType;
  tipo_display?: string;
  prioridade: OpportunityPriority;
  prioridade_display?: string;
  status: OpportunityStatus;
  status_display?: string;
  origem: OpportunityOrigin;
  origem_display?: string;

  inicio_janela: string;
  fim_janela: string;
  is_vencida?: boolean;
  aproveitada?: boolean;

  empresa: string;
  empresa_nome?: string;
  fazenda: string;
  fazenda_nome?: string;
  talhao?: string | null;
  talhao_codigo?: string;
  talhao_nome?: string;
  pivo?: string | null;
  pivo_codigo?: string;
  pivo_nome?: string;
  cultura?: string | null;
  cultura_nome?: string;
  safra?: string | null;
  safra_nome?: string;
  plano_operacional?: string | null;
  plano_operacional_titulo?: string;

  autor?: string | null;
  autor_nome?: string;
  justificativa?: string | null;
  evidencia_dados?: Record<string, any>;
  motivo_descarte?: string | null;

  reconhecido_em?: string | null;
  reconhecido_por?: string | null;
  resolvido_em?: string | null;
  resolvido_por?: string | null;
  descartado_em?: string | null;
  descartado_por?: string | null;

  criado_em?: string;
  atualizado_em?: string;
}

export interface OpportunityIndicators {
  timestamp: string;
  total: number;
  ativas: number;
  vencidas: number;
  aproveitadas: number;
  por_status: Record<OpportunityStatus, number>;
  por_prioridade: Record<OpportunityPriority, number>;
  por_tipo?: Record<OpportunityType, number>;
}

export interface OpportunityAuditItem {
  id: string;
  acao: string;
  detalhes: any;
  usuario: string;
  ip_address?: string | null;
  criado_em: string;
}

export type PivotStatus = "PARADO" | "IRRIGANDO" | "FERTIRRIGANDO" | "MANUTENCAO" | "FALHA";
export type PivotDirection = "HORARIO" | "ANTI_HORARIO" | "ESTACIONARIO";

export interface Pivot {
  id: string;
  fazenda: string;
  fazenda_nome: string;
  codigo: string;
  nome: string;
  fabricante: string;
  modelo: string;
  latitude_centro: number;
  longitude_centro: number;
  raio_metros: number;
  area_irrigada_ha: number;
  vazao_nominal_m3h: number;
  pressao_nominal_bar: number;
  velocidade_100_percent_mh: number;
  status_operacional: PivotStatus;
  status_display: string;
  angulo_atual_graus: number;
  sentido_rotacao: PivotDirection;
  sentido_display: string;
  percentimetro_atual: number;
  lamina_atual_mm: number;
  pressao_atual_bar: number;
  tensao_eletrica_v: number;
  ultima_comunicacao: string;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface CockpitSummary {
  timestamp: string;
  indicadores: {
    total_pivos: number;
    irrigando_count: number;
    parados_count: number;
    falhas_count: number;
    manutencao_count: number;
    area_total_ha: number;
    taxa_operacao_pct: number;
    alertas_criticos: number;
    alertas_atencao: number;
    janelas_ativas: number;
  };
}

export interface IrrigationRecord {
  id: string;
  client_op_id?: string;
  pivo: string;
  pivo_codigo: string;
  operador_nome?: string;
  inicio_em: string;
  fim_em?: string | null;
  percentimetro: number;
  lamina_aplicada_mm: number;
  sentido: string;
  tarifa_aplicada: string;
  origem: string;
  observacoes: string;
}

export interface AlertItem {
  id: string;
  pivo: string;
  pivo_codigo: string;
  tipo: string;
  severidade: "INFO" | "ATENCAO" | "CRITICO";
  severidade_display: string;
  titulo: string;
  mensagem: string;
  gerado_em: string;
  reconhecido_em?: string | null;
  resolvido_em?: string | null;
}

export interface OpportunityWindow {
  id: string;
  pivo: string;
  pivo_codigo: string;
  inicio_previsto: string;
  fim_previsto: string;
  motivo: string;
  tarifa_vigente: string;
  economia_estimada_reais: number;
  recomendacao: string;
  aproveitada: boolean;
}

export type UserRole = "ADMIN" | "GESTOR" | "OPERADOR" | "CONSULTOR";

export interface ModuloPermissao {
  pode_acessar_tela: boolean;
  pode_visualizar_completo: boolean;
  pode_incluir: boolean;
  pode_alterar: boolean;
  pode_excluir: boolean;
}

export interface GrupoPermissaoItem {
  id?: string;
  modulo: string;
  modulo_display?: string;
  pode_acessar_tela: boolean;
  pode_visualizar_completo: boolean;
  pode_incluir: boolean;
  pode_alterar: boolean;
  pode_excluir: boolean;
}

export interface GrupoPermissao {
  id: string;
  nome: string;
  descricao: string;
  is_admin_padrao: boolean;
  ativo: boolean;
  usuarios_count?: number;
  permissoes?: GrupoPermissaoItem[];
  criado_em?: string;
  atualizado_em?: string;
}

export interface AzureUserInfo {
  found: boolean;
  configured?: boolean;
  id?: string;
  displayName?: string;
  givenName?: string;
  surname?: string;
  mail?: string;
  userPrincipalName?: string;
  jobTitle?: string;
  department?: string;
  accountEnabled?: boolean;
  mobilePhone?: string;
  detail?: string;
}

export interface UserProfileData {
  id?: string;
  grupo?: GrupoPermissao | null;
  role: UserRole;
  role_display: string;
  ad_oid?: string;
  ad_upn?: string;
  empresa_nome: string;
  cargo: string;
  telefone: string;
  departamento?: string;
  ativo: boolean;
  fazendas: string[];
}

export interface UserData {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  nome_completo?: string;
  is_active: boolean;
  is_staff?: boolean;
  is_superuser?: boolean;
  profile: UserProfileData;
  permissoes?: Record<string, ModuloPermissao>;
}

export interface AuthResponse {
  token: string;
  user: UserData;
  message: string;
}

export interface CreateUserData {
  email: string;
  first_name: string;
  last_name?: string;
  username?: string;
  password?: string;
  grupo_id?: string;
  role?: UserRole;
  cargo?: string;
  telefone?: string;
  departamento?: string;
  empresa_nome?: string;
  ativo?: boolean;
  fazendas?: string[];
  ad_oid?: string;
  ad_upn?: string;
}

export interface UpdateUserData {
  email?: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  password?: string;
  grupo_id?: string;
  role?: UserRole;
  cargo?: string;
  telefone?: string;
  departamento?: string;
  empresa_nome?: string;
  ativo?: boolean;
  fazendas?: string[];
}

let authToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  authToken = token;
  if (typeof window !== "undefined") {
    if (token) localStorage.setItem("cockpit_auth_token", token);
    else localStorage.removeItem("cockpit_auth_token");
  }
};

export const getAuthToken = (): string | null => {
  if (authToken) return authToken;
  if (typeof window !== "undefined") {
    authToken = localStorage.getItem("cockpit_auth_token");
  }
  return authToken;
};

export const getStoredUser = (): UserData | null => {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("cockpit_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserData;
  } catch {
    return null;
  }
};

export const setStoredUser = (user: UserData | null) => {
  if (typeof window !== "undefined") {
    if (user) {
      localStorage.setItem("cockpit_user", JSON.stringify(user));
      localStorage.setItem("cockpit_authenticated", "true");
    } else {
      localStorage.removeItem("cockpit_user");
      localStorage.removeItem("cockpit_authenticated");
    }
  }
};

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Token ${token}`;
  }

  try {
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      if (response.status === 401) {
        setAuthToken(null);
        setStoredUser(null);
        if (typeof window !== "undefined" && !window.location.pathname.includes("/login")) {
          window.location.href = "/login";
        }
      }
      const errorBody = await response.json().catch(() => ({}));
      const message =
        errorBody.detail ||
        errorBody.message ||
        (typeof errorBody === "object" ? Object.values(errorBody).flat().join(" ") : "") ||
        `Erro HTTP ${response.status} na API`;
      throw new Error(message || `Erro HTTP ${response.status} na API`);
    }

    if (response.status === 204 || response.headers?.get?.("content-length") === "0") {
      return {} as T;
    }
    if (typeof response.text === "function") {
      const text = await response.text();
      if (!text || !text.trim()) {
        return {} as T;
      }
      return JSON.parse(text) as T;
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes("fetch")) {
      throw new Error(`Não foi possível conectar ao servidor da API em ${API_BASE_URL}. Verifique a rede corporativa.`);
    }
    throw error;
  }
}

export const api = {
  // Auth
  login: async (username: string, password: string): Promise<AuthResponse> => {
    const res = await request<AuthResponse>("/core/auth/login/", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    setAuthToken(res.token);
    setStoredUser(res.user);
    return res;
  },

  getMe: async (): Promise<UserData> => {
    const res = await request<UserData>("/core/auth/me/");
    setStoredUser(res);
    return res;
  },

  logout: async (): Promise<void> => {
    try {
      await request<{ message: string }>("/core/auth/logout/", {
        method: "POST",
      });
    } catch {
      // Ignora erro caso a sessão já tenha expirado
    } finally {
      setAuthToken(null);
      setStoredUser(null);
    }
  },

  // User Management (RBAC)
  getUsers: async (): Promise<UserData[]> => {
    const res = await request<UserData[] | { results: UserData[] }>("/core/users/");
    return Array.isArray(res) ? res : res.results;
  },

  createUser: async (data: CreateUserData): Promise<UserData> => {
    return request<UserData>("/core/users/", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  updateUser: async (id: number, data: UpdateUserData): Promise<UserData> => {
    return request<UserData>(`/core/users/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  // Microsoft 365 / Azure AD Auth
  loginAzure: async (payload: { access_token?: string; id_token?: string; code?: string; redirect_uri?: string; email?: string }): Promise<AuthResponse> => {
    const res = await request<AuthResponse>("/core/auth/azure/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setAuthToken(res.token);
    setStoredUser(res.user);
    return res;
  },

  lookupAzureUser: (email: string): Promise<AzureUserInfo> => {
    return request<AzureUserInfo>(`/core/azure/lookup-user/?email=${encodeURIComponent(email)}`);
  },

  getAzureStatus: (): Promise<{ client_id: string; tenant_id: string; is_configured: boolean; has_client_secret: boolean; redirect_uri: string }> => {
    return request<{ client_id: string; tenant_id: string; is_configured: boolean; has_client_secret: boolean; redirect_uri: string }>("/core/azure/status/");
  },

  // Grupo de Permissões (RBAC)
  getGruposPermissao: async (): Promise<GrupoPermissao[]> => {
    const res = await request<GrupoPermissao[] | { results: GrupoPermissao[] }>("/core/grupos-permissao/");
    return Array.isArray(res) ? res : res.results;
  },

  createGrupoPermissao: (data: Partial<GrupoPermissao>): Promise<GrupoPermissao> => {
    return request<GrupoPermissao>("/core/grupos-permissao/", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  updateGrupoPermissao: (id: string, data: Partial<GrupoPermissao>): Promise<GrupoPermissao> => {
    return request<GrupoPermissao>(`/core/grupos-permissao/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  deleteGrupoPermissao: (id: string): Promise<void> => {
    return request<void>(`/core/grupos-permissao/${id}/`, {
      method: "DELETE",
    });
  },

  cloneGrupoPermissao: (id: string): Promise<GrupoPermissao> => {
    return request<GrupoPermissao>(`/core/grupos-permissao/${id}/clonar/`, {
      method: "POST",
    });
  },

  getModulosDisponiveis: (): Promise<{ codigo: string; nome: string }[]> => {
    return request<{ codigo: string; nome: string }[]>("/core/grupos-permissao/modulos_disponiveis/");
  },

  toggleUserActive: async (id: number): Promise<{ message: string; is_active: boolean; profile_ativo: boolean }> => {
    return request<{ message: string; is_active: boolean; profile_ativo: boolean }>(`/core/users/${id}/toggle_ativo/`, {
      method: "POST",
    });
  },

  // Health
  checkHealth: () => request<{ status: string }>("/health/"),

  // Cockpit Resumo
  getCockpitSummary: () => request<CockpitSummary>("/operations/cockpit-resumo/"),

  // Fazendas
  getFarms: () =>
    request<Farm[] | { results: Farm[] }>("/pivots/fazendas/").then((res) => (Array.isArray(res) ? res : res.results)),

  getFarm: (id: string) => request<Farm>(`/pivots/fazendas/${id}/`),

  createFarm: (data: Partial<Farm>) =>
    request<Farm>("/pivots/fazendas/", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateFarm: (id: string, data: Partial<Farm>) =>
    request<Farm>(`/pivots/fazendas/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteFarm: (id: string) =>
    request<void>(`/pivots/fazendas/${id}/`, {
      method: "DELETE",
    }),

  // Pivôs
  getPivots: (filters?: { fazenda?: string; status?: string }) => {
    const query = new URLSearchParams();
    if (filters?.fazenda) query.set("fazenda", filters.fazenda);
    if (filters?.status) query.set("status", filters.status);
    const qs = query.toString() ? `?${query.toString()}` : "";
    return request<Pivot[] | { results: Pivot[] }>(`/pivots/pivos/${qs}`).then((res) =>
      Array.isArray(res) ? res : res.results
    );
  },

  getPivot: (id: string) => request<Pivot>(`/pivots/pivos/${id}/`),

  createPivot: (data: Partial<Pivot>) =>
    request<Pivot>("/pivots/pivos/", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updatePivot: (id: string, data: Partial<Pivot>) =>
    request<Pivot>(`/pivots/pivos/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  quickCommand: (id: string, data: { status_operacional?: PivotStatus; percentimetro_atual?: number; sentido_rotacao?: PivotDirection; lamina_atual_mm?: number }) =>
    request<Pivot>(`/pivots/pivos/${id}/comando-rapido/`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Irrigação & Operações
  getIrrigations: () =>
    request<IrrigationRecord[] | { results: IrrigationRecord[] }>("/operations/irrigacoes/").then((res) =>
      Array.isArray(res) ? res : res.results
    ),

  createIrrigation: (data: Partial<IrrigationRecord>) =>
    request<IrrigationRecord>("/operations/irrigacoes/", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Alertas
  getAlerts: () =>
    request<AlertItem[] | { results: AlertItem[] }>("/operations/alertas/").then((res) =>
      Array.isArray(res) ? res : res.results
    ),

  acknowledgeAlert: (id: string) =>
    request<AlertItem>(`/operations/alertas/${id}/reconhecer/`, { method: "POST" }),

  // Janelas de Oportunidade
  getWindows: () =>
    request<OpportunityWindow[] | { results: OpportunityWindow[] }>("/operations/janelas/").then((res) =>
      Array.isArray(res) ? res : res.results
    ),

  // --- ESTRUTURA AGRÍCOLA (EMPRESAS & TALHÕES) ---
  getCompanies: () =>
    request<Company[] | { results: Company[] }>("/pivots/empresas/").then((res) =>
      Array.isArray(res) ? res : res.results
    ),

  createCompany: (data: Partial<Company>) =>
    request<Company>("/pivots/empresas/", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getFields: (filters?: { fazenda?: string }) => {
    const query = new URLSearchParams();
    if (filters?.fazenda) query.set("fazenda", filters.fazenda);
    const qs = query.toString() ? `?${query.toString()}` : "";
    return request<Field[] | { results: Field[] }>(`/pivots/talhoes/${qs}`).then((res) =>
      Array.isArray(res) ? res : res.results
    );
  },

  createField: (data: Partial<Field>) =>
    request<Field>("/pivots/talhoes/", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateField: (id: string, data: Partial<Field>) =>
    request<Field>(`/pivots/talhoes/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteField: (id: string) =>
    request<{ detail?: string }>(`/pivots/talhoes/${id}/`, {
      method: "DELETE",
    }),

  getCrops: (filters?: { search?: string | undefined; fazenda?: string | undefined }) => {
    const query = new URLSearchParams();
    if (filters?.search) query.set("search", filters.search);
    if (filters?.fazenda) query.set("fazenda", filters.fazenda);
    const qs = query.toString() ? `?${query.toString()}` : "";
    return request<Crop[] | { results: Crop[] }>(`/operations/culturas/${qs}`).then((res) =>
      Array.isArray(res) ? res : res.results
    );
  },

  getCrop: (id: string) => request<Crop>(`/operations/culturas/${id}/`),

  createCrop: (data: Partial<Crop>) =>
    request<Crop>("/operations/culturas/", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateCrop: (id: string, data: Partial<Crop>) =>
    request<Crop>(`/operations/culturas/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteCrop: (id: string) =>
    request<{ detail?: string }>(`/operations/culturas/${id}/`, {
      method: "DELETE",
    }),

  // --- SAFRAS & CICLOS ---
  getSeasons: (filters?: { search?: string | undefined; ativa?: boolean | undefined; fazenda?: string | undefined; status?: string | undefined }) => {
    const query = new URLSearchParams();
    if (filters?.search) query.set("search", filters.search);
    if (filters?.ativa !== undefined) query.set("ativa", String(filters.ativa));
    if (filters?.fazenda) query.set("fazenda", filters.fazenda);
    if (filters?.status) query.set("status", filters.status);
    const qs = query.toString() ? `?${query.toString()}` : "";
    return request<Season[] | { results: Season[] }>(`/operations/safras/${qs}`).then((res) =>
      Array.isArray(res) ? res : res.results
    );
  },

  getSeason: (id: string) => request<Season>(`/operations/safras/${id}/`),

  createSeason: (data: Partial<Season>) =>
    request<Season>("/operations/safras/", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateSeason: (id: string, data: Partial<Season>) =>
    request<Season>(`/operations/safras/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteSeason: (id: string) =>
    request<{ detail?: string }>(`/operations/safras/${id}/`, {
      method: "DELETE",
    }),

  // --- PLANOS DE CULTIVO (PLANEJAMENTO AGRÍCOLA) ---
  getPlans: (filters?: {
    safra?: string | undefined;
    fazenda?: string | undefined;
    cultura?: string | undefined;
    status?: string | undefined;
    pivo?: string | undefined;
    talhao?: string | undefined;
    search?: string | undefined;
    ordering?: string | undefined;
    page?: number | undefined;
  }) => {
    const query = new URLSearchParams();
    if (filters?.safra) query.set("safra", filters.safra);
    if (filters?.fazenda) query.set("fazenda", filters.fazenda);
    if (filters?.cultura) query.set("cultura", filters.cultura);
    if (filters?.status) query.set("status", filters.status);
    if (filters?.pivo) query.set("pivo", filters.pivo);
    if (filters?.talhao) query.set("talhao", filters.talhao);
    if (filters?.search) query.set("search", filters.search);
    if (filters?.ordering) query.set("ordering", filters.ordering);
    if (filters?.page) query.set("page", String(filters.page));
    const qs = query.toString() ? `?${query.toString()}` : "";
    return request<CropPlan[] | { results: CropPlan[]; count?: number }>(`/operations/planos/${qs}`).then((res) =>
      Array.isArray(res) ? { results: res, count: res.length } : res
    );
  },

  getPlan: (id: string) => request<CropPlan>(`/operations/planos/${id}/`),

  createPlan: (data: Partial<CropPlan>) =>
    request<CropPlan>("/operations/planos/", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updatePlan: (id: string, data: Partial<CropPlan>) =>
    request<CropPlan>(`/operations/planos/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deletePlan: (id: string) =>
    request<{ detail?: string }>(`/operations/planos/${id}/`, {
      method: "DELETE",
    }),

  transitionPlanStatus: (id: string, status: CropPlanStatus, motivo?: string) =>
    request<CropPlan>(`/operations/planos/${id}/transicionar-status/`, {
      method: "POST",
      body: JSON.stringify({ status, motivo }),
    }),

  getPlanCalendar: (filters?: {
    ano?: number | undefined;
    safra?: string | undefined;
    fazenda?: string | undefined;
    cultura?: string | undefined;
    status?: string | undefined;
    pivo?: string | undefined;
  }) => {
    const query = new URLSearchParams();
    if (filters?.ano) query.set("ano", String(filters.ano));
    if (filters?.safra) query.set("safra", filters.safra);
    if (filters?.fazenda) query.set("fazenda", filters.fazenda);
    if (filters?.cultura) query.set("cultura", filters.cultura);
    if (filters?.status) query.set("status", filters.status);
    if (filters?.pivo) query.set("pivo", filters.pivo);
    const qs = query.toString() ? `?${query.toString()}` : "";
    return request<PlanCalendarResponse>(`/operations/planos/calendario/${qs}`);
  },

  getPlanIndicators: (filters?: { safra?: string | undefined; fazenda?: string | undefined }) => {
    const query = new URLSearchParams();
    if (filters?.safra) query.set("safra", filters.safra);
    if (filters?.fazenda) query.set("fazenda", filters.fazenda);
    const qs = query.toString() ? `?${query.toString()}` : "";
    return request<PlanningIndicators>(`/operations/planos/indicadores/${qs}`);
  },

  getPlanAudit: (id: string) =>
    request<{ results: PlanAuditItem[]; total: number }>(`/operations/planos/${id}/historico-auditoria/`),

  // --- JANELAS DE OPORTUNIDADE AGRÍCOLA ---
  getOpportunities: (filters?: {
    empresa?: string | undefined;
    fazenda?: string | undefined;
    talhao?: string | undefined;
    pivo?: string | undefined;
    cultura?: string | undefined;
    safra?: string | undefined;
    plano?: string | undefined;
    status?: string | undefined;
    prioridade?: string | undefined;
    tipo?: string | undefined;
    origem?: string | undefined;
    search?: string | undefined;
    ordering?: string | undefined;
    page?: number | undefined;
    vencidas?: boolean | undefined;
  }) => {
    const query = new URLSearchParams();
    if (filters?.empresa) query.set("empresa", filters.empresa);
    if (filters?.fazenda) query.set("fazenda", filters.fazenda);
    if (filters?.talhao) query.set("talhao", filters.talhao);
    if (filters?.pivo) query.set("pivo", filters.pivo);
    if (filters?.cultura) query.set("cultura", filters.cultura);
    if (filters?.safra) query.set("safra", filters.safra);
    if (filters?.plano) query.set("plano", filters.plano);
    if (filters?.status) query.set("status", filters.status);
    if (filters?.prioridade) query.set("prioridade", filters.prioridade);
    if (filters?.tipo) query.set("tipo", filters.tipo);
    if (filters?.origem) query.set("origem", filters.origem);
    if (filters?.search) query.set("search", filters.search);
    if (filters?.ordering) query.set("ordering", filters.ordering);
    if (filters?.page) query.set("page", String(filters.page));
    if (filters?.vencidas !== undefined) query.set("vencidas", String(filters.vencidas));
    const qs = query.toString() ? `?${query.toString()}` : "";
    return request<Opportunity[] | { results: Opportunity[]; count?: number }>(`/operations/oportunidades/${qs}`).then((res) =>
      Array.isArray(res) ? { results: res, count: res.length } : res
    );
  },

  getOpportunity: (id: string) => request<Opportunity>(`/operations/oportunidades/${id}/`),

  createOpportunity: (data: Partial<Opportunity>) =>
    request<Opportunity>("/operations/oportunidades/", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateOpportunity: (id: string, data: Partial<Opportunity>) =>
    request<Opportunity>(`/operations/oportunidades/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteOpportunity: (id: string) =>
    request<{ detail?: string }>(`/operations/oportunidades/${id}/`, {
      method: "DELETE",
    }),

  recognizeOpportunity: (id: string) =>
    request<Opportunity>(`/operations/oportunidades/${id}/reconhecer/`, {
      method: "POST",
    }),

  resolveOpportunity: (id: string, justificativa?: string) =>
    request<Opportunity>(`/operations/oportunidades/${id}/resolver/`, {
      method: "POST",
      body: JSON.stringify({ justificativa }),
    }),

  discardOpportunity: (id: string, motivo: string) =>
    request<Opportunity>(`/operations/oportunidades/${id}/descartar/`, {
      method: "POST",
      body: JSON.stringify({ motivo }),
    }),

  evaluateOpportunityRules: (fazendaId?: string) =>
    request<{ detail: string; novas_oportunidades_count: number; total_avaliadas: number }>(
      "/operations/oportunidades/avaliar-regras/",
      {
        method: "POST",
        body: JSON.stringify({ fazenda: fazendaId }),
      }
    ),

  getOpportunityIndicators: (filters?: { fazenda?: string | undefined }) => {
    const query = new URLSearchParams();
    if (filters?.fazenda) query.set("fazenda", filters.fazenda);
    const qs = query.toString() ? `?${query.toString()}` : "";
    return request<OpportunityIndicators>(`/operations/oportunidades/indicadores/${qs}`);
  },

  getOpportunityAudit: (id: string) =>
    request<{ results: OpportunityAuditItem[]; total: number }>(
      `/operations/oportunidades/${id}/historico-auditoria/`
    ),
};
