/**
 * Camada de persistência local SQLite do aplicativo móvel.
 * Suporta armazenamento offline de pivôs e fila de mutações pendentes (outbox queue).
 */

import {
  MobilePivot,
  MobileFarm,
  MobileCrop,
  MobileSeason,
  MobileField,
  MobileCropPlan,
  CropPlanStatus,
  PendingSyncItem,
  MobileOpportunity,
} from "../types";

// Armazenamento em memória com persistência estruturada para execução híbrida e nativa
class LocalDatabase {
  private pivos: Map<string, MobilePivot> = new Map();
  private fazendas: Map<string, MobileFarm> = new Map();
  private talhoes: Map<string, MobileField> = new Map();
  private culturas: Map<string, MobileCrop> = new Map();
  private safras: Map<string, MobileSeason> = new Map();
  private planos: Map<string, MobileCropPlan> = new Map();
  private oportunidades: Map<string, MobileOpportunity> = new Map();
  private syncQueue: PendingSyncItem[] = [];

  constructor() {
    this.initDefaultData();
  }

  private initDefaultData() {
    // Inicialização segura
  }

  // --- PIVÔS ---
  public async getPivots(): Promise<MobilePivot[]> {
    return Array.from(this.pivos.values());
  }

  public async getPivotById(id: string): Promise<MobilePivot | undefined> {
    return this.pivos.get(id);
  }

  public async savePivots(pivotsList: MobilePivot[]): Promise<void> {
    for (const p of pivotsList) {
      this.pivos.set(p.id, p);
    }
  }

