import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  setAuthToken,
  getAuthToken,
  setStoredUser,
  getStoredUser,
  api,
  type UserData,
} from "@/services/api";

describe("Frontend Auth & Session Management", () => {
  beforeEach(() => {
    localStorage.clear();
    setAuthToken(null);
    setStoredUser(null);
    vi.restoreAllMocks();
  });

  it("stores and retrieves auth token correctly in localStorage", () => {
    expect(getAuthToken()).toBeNull();

    setAuthToken("test-drf-token-12345");
    expect(getAuthToken()).toBe("test-drf-token-12345");
    expect(localStorage.getItem("cockpit_auth_token")).toBe("test-drf-token-12345");

    setAuthToken(null);
    expect(getAuthToken()).toBeNull();
    expect(localStorage.getItem("cockpit_auth_token")).toBeNull();
  });

  it("persists and clears user profile data with role", () => {
    const mockUser: UserData = {
      id: 1,
      username: "hiago",
      email: "hiago@agro.com",
      first_name: "Hiago",
      last_name: "Admin",
      is_active: true,
      profile: {
        role: "ADMIN",
        role_display: "Administrador do Sistema",
        empresa_nome: "Holding",
        cargo: "Diretor",
        telefone: "",
        ativo: true,
        fazendas: ["faz-1"],
      },
    };

    setStoredUser(mockUser);
    expect(getStoredUser()).toEqual(mockUser);
    expect(localStorage.getItem("cockpit_authenticated")).toBe("true");

    setStoredUser(null);
    expect(getStoredUser()).toBeNull();
    expect(localStorage.getItem("cockpit_authenticated")).toBeNull();
  });

  it("handles login flow and persists token and user on success", async () => {
    const fakeResponse = {
      token: "secret-token-token-abc",
      user: {
        id: 42,
        username: "operador_teste",
        email: "op@cockpit.com",
        first_name: "Operador",
        last_name: "Campo",
        is_active: true,
        profile: {
          role: "OPERADOR" as const,
          role_display: "Operador de Campo",
          empresa_nome: "Fazenda Santa Fé",
          cargo: "Operador",
          telefone: "",
          ativo: true,
          fazendas: [],
        },
      },
      message: "Sucesso",
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => fakeResponse,
    } as Response);

    const res = await api.login("operador_teste", "CorrectPassword123!");
    expect(res.token).toBe("secret-token-token-abc");
    expect(getAuthToken()).toBe("secret-token-token-abc");
    expect(getStoredUser()?.username).toBe("operador_teste");
  });

  it("clears session tokens and flags on logout", async () => {
    setAuthToken("active-session-token");
    setStoredUser({
      id: 10,
      username: "gestor",
      email: "gestor@agro.com",
      first_name: "Gestor",
      last_name: "Agro",
      is_active: true,
      profile: {
        role: "GESTOR",
        role_display: "Gestor",
        empresa_nome: "Agro",
        cargo: "Gerente",
        telefone: "",
        ativo: true,
        fazendas: [],
      },
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ detail: "Logout concluído." }),
    } as Response);

    await api.logout();

    expect(getAuthToken()).toBeNull();
    expect(getStoredUser()).toBeNull();
    expect(localStorage.getItem("cockpit_auth_token")).toBeNull();
    expect(localStorage.getItem("cockpit_authenticated")).toBeNull();
  });
});
