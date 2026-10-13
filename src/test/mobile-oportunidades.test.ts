import { describe, expect, it, beforeEach, vi } from "vitest";
import { localDb } from "../../Mobile/src/database/sqlite";
import { syncManager } from "../../Mobile/src/services/syncManager";
import { mobileApi } from "../../Mobile/src/services/api";
import type { MobileOpportunity } from "../../Mobile/src/types";

vi.mock("../../Mobile/src/services/storage", () => ({
  secureStorage: {
    saveAuthToken: vi.fn(),
    getAuthToken: vi.fn().mockResolvedValue("test-token"),
    clearSession: vi.fn(),
    saveUserProfile: vi.fn(),
    getUserProfile: vi.fn().mockResolvedValue(null),
    saveApiUrl: vi.fn(),
    getApiUrl: vi.fn().mockResolvedValue("http://127.0.0.1:8000/api/v1"),
  },
}));

describe("Mobile Offline Opportunities Store & Sync", () => {
  const sampleOpportunity: MobileOpportunity = {
    id: "opp-mob-1",
    titulo: "Tarifa Noturna Econômica Pivô 01",
    descricao: "Janela noturna com tarifa reduzida",
    tipo: "TARIFA_NOTURNA",
    tipo_display: "Tarifa Noturna",
    prioridade: "ALTA",
    status: "DETECTADA",
    origem: "REGRA_INTERNA",
    origem_display: "Regra Interna",
    inicio_janela: "2026-10-15T21:30:00Z",
    fim_janela: "2026-10-16T06:00:00Z",
    fazenda_id: "faz-1",
    fazenda_nome: "Fazenda Santa Maria",
    pivo_id: "pivo-1",
    pivo_codigo: "PIV-01",
    pivo_nome: "Pivô Central 01",
    justificativa: "Enquadramento tarifário verificado",
    is_vencida: false,
  };

  beforeEach(async () => {
    await localDb.saveOpportunities([sampleOpportunity]);
    vi.restoreAllMocks();
  });

  it("stores opportunities locally and retrieves them offline", async () => {
    const opps = await localDb.getOpportunities();
    expect(opps.length).toBeGreaterThanOrEqual(1);

    const found = await localDb.getOpportunityById("opp-mob-1");
    expect(found).toBeDefined();
    expect(found?.titulo).toBe("Tarifa Noturna Econômica Pivô 01");
    expect(found?.prioridade).toBe("ALTA");
    expect(found?.status).toBe("DETECTADA");
  });

  it("pulls opportunities during sync catalog pull and saves to local store", async () => {
    const serverOpportunity: MobileOpportunity = {
      id: "opp-server-99",
      titulo: "Janela de Plantio Recomendada Soja",
      descricao: "Período ideal para semeadura",
      tipo: "JANELA_PLANTIO",
      prioridade: "CRITICA",
      status: "RECONHECIDA",
      origem: "REGRA_INTERNA",
      inicio_janela: "2026-10-20T07:00:00Z",
      fim_janela: "2026-10-25T18:00:00Z",
      fazenda_id: "faz-1",
      fazenda_nome: "Fazenda Santa Maria",
      cultura_id: "cult-1",
      cultura_nome: "Soja",
      is_vencida: false,
    };

    vi.spyOn(localDb, "getPendingQueue").mockResolvedValue([]);
    vi.spyOn(mobileApi, "pullCatalog").mockResolvedValue({
      pivos: [],
      fazendas: [],
      talhoes: [],
      culturas: [],
      safras: [],
      planos: [],
      janelas: [serverOpportunity],
    });

    const syncResult = await syncManager.syncAll();
    expect(syncResult.success).toBe(true);

    const opps = await localDb.getOpportunities();
    const serverOppInDb = opps.find((o) => o.id === "opp-server-99");
    expect(serverOppInDb).toBeDefined();
    expect(serverOppInDb?.titulo).toBe("Janela de Plantio Recomendada Soja");
    expect(serverOppInDb?.status).toBe("RECONHECIDA");
    expect(serverOppInDb?.prioridade).toBe("CRITICA");
  });
});
