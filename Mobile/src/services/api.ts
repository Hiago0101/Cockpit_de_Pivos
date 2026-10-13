/**
 * Cliente HTTP mobile para a API Central do Cockpit de Pivôs.
 * Suporta autenticação segura via Token, gerenciamento de sessão,
 * detecção de 401 e revogação de credenciais.
 * Tokens NUNCA são registrados nos logs do console.
 */
import { secureStorage } from "./storage";
import { MobileFarm, MobileField } from "../types";

let apiBaseUrl = (typeof process !== "undefined" && process.env?.["EXPO_PUBLIC_API_URL"])
  ? process.env["EXPO_PUBLIC_API_URL"]
  : "http://127.0.0.1:8000/api/v1";

let mobileAuthToken: string | null = null;
let onUnauthorizedCallback: (() => void) | null = null;

export const setOnUnauthorized = (callback: () => void) => {
  onUnauthorizedCallback = callback;
};

export const setApiUrl = async (url: string) => {
  apiBaseUrl = url.trim().replace(/\/+$/, "");
  await secureStorage.saveApiUrl(apiBaseUrl);
};

export const getApiUrl = () => apiBaseUrl;

export const setMobileAuthToken = (token: string | null) => {
  mobileAuthToken = token;
};

export const getMobileAuthToken = () => mobileAuthToken;

const getHeaders = (extra: Record<string, string> = {}) => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...extra,
  };
  if (mobileAuthToken) {
    headers["Authorization"] = `Token ${mobileAuthToken}`;
  }
  return headers;
};

const handleUnauthorized = async () => {
  mobileAuthToken = null;
  await secureStorage.clearSession();
  if (onUnauthorizedCallback) {
    onUnauthorizedCallback();
  }
};

