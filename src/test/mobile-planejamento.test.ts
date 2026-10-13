import { describe, expect, it, beforeEach, vi } from "vitest";
import { localDb } from "../../Mobile/src/database/sqlite";
import { syncManager } from "../../Mobile/src/services/syncManager";
import { mobileApi } from "../../Mobile/src/services/api";
import type { MobileCropPlan, PendingSyncItem } from "../../Mobile/src/types";

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

describe("Mobile Planning & Offline Conflict Resolution Store", () => {
  const samplePlan: MobileCropPlan = {
    id: "plan-test-1",
    safra: "safra-2026-1",
    safra_nome: "Safra Verão 2026",
    cultura: "cultura-soja",
    cultura_nome: "Soja",
    fazenda: "faz-1",
    fazenda_nome: "Fazenda Santa Maria",
    talhao: "talhao-1",
    talhao_nome: "Talhão 01 - Norte",
    pivo: null,
    alvo_nome: "Talhão: Talhão 01 - Norte",
    data_plantio: "2026-10-15",
    data_colheita_prevista: "2027-02-15",
    area_planejada_ha: 85.5,
    status: "PLANEJADO",
    status_display: "Planejado",
    observacoes: "Planejamento inicial para safra verão",
  };

  beforeEach(async () => {
    await localDb.clearQueue();
    await localDb.savePlans([samplePlan]);
    vi.restoreAllMocks();
  });

  it("saves plans locally and retrieves them", async () => {
    const plans = await localDb.getPlans();
    expect(plans.length).toBeGreaterThanOrEqual(1);

    const found = await localDb.getPlanById("plan-test-1");
    expect(found).toBeDefined();
    expect(found?.cultura_nome).toBe("Soja");
    expect(found?.area_planejada_ha).toBe(85.5);
  });

  it("updates plan status locally and enqueues outbox operation with unique client_op_id", async () => {
    const updated = await localDb.updateLocalPlanStatus(
      "plan-test-1",
      "EM_ANDAMENTO",
      "Início do plantio registrado pelo operador em campo"
    );

    expect(updated).toBeDefined();
    expect(updated?.status).toBe("EM_ANDAMENTO");
    expect(updated?.status_display).toBe("Em Andamento");

    const queue = await localDb.getPendingQueue();
    const planOp = queue.find((item) => item.entity === "plano" && item.payload.includes("plan-test-1"));
    expect(planOp).toBeDefined();
    expect(planOp?.client_op_id).toMatch(/^op-\d+/);
    expect(planOp?.action).toBe("UPDATE_STATUS");

    const payload = JSON.parse(planOp!.payload);
    expect(payload.status).toBe("EM_ANDAMENTO");
    expect(payload.expected_status).toBe("PLANEJADO");
  });

  it("distinguishes SUCCESS, CONFLICT and REJECTED states in the sync queue", async () => {
    // 1. Enfileira 3 operações
    const op1 = await localDb.enqueueOperation("plano", "UPDATE_STATUS", {
      id: "plan-test-1",
      status: "EM_ANDAMENTO",
    });
    const op2 = await localDb.enqueueOperation("plano", "UPDATE_STATUS", {
      id: "plan-test-2",
      status: "CONCLUIDO",
    });
    const op3 = await localDb.enqueueOperation("registro_irrigacao", "CREATE", {
      pivo: "pivo-1",
      lamina_aplicada_mm: 12.5,
    });

    // 2. Aplica transições de resposta do servidor
    await localDb.markProcessed(op3.client_op_id); // SUCCESS -> removido da fila
    await localDb.markConflict(
      op1.client_op_id,
      "Conflito de versão: o plano foi cancelado no portal web antes desta sincronização.",
      "plan-test-1"
    );
    await localDb.markRejected(
      op2.client_op_id,
      "Transição inválida: plano não pode ir de RASCUNHO diretamente para CONCLUIDO.",
      "plan-test-2"
    );

    // 3. Verifica fila total (getAllQueue)
    const allQueue = await localDb.getAllQueue();
    expect(allQueue.length).toBe(2);

    const conflictItem = allQueue.find((i) => i.client_op_id === op1.client_op_id);
    expect(conflictItem?.status).toBe("CONFLICT");
    expect(conflictItem?.error_message).toContain("Conflito de versão");
    expect(conflictItem?.server_entity_id).toBe("plan-test-1");
    expect(conflictItem?.last_attempt_at).toBeDefined();

    const rejectedItem = allQueue.find((i) => i.client_op_id === op2.client_op_id);
    expect(rejectedItem?.status).toBe("REJECTED");
    expect(rejectedItem?.error_message).toContain("Transição inválida");

    // 4. Verifica getPendingQueue(): NÃO deve incluir operações em CONFLICT ou REJECTED
    // Evita reenvio automático em segundo plano
    const pendingQueue = await localDb.getPendingQueue();
    expect(pendingQueue.find((i) => i.client_op_id === op1.client_op_id)).toBeUndefined();
    expect(pendingQueue.find((i) => i.client_op_id === op2.client_op_id)).toBeUndefined();

    // 5. Verifica getConflictQueue() e getConflictCount()
    const conflicts = await localDb.getConflictQueue();
    expect(conflicts.length).toBe(1);
    expect(conflicts[0]!.client_op_id).toBe(op1.client_op_id);
    expect(await localDb.getConflictCount()).toBe(1);
  });

  it("selectively discards ONLY the specified conflicting operation and preserves other operations", async () => {
    // Registra plano e mutação
    await localDb.updateLocalPlanStatus(
      "plan-test-1",
      "EM_ANDAMENTO",
      "Operação conflitante que será descartada"
    );
    const allOps = await localDb.getAllQueue();
    const planOp = allOps[0]!;
    await localDb.markConflict(planOp.client_op_id, "Status alterado no portal");

    // Enfileira segunda operação legítima de irrigação
    const irrigationOp = await localDb.enqueueOperation("registro_irrigacao", "CREATE", {
      pivo: "pivo-alpha",
      lamina_aplicada_mm: 15,
    });

    const beforeAll = await localDb.getAllQueue();
    expect(beforeAll.length).toBe(2);

    // Executa descarte explícito da operação de plano
    const discarded = await localDb.discardOperation(planOp.client_op_id, true);
    expect(discarded).toBeDefined();
    expect(discarded?.client_op_id).toBe(planOp.client_op_id);

    // A fila deve conter agora SOMENTE a operação de irrigação
    const afterAll = await localDb.getAllQueue();
    expect(afterAll.length).toBe(1);
    expect(afterAll[0]!.client_op_id).toBe(irrigationOp.client_op_id);

    // O plano local deve ser revertido para o expected_status seguro ("PLANEJADO")
    const revertedPlan = await localDb.getPlanById("plan-test-1");
    expect(revertedPlan?.status).toBe("PLANEJADO");
    expect(revertedPlan?.status_display).toBe("Planejado");
  });

  it("updates local database from server catalog when resolving conflict without re-sending old mutation", async () => {
    // Simula plano em conflito no dispositivo móvel
    const op = await localDb.enqueueOperation("plano", "UPDATE_STATUS", {
      id: "plan-test-1",
      status: "EM_ANDAMENTO",
      expected_status: "PLANEJADO",
    });
    await localDb.markConflict(op.client_op_id, "O plano já foi cancelado pela matriz.");

    // Mock das APIs do servidor (servidor online com plano oficial cancelado)
    vi.spyOn(mobileApi, "checkHealth").mockResolvedValue({ status: "healthy" });
    vi.spyOn(mobileApi, "pullCatalog").mockResolvedValue({
      planos: [
        {
          ...samplePlan,
          status: "CANCELADO",
          status_display: "Cancelado",
          observacoes: "Cancelado via Portal Central devido à estiagem",
        },
      ],
      pivos: [],
      talhoes: [],
      fazendas: [],
      culturas: [],
      safras: [],
    });

    // Operador aciona "Atualizar do Servidor"
    const result = await syncManager.resolveConflictWithServer(op.client_op_id);
    expect(result.success).toBe(true);
    expect(result.plan?.status).toBe("CANCELADO");

    // Verifica que o plano local foi atualizado para a versão oficial do servidor
    const updatedLocalPlan = await localDb.getPlanById("plan-test-1");
    expect(updatedLocalPlan?.status).toBe("CANCELADO");
    expect(updatedLocalPlan?.status_display).toBe("Cancelado");

    // Verifica que a anotação de estado oficial foi registrada no item da fila
    const item = (await localDb.getAllQueue()).find((i) => i.client_op_id === op.client_op_id);
    expect(item?.server_state_info).toContain("Cancelado");

    // Verifica que nenhuma nova operação espúria foi colocada na fila de envio
    const pending = await localDb.getPendingQueue();
    expect(pending.length).toBe(0);
  });

  it("reports safe error message when trying to pull server updates while offline", async () => {
    const op = await localDb.enqueueOperation("plano", "UPDATE_STATUS", {
      id: "plan-test-1",
      status: "EM_ANDAMENTO",
    });
    await localDb.markConflict(op.client_op_id, "Erro prévio");

    // Servidor offline
    vi.spyOn(mobileApi, "checkHealth").mockRejectedValue(new Error("Network offline"));

    const result = await syncManager.resolveConflictWithServer(op.client_op_id);
    expect(result.success).toBe(false);
    expect(result.message).toContain("Sem conexão com o servidor");
    expect(result.message).toContain("reconexão com a rede");

    // Fila e conflito devem permanecer intactos para resolução posterior
    const conflictItems = await localDb.getConflictQueue();
    expect(conflictItems.length).toBe(1);
  });

  it("prevents false sync completion when server responds with CONFLICT or REJECTED in batch", async () => {
    await localDb.enqueueOperation("plano", "UPDATE_STATUS", {
      id: "plan-test-1",
      status: "EM_ANDAMENTO",
    });

    // Mock do servidor retornando CONFLICT na resposta do pushBatch
    const pendingOps = await localDb.getPendingQueue();
    const firstPending = pendingOps[0]!;
    vi.spyOn(mobileApi, "pushBatch").mockResolvedValue({
      results: [
        {
          client_op_id: firstPending.client_op_id,
          status: "CONFLICT",
          message: "Conflito de concorrência: o registro foi alterado em outro dispositivo.",
          server_id: "plan-test-1",
        },
      ],
    });
    vi.spyOn(mobileApi, "pullCatalog").mockResolvedValue({
      planos: [samplePlan],
      pivos: [],
      talhoes: [],
      fazendas: [],
      culturas: [],
      safras: [],
    });

    const syncResult = await syncManager.syncAll();

    // Sincronização NÃO deve ser reportada como bem-sucedida!
    expect(syncResult.success).toBe(false);
    expect(syncResult.conflictCount).toBe(1);
    expect(syncResult.pushedCount).toBe(0); // Apenas SUCCESS conta como pushed concluído
    expect(syncResult.message).toContain("conflito requerem atenção");

    // Operação deve ter sido reclassificada como CONFLICT na fila
    const conflictQueue = await localDb.getConflictQueue();
    expect(conflictQueue.length).toBe(1);
    expect(conflictQueue[0]!.status).toBe("CONFLICT");
    expect(conflictQueue[0]!.error_message).toContain("Conflito de concorrência");
  });
});
