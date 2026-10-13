/**
 * Gerenciador de sincronização offline e conectividade do aplicativo mobile.
 */

import { localDb } from "../database/sqlite";
import { mobileApi } from "./api";
import { MobileCropPlan } from "../types";

export interface SyncResult {
  success: boolean;
  pushedCount: number;
  pulledCount: number;
  conflictCount: number;
  rejectedCount: number;
  failedCount: number;
  message: string;
}

export interface ConflictResolutionResult {
  success: boolean;
  message: string;
  plan?: MobileCropPlan | undefined;
}

export const syncManager = {
  checkServerConnection: async (): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const res = await mobileApi.checkHealth();
      clearTimeout(timeoutId);
      return res.status === "healthy";
    } catch {
      return false;
    }
  },

  syncAll: async (): Promise<SyncResult> => {
    // 1. PUSH: Envia apenas operações ativas elegíveis (PENDING ou FAILED temporário)
    // Conflitos e rejeições não são reenviados automaticamente até resolução explícita
    const queue = await localDb.getPendingQueue();
    let pushedCount = 0;
    let conflictCount = 0;
    let rejectedCount = 0;
    let failedCount = 0;

    if (queue.length > 0) {
      const operationsToSend = queue.map((item) => ({
        client_op_id: item.client_op_id,
        entity: item.entity,
        action: item.action,
        occurred_at: item.created_at,
        payload: JSON.parse(item.payload),
      }));

      try {
        const pushResult = await mobileApi.pushBatch(operationsToSend);
        if (pushResult && Array.isArray(pushResult.results)) {
          for (const res of pushResult.results) {
            if (res.status === "SUCCESS") {
              await localDb.markProcessed(res.client_op_id);
              pushedCount++;
            } else if (res.status === "CONFLICT") {
              await localDb.markConflict(
                res.client_op_id,
                res.message || "Conflito de concorrência detectado no servidor",
                res.server_id
              );
              conflictCount++;
            } else if (res.status === "REJECTED") {
              await localDb.markRejected(
                res.client_op_id,
                res.message || "Operação rejeitada por regra de negócio no servidor",
                res.server_id
              );
              rejectedCount++;
            } else {
              await localDb.markFailed(
                res.client_op_id,
                res.message || "Erro no processamento do servidor"
              );
              failedCount++;
            }
          }
        }
      } catch (err: any) {
        return {
          success: false,
          pushedCount: 0,
          pulledCount: 0,
          conflictCount: 0,
          rejectedCount: 0,
          failedCount: queue.length,
          message: `Falha no envio de operações: ${err.message}`,
        };
      }
    }

    // 2. PULL: Baixa catálogo atualizado do servidor
    let pulledCount = 0;
    try {
      const catalog = await mobileApi.pullCatalog();
      if (catalog) {
        if (Array.isArray(catalog.pivos)) {
          await localDb.savePivots(catalog.pivos);
          pulledCount += catalog.pivos.length;
        }
        if (Array.isArray(catalog.fazendas)) {
          await localDb.saveFarms(catalog.fazendas);
        }
        if (Array.isArray(catalog.talhoes)) {
          await localDb.saveFields(catalog.talhoes);
        }
        if (Array.isArray(catalog.culturas)) {
          await localDb.saveCrops(catalog.culturas);
        }
        if (Array.isArray(catalog.safras)) {
          await localDb.saveSeasons(catalog.safras);
        }
        if (Array.isArray(catalog.planos)) {
          await localDb.savePlans(catalog.planos);
          pulledCount += catalog.planos.length;
        }
        if (Array.isArray(catalog.janelas)) {
          await localDb.saveOpportunities(catalog.janelas);
          pulledCount += catalog.janelas.length;
        }
      }
    } catch (err: any) {
      return {
        success: pushedCount > 0,
        pushedCount,
        pulledCount: 0,
        conflictCount,
        rejectedCount,
        failedCount,
        message: `Dados enviados (${pushedCount}), mas catálogo não atualizado: ${err.message}`,
      };
    }

    let statusMsg = `Sincronização concluída (${pushedCount} enviada(s), ${pulledCount} recebida(s)).`;
    if (conflictCount > 0) {
      statusMsg += ` ⚠️ ${conflictCount} operação(ões) em conflito requerem atenção.`;
    }
    if (rejectedCount > 0) {
      statusMsg += ` ⛔ ${rejectedCount} operação(ões) rejeitada(s) por regras do servidor.`;
    }

    return {
      success: conflictCount === 0 && rejectedCount === 0 && failedCount === 0,
      pushedCount,
      pulledCount,
      conflictCount,
      rejectedCount,
      failedCount,
      message: statusMsg,
    };
  },

  resolveConflictWithServer: async (client_op_id: string): Promise<ConflictResolutionResult> => {
    // 1. Verifica conectividade
    const isOnline = await syncManager.checkServerConnection();
    if (!isOnline) {
      return {
        success: false,
        message: "Sem conexão com o servidor. A atualização depende da reconexão com a rede.",
      };
    }

    // 2. Consulta catálogo oficial
    try {
      const catalog = await mobileApi.pullCatalog();
      if (!catalog) {
        return { success: false, message: "Não foi possível carregar os dados do servidor." };
      }

      if (Array.isArray(catalog.planos)) {
        await localDb.savePlans(catalog.planos);
      }
      if (Array.isArray(catalog.pivos)) {
        await localDb.savePivots(catalog.pivos);
      }
      if (Array.isArray(catalog.talhoes)) {
        await localDb.saveFields(catalog.talhoes);
      }

      // 3. Localiza plano correspondente e anota estado oficial
      const allQueue = await localDb.getAllQueue();
      const item = allQueue.find((i) => i.client_op_id === client_op_id);
      let targetPlan: MobileCropPlan | undefined = undefined;
      if (item) {
        try {
          const payload = JSON.parse(item.payload);
          const planId = payload.id || payload.plano_id;
          targetPlan = await localDb.getPlanById(planId);
          if (targetPlan) {
            await localDb.updateQueueItem(client_op_id, {
              server_state_info: `Estado oficial no servidor: ${targetPlan.status_display || targetPlan.status}`,
              last_attempt_at: new Date().toISOString(),
            });
          }
        } catch {
          // Ignora erro no parse do payload
        }
      }

      return {
        success: true,
        message: targetPlan
          ? `Base local alinhada com o servidor. Status atual: ${targetPlan.status_display || targetPlan.status}.`
          : "Dados oficiais do servidor baixados com sucesso.",
        plan: targetPlan,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Erro ao consultar servidor: ${err.message}`,
      };
    }
  },

  discardConflictingOperation: async (client_op_id: string): Promise<ConflictResolutionResult> => {
    const discarded = await localDb.discardOperation(client_op_id, true);
    if (!discarded) {
      return { success: false, message: "Operação não encontrada na fila local." };
    }
    return {
      success: true,
      message: "Operação conflitante descartada com sucesso. A base local foi preservada.",
    };
  },
};