export const mobileApi = {
  // Inicialização de sessão persistida
  initSession: async (): Promise<{ token: string | null; user: any | null }> => {
    const savedUrl = await secureStorage.getApiUrl();
    if (savedUrl) {
      apiBaseUrl = savedUrl;
    }
    const token = await secureStorage.getAuthToken();
    const user = await secureStorage.getUserProfile();
    if (token) {
      mobileAuthToken = token;
    }
    return { token, user };
  },

  checkHealth: async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/health/`, { method: "GET" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err: any) {
      throw new Error(`Servidor inacessível em ${apiBaseUrl}`);
    }
  },

  login: async (username: string, password: string) => {
    let res: Response;
    try {
      res = await fetch(`${apiBaseUrl}/core/auth/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
    } catch {
      throw new Error(`Não foi possível conectar ao servidor em ${apiBaseUrl}. Verifique o Wi-Fi ou conexão.`);
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const message = err.detail || err.message || `Erro HTTP ${res.status}`;
      throw new Error(message);
    }

    const data = await res.json();
    mobileAuthToken = data.token;
    await secureStorage.saveAuthToken(data.token);
    if (data.user) {
      await secureStorage.saveUserProfile(data.user);
    }
    return data;
  },

  getMe: async () => {
    const res = await fetch(`${apiBaseUrl}/core/auth/me/`, {
      method: "GET",
      headers: getHeaders(),
    });
    if (!res.ok) {
      if (res.status === 401) {
        await handleUnauthorized();
        throw new Error("Sessão mobile expirada ou inválida.");
      }
      throw new Error(`HTTP ${res.status}`);
    }
    const user = await res.json();
    await secureStorage.saveUserProfile(user);
    return user;
  },

  logout: async () => {
    try {
      await fetch(`${apiBaseUrl}/core/auth/logout/`, {
        method: "POST",
        headers: getHeaders(),
      });
    } catch {
      // Ignora erro de rede em logout
    } finally {
      await handleUnauthorized();
    }
  },

  pullCatalog: async () => {
    let res: Response;
    try {
      res = await fetch(`${apiBaseUrl}/sync/pull/`, {
        method: "GET",
        headers: getHeaders(),
      });
    } catch {
      throw new Error(`Servidor inacessível para sincronização.`);
    }

    if (!res.ok) {
      if (res.status === 401) {
        await handleUnauthorized();
        throw new Error("Sessão mobile não autenticada.");
      }
      throw new Error(`HTTP ${res.status}`);
    }
    return res.json();
  },

  pushBatch: async (operations: Array<{ client_op_id: string; entity: string; action: string; occurred_at: string; payload: any }>) => {
    let res: Response;
    try {
      res = await fetch(`${apiBaseUrl}/sync/push/`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          client_device_id: "EXPO-MOBILE-FIELD",
          batch_timestamp: new Date().toISOString(),
          operations,
        }),
      });
    } catch {
      throw new Error(`Servidor inacessível para envio de lote.`);
    }

    if (!res.ok) {
      if (res.status === 401) {
        await handleUnauthorized();
        throw new Error("Sessão mobile não autenticada.");
      }
      throw new Error(`HTTP ${res.status}`);
    }
    return res.json();
  },

  quickCommand: async (pivotId: string, payload: { status_operacional?: string; percentimetro_atual?: number; sentido_rotacao?: string }) => {
    let res: Response;
    try {
      res = await fetch(`${apiBaseUrl}/pivots/pivos/${pivotId}/comando-rapido/`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });
    } catch {
      throw new Error(`Servidor inacessível para comando.`);
    }

    if (!res.ok) {
      if (res.status === 401) {
        await handleUnauthorized();
        throw new Error("Sessão mobile não autenticada.");
      }
      throw new Error(`HTTP ${res.status}`);
    }
    return res.json();
  },

  // --- FAZENDAS ---
  getFarms: async (): Promise<MobileFarm[]> => {
    let res: Response;
    try {
      res = await fetch(`${apiBaseUrl}/pivots/fazendas/`, {
        method: "GET",
        headers: getHeaders(),
      });
    } catch {
      throw new Error(`Não foi possível conectar ao servidor em ${apiBaseUrl}.`);
    }

    if (!res.ok) {
      if (res.status === 401) {
        await handleUnauthorized();
        throw new Error("Sessão mobile não autenticada.");
      }
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.message || `Erro HTTP ${res.status}`);
    }
    const data = await res.json();
    return Array.isArray(data) ? data : data.results || [];
  },

  createFarm: async (data: Partial<MobileFarm>): Promise<MobileFarm> => {
    let res: Response;
    try {
      res = await fetch(`${apiBaseUrl}/pivots/fazendas/`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(data),
      });
    } catch {
      throw new Error(`Não foi possível conectar ao servidor em ${apiBaseUrl}.`);
    }

    if (!res.ok) {
      if (res.status === 401) {
        await handleUnauthorized();
        throw new Error("Sessão mobile não autenticada.");
      }
      const err = await res.json().catch(() => ({}));
      const msg = err.detail || err.message || (typeof err === "object" ? Object.values(err).flat().join(" ") : "") || `Erro HTTP ${res.status}`;
      throw new Error(msg);
    }
    return res.json();
  },

  updateFarm: async (id: string, data: Partial<MobileFarm>): Promise<MobileFarm> => {
    let res: Response;
    try {
      res = await fetch(`${apiBaseUrl}/pivots/fazendas/${id}/`, {
        method: "PATCH",
        headers: getHeaders(),
        body: JSON.stringify(data),
      });
    } catch {
      throw new Error(`Não foi possível conectar ao servidor em ${apiBaseUrl}.`);
    }

    if (!res.ok) {
      if (res.status === 401) {
        await handleUnauthorized();
        throw new Error("Sessão mobile não autenticada.");
      }
      const err = await res.json().catch(() => ({}));
      const msg = err.detail || err.message || (typeof err === "object" ? Object.values(err).flat().join(" ") : "") || `Erro HTTP ${res.status}`;
      throw new Error(msg);
    }
    return res.json();
  },

  deleteFarm: async (id: string): Promise<void> => {
    let res: Response;
    try {
      res = await fetch(`${apiBaseUrl}/pivots/fazendas/${id}/`, {
        method: "DELETE",
        headers: getHeaders(),
      });
    } catch {
      throw new Error(`Não foi possível conectar ao servidor em ${apiBaseUrl}.`);
    }

    if (!res.ok) {
      if (res.status === 401) {
        await handleUnauthorized();
        throw new Error("Sessão mobile não autenticada.");
      }
      const err = await res.json().catch(() => ({}));
      const msg = err.detail || err.message || (typeof err === "object" ? Object.values(err).flat().join(" ") : "") || `Erro HTTP ${res.status}`;
      throw new Error(msg);
    }
  },

  // --- TALHÕES ---
  getFields: async (filters?: { fazenda?: string }): Promise<MobileField[]> => {
    let res: Response;
    const query = new URLSearchParams();
    if (filters?.fazenda) query.set("fazenda", filters.fazenda);
    const qs = query.toString() ? `?${query.toString()}` : "";

    try {
      res = await fetch(`${apiBaseUrl}/pivots/talhoes/${qs}`, {
        method: "GET",
        headers: getHeaders(),
      });
    } catch {
      throw new Error(`Não foi possível conectar ao servidor em ${apiBaseUrl}.`);
    }

    if (!res.ok) {
      if (res.status === 401) {
        await handleUnauthorized();
        throw new Error("Sessão mobile não autenticada.");
      }
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.message || `Erro HTTP ${res.status}`);
    }
    const data = await res.json();
    return Array.isArray(data) ? data : data.results || [];
  },

  createField: async (data: Partial<MobileField>): Promise<MobileField> => {
    let res: Response;
    try {
      res = await fetch(`${apiBaseUrl}/pivots/talhoes/`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(data),
      });
    } catch {
      throw new Error(`Não foi possível conectar ao servidor em ${apiBaseUrl}.`);
    }

    if (!res.ok) {
      if (res.status === 401) {
        await handleUnauthorized();
        throw new Error("Sessão mobile não autenticada.");
      }
      const err = await res.json().catch(() => ({}));
      const msg = err.detail || err.message || (typeof err === "object" ? Object.values(err).flat().join(" ") : "") || `Erro HTTP ${res.status}`;
      throw new Error(msg);
    }
    return res.json();
  },

  updateField: async (id: string, data: Partial<MobileField>): Promise<MobileField> => {
    let res: Response;
    try {
      res = await fetch(`${apiBaseUrl}/pivots/talhoes/${id}/`, {
        method: "PATCH",
        headers: getHeaders(),
        body: JSON.stringify(data),
      });
    } catch {
      throw new Error(`Não foi possível conectar ao servidor em ${apiBaseUrl}.`);
    }

    if (!res.ok) {
      if (res.status === 401) {
        await handleUnauthorized();
        throw new Error("Sessão mobile não autenticada.");
      }
      const err = await res.json().catch(() => ({}));
      const msg = err.detail || err.message || (typeof err === "object" ? Object.values(err).flat().join(" ") : "") || `Erro HTTP ${res.status}`;
      throw new Error(msg);
    }
    return res.json();
  },

  deleteField: async (id: string): Promise<void> => {
    let res: Response;
    try {
      res = await fetch(`${apiBaseUrl}/pivots/talhoes/${id}/`, {
        method: "DELETE",
        headers: getHeaders(),
      });
    } catch {
      throw new Error(`Não foi possível conectar ao servidor em ${apiBaseUrl}.`);
    }

    if (!res.ok) {
      if (res.status === 401) {
        await handleUnauthorized();
        throw new Error("Sessão mobile não autenticada.");
      }
      const err = await res.json().catch(() => ({}));
      const msg = err.detail || err.message || (typeof err === "object" ? Object.values(err).flat().join(" ") : "") || `Erro HTTP ${res.status}`;
      throw new Error(msg);
    }
  },
};