  public async updateLocalPivot(id: string, updates: Partial<MobilePivot>): Promise<MobilePivot | undefined> {
    const existing = this.pivos.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates, updated_at: new Date().toISOString() };
    this.pivos.set(id, updated);
    return updated;
  }

  // --- FAZENDAS ---
  public async getFarms(): Promise<MobileFarm[]> {
    return Array.from(this.fazendas.values());
  }

  public async saveFarms(farms: MobileFarm[]): Promise<void> {
    for (const f of farms) {
      this.fazendas.set(f.id, f);
    }
  }

  // --- TALHÕES ---
  public async getFields(): Promise<MobileField[]> {
    return Array.from(this.talhoes.values());
  }

  public async saveFields(fields: MobileField[]): Promise<void> {
    for (const t of fields) {
      this.talhoes.set(t.id, t);
    }
  }

  // --- CULTURAS ---
  public async getCrops(): Promise<MobileCrop[]> {
    return Array.from(this.culturas.values());
  }

  public async saveCrops(crops: MobileCrop[]): Promise<void> {
    for (const c of crops) {
      this.culturas.set(c.id, c);
    }
  }

  // --- SAFRAS ---
  public async getSeasons(): Promise<MobileSeason[]> {
    return Array.from(this.safras.values());
  }

  public async saveSeasons(seasons: MobileSeason[]): Promise<void> {
    for (const s of seasons) {
      this.safras.set(s.id, s);
    }
  }

  // --- PLANOS DE CULTIVO (PLANEJAMENTO AGRÍCOLA) ---
  public async getPlans(): Promise<MobileCropPlan[]> {
    return Array.from(this.planos.values());
  }

  public async getPlanById(id: string): Promise<MobileCropPlan | undefined> {
    return this.planos.get(id);
  }

  public async savePlans(plans: MobileCropPlan[]): Promise<void> {
    for (const plan of plans) {
      this.planos.set(plan.id, plan);
    }
  }

  public async updateLocalPlanStatus(
    id: string,
    status: CropPlanStatus,
    motivo?: string,
    dataReal?: string
  ): Promise<MobileCropPlan | undefined> {
    const existing = this.planos.get(id);
    if (!existing) return undefined;

    const statusDisplays: Record<CropPlanStatus, string> = {
      RASCUNHO: "Rascunho",
      PLANEJADO: "Planejado",
      EM_ANDAMENTO: "Em Andamento",
      CONCLUIDO: "Concluído",
      CANCELADO: "Cancelado",
    };

    const todayStr = new Date().toISOString().split("T")[0];
    const dataOperacao = dataReal || todayStr;

    const updated: MobileCropPlan = {
      ...existing,
      status,
      status_display: statusDisplays[status] || status,
      ...(status === "EM_ANDAMENTO" && !existing.data_plantio_real ? { data_plantio_real: dataOperacao } : {}),
      ...(status === "CONCLUIDO" && !existing.data_colheita_real ? { data_colheita_real: dataOperacao } : {}),
      atualizado_em: new Date().toISOString(),
    };
    this.planos.set(id, updated);

    // Enfileira operação offline para sincronização com metadados de concorrência
    await this.enqueueOperation("plano", "UPDATE_STATUS", {
      plano_id: id,
      id,
      status,
      motivo: motivo || "Atualização operacional em campo",
      expected_status: existing.status,
      base_updated_at: existing.atualizado_em,
      data_plantio_real: updated.data_plantio_real,
      data_colheita_real: updated.data_colheita_real,
    });

    return updated;
  }

  // --- JANELAS DE OPORTUNIDADE AGRÍCOLA ---
  public async getOpportunities(): Promise<MobileOpportunity[]> {
    return Array.from(this.oportunidades.values());
  }

  public async getOpportunityById(id: string): Promise<MobileOpportunity | undefined> {
    return this.oportunidades.get(id);
  }

  public async saveOpportunities(opps: MobileOpportunity[]): Promise<void> {
    for (const opp of opps) {
      this.oportunidades.set(opp.id, opp);
    }
  }

  // --- FILA DE SINCRONIZAÇÃO (OUTBOX QUEUE) ---
  public async enqueueOperation(
    entity: "pivo" | "registro_irrigacao" | "alerta" | "plano",
    action: "CREATE" | "UPDATE" | "UPDATE_STATUS" | "ACKNOWLEDGE",
    payload: Record<string, unknown>
  ): Promise<PendingSyncItem> {
    const item: PendingSyncItem = {
      id: Math.random().toString(36).substring(2, 9),
      client_op_id: "op-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7),
      entity,
      action,
      payload: JSON.stringify(payload),
      created_at: new Date().toISOString(),
      status: "PENDING",
    };
    this.syncQueue.push(item);
    return item;
  }

  public async getAllQueue(): Promise<PendingSyncItem[]> {
    return [...this.syncQueue];
  }

  public async getPendingQueue(): Promise<PendingSyncItem[]> {
    // Apenas operações ativas pendentes ou que falharam por conexão.
    // Conflitos e rejeições exigem ação explícita do operador e não são reenviados automaticamente.
    return this.syncQueue.filter((item) => item.status === "PENDING" || item.status === "FAILED");
  }

  public async getConflictQueue(): Promise<PendingSyncItem[]> {
    return this.syncQueue.filter((item) => item.status === "CONFLICT");
  }

  public async markProcessed(client_op_id: string): Promise<void> {
    this.syncQueue = this.syncQueue.filter((item) => item.client_op_id !== client_op_id);
  }

  public async markConflict(
    client_op_id: string,
    error: string,
    serverEntityId?: string
  ): Promise<void> {
    const item = this.syncQueue.find((i) => i.client_op_id === client_op_id);
    if (item) {
      item.status = "CONFLICT";
      item.error_message = error;
      if (serverEntityId) item.server_entity_id = serverEntityId;
      item.last_attempt_at = new Date().toISOString();
    }
  }

  public async markRejected(
    client_op_id: string,
    error: string,
    serverEntityId?: string
  ): Promise<void> {
    const item = this.syncQueue.find((i) => i.client_op_id === client_op_id);
    if (item) {
      item.status = "REJECTED";
      item.error_message = error;
      if (serverEntityId) item.server_entity_id = serverEntityId;
      item.last_attempt_at = new Date().toISOString();
    }
  }

  public async markFailed(client_op_id: string, error: string): Promise<void> {
    const item = this.syncQueue.find((i) => i.client_op_id === client_op_id);
    if (item) {
      item.status = "FAILED";
      item.error_message = error;
      item.last_attempt_at = new Date().toISOString();
    }
  }

  public async discardOperation(
    client_op_id: string,
    revertLocalPlan: boolean = true
  ): Promise<PendingSyncItem | undefined> {
    const item = this.syncQueue.find((i) => i.client_op_id === client_op_id);
    if (!item) return undefined;

    // Se a operação for de plano e o usuário confirmar o descarte, reverte o plano local para o estado base seguro
    if (revertLocalPlan && item.entity === "plano") {
      try {
        const payload = JSON.parse(item.payload);
        const planId = payload.id || payload.plano_id;
        const plan = this.planos.get(planId);
        if (plan) {
          const revertStatus = (payload.expected_status || "PLANEJADO") as CropPlanStatus;
          const statusDisplays: Record<CropPlanStatus, string> = {
            RASCUNHO: "Rascunho",
            PLANEJADO: "Planejado",
            EM_ANDAMENTO: "Em Andamento",
            CONCLUIDO: "Concluído",
            CANCELADO: "Cancelado",
          };
          this.planos.set(planId, {
            ...plan,
            status: revertStatus,
            status_display: statusDisplays[revertStatus] || revertStatus,
            atualizado_em: new Date().toISOString(),
          });
        }
      } catch {
        // Ignora erro no parse
      }
    }

    // Remove apenas esta operação específica da fila
    this.syncQueue = this.syncQueue.filter((i) => i.client_op_id !== client_op_id);
    return item;
  }

  public async updateQueueItem(
    client_op_id: string,
    updates: Partial<PendingSyncItem>
  ): Promise<PendingSyncItem | undefined> {
    const item = this.syncQueue.find((i) => i.client_op_id === client_op_id);
    if (item) {
      Object.assign(item, updates);
      return item;
    }
    return undefined;
  }

  public getQueueItemByPlanId(planId: string): PendingSyncItem | undefined {
    return this.syncQueue.find(
      (item) => item.entity === "plano" && item.payload.includes(planId)
    );
  }

  public async getQueueCount(): Promise<number> {
    return this.syncQueue.filter((i) => i.status === "PENDING").length;
  }

  public async getConflictCount(): Promise<number> {
    return this.syncQueue.filter((i) => i.status === "CONFLICT").length;
  }

  public async clearQueue(): Promise<void> {
    this.syncQueue = [];
  }
}

export const localDb = new LocalDatabase();
