import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
} from "react-native";
import { PendingSyncItem } from "../types";
import { localDb } from "../database/sqlite";
import { syncManager } from "../services/syncManager";
import { getApiUrl, setApiUrl } from "../services/api";

interface SyncQueueScreenProps {
  onBack: () => void;
  initialFilter?: "TODAS" | "CONFLITOS" | "PENDENTES";
}

export function SyncQueueScreen({ onBack, initialFilter = "TODAS" }: SyncQueueScreenProps) {
  const [allQueue, setAllQueue] = useState<PendingSyncItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState(getApiUrl());
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);
  const [filterTab, setFilterTab] = useState<"TODAS" | "CONFLITOS" | "PENDENTES">(initialFilter);

  // Estado para o diálogo de confirmação detalhado de descarte
  const [itemToDiscard, setItemToDiscard] = useState<PendingSyncItem | null>(null);
  const [discardSummary, setDiscardSummary] = useState<{
    planoNome: string;
    acaoDesc: string;
    motivoLocal: string;
  } | null>(null);

  const loadQueue = async () => {
    const items = await localDb.getAllQueue();
    setAllQueue(items);
  };

  const checkConnection = async () => {
    const online = await syncManager.checkServerConnection();
    setServerOnline(online);
  };

  useEffect(() => {
    loadQueue();
    checkConnection();
  }, []);

  const handleSaveUrl = () => {
    setApiUrl(serverUrl);
    checkConnection();
    Alert.alert("Configuração", "Endereço da API atualizado.");
  };

  const handleSyncAll = async () => {
    setLoading(true);
    const result = await syncManager.syncAll();
    setLoading(false);
    await loadQueue();
    await checkConnection();

    Alert.alert(
      result.success ? "Sincronização Concluída" : "Aviso de Sincronização",
      result.message
    );
  };

  // Ação 1: Atualizar a partir do servidor
  const handleResolvePullFromServer = async (item: PendingSyncItem) => {
    setActionLoadingId(item.client_op_id);
    const result = await syncManager.resolveConflictWithServer(item.client_op_id);
    setActionLoadingId(null);
    await loadQueue();

    if (result.success) {
      Alert.alert(
        "Dados Atualizados do Servidor",
        `${result.message}\n\nA versão oficial do servidor foi aplicada à base local.`
      );
    } else {
      Alert.alert("Falha ao Atualizar", result.message);
    }
  };

  // Ação 2: Descartar operação pendente com confirmação explícita
  const handleOpenDiscardModal = async (item: PendingSyncItem) => {
    let planoNome = "Registro Operacional";
    let acaoDesc = `${item.entity.toUpperCase()} — ${item.action}`;
    let motivoLocal = "Nenhum apontamento adicional";

    if (item.entity === "plano") {
      try {
        const payload = JSON.parse(item.payload);
        const planId = payload.id || payload.plano_id;
        const plan = await localDb.getPlanById(planId);
        if (plan) {
          planoNome = `${plan.cultura_nome} (${plan.alvo_nome})`;
        } else {
          planoNome = `Plano ID: ${planId}`;
        }
        acaoDesc = `Transição pretendida para "${payload.status}"`;
        motivoLocal = payload.motivo || payload.observacoes || "Sem motivo informado";
      } catch {
        // Ignora erro no parse
      }
    }

    setItemToDiscard(item);
    setDiscardSummary({
      planoNome,
      acaoDesc,
      motivoLocal,
    });
  };

  const handleConfirmDiscard = async () => {
    if (!itemToDiscard) return;
    const opId = itemToDiscard.client_op_id;
    setItemToDiscard(null);
    setDiscardSummary(null);

    setActionLoadingId(opId);
    const res = await syncManager.discardConflictingOperation(opId);
    setActionLoadingId(null);
    await loadQueue();

    Alert.alert("Operação Descartada", res.message);
  };

  // Métricas e contadores
  const pendingCount = allQueue.filter((i) => i.status === "PENDING" || i.status === "FAILED").length;
  const conflictCount = allQueue.filter((i) => i.status === "CONFLICT").length;
  const rejectedCount = allQueue.filter((i) => i.status === "REJECTED").length;

  const filteredItems = allQueue.filter((item) => {
    if (filterTab === "CONFLITOS") return item.status === "CONFLICT";
    if (filterTab === "PENDENTES") return item.status === "PENDING" || item.status === "FAILED";
    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "CONFLICT":
        return {
          bg: "#fee2e2",
          text: "#991b1b",
          border: "#fca5a5",
          label: "⚠️ Conflito",
        };
      case "REJECTED":
        return {
          bg: "#ffedd5",
          text: "#9a3412",
          border: "#fdba74",
          label: "⛔ Rejeitada",
        };
      case "PENDING":
        return {
          bg: "#fef3c7",
          text: "#92400e",
          border: "#fde68a",
          label: "⏳ Pendente",
        };
      case "FAILED":
        return {
          bg: "#f1f5f9",
          text: "#475569",
          border: "#cbd5e1",
          label: "Falha de Conexão",
        };
      default:
        return {
          bg: "#f3f4f6",
          text: "#374151",
          border: "#e5e7eb",
          label: status,
        };
    }
  };

  const renderPayloadInfo = (item: PendingSyncItem) => {
    try {
      const payload = JSON.parse(item.payload);
      if (item.entity === "plano") {
        return (
          <View style={styles.payloadBox}>
            <Text style={styles.payloadText}>
              Plano: <Text style={styles.payloadBold}>{payload.id || payload.plano_id}</Text>
            </Text>
            {payload.status && (
              <Text style={styles.payloadText}>
                Status pretendido: <Text style={styles.payloadBold}>{payload.status}</Text>
              </Text>
            )}
            {payload.motivo && (
              <Text style={styles.payloadText}>
                Observações de campo: <Text style={styles.payloadItalic}>{payload.motivo}</Text>
              </Text>
            )}
          </View>
        );
      }
      if (item.entity === "registro_irrigacao") {
        return (
          <View style={styles.payloadBox}>
            <Text style={styles.payloadText}>
              Pivô: <Text style={styles.payloadBold}>{payload.pivo_id || payload.pivo}</Text>
            </Text>
            <Text style={styles.payloadText}>
              Lâmina: <Text style={styles.payloadBold}>{payload.lamina_aplicada_mm || 0} mm</Text> (Percentímetro: {payload.percentimetro}%)
            </Text>
          </View>
        );
      }
    } catch {
      return null;
    }
    return null;
  };

  return (
    <View style={styles.container}>
      {/* Cabeçalho */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Fila & Conflitos Offline</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.content}>
        {/* Painel de Indicadores de Sincronização */}
        <View style={styles.countersRow}>
          <TouchableOpacity
            style={[styles.counterCard, filterTab === "TODAS" && styles.counterCardActive]}
            onPress={() => setFilterTab("TODAS")}
          >
            <Text style={styles.counterNum}>{allQueue.length}</Text>
            <Text style={styles.counterLabel}>Total na Fila</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.counterCard,
              conflictCount > 0 && styles.counterCardConflict,
              filterTab === "CONFLITOS" && styles.counterCardActive,
            ]}
            onPress={() => setFilterTab("CONFLITOS")}
          >
            <Text style={[styles.counterNum, conflictCount > 0 && { color: "#b91c1c" }]}>
              {conflictCount}
            </Text>
            <Text style={[styles.counterLabel, conflictCount > 0 && { color: "#b91c1c", fontWeight: "700" }]}>
              Conflitos ⚠️
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.counterCard, filterTab === "PENDENTES" && styles.counterCardActive]}
            onPress={() => setFilterTab("PENDENTES")}
          >
            <Text style={styles.counterNum}>{pendingCount}</Text>
            <Text style={styles.counterLabel}>Pendentes</Text>
          </TouchableOpacity>
        </View>

        {/* Card de Conexão com Servidor */}
        <View style={styles.card}>
          <View style={styles.serverStatusRow}>
            <Text style={styles.cardTitle}>Conexão Central On-Premises</Text>
            <View style={[styles.statusDot, { backgroundColor: serverOnline ? "#16a34a" : "#dc2626" }]} />
            <Text style={[styles.statusText, { color: serverOnline ? "#15803d" : "#b91c1c" }]}>
              {serverOnline ? "Online" : "Sem Conexão"}
            </Text>
          </View>

          <View style={styles.urlInputRow}>
            <TextInput
              style={styles.urlInput}
              value={serverUrl}
              onChangeText={setServerUrl}
              placeholder="http://192.168.1.100:8000/api/v1"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity style={styles.saveUrlBtn} onPress={handleSaveUrl}>
              <Text style={styles.saveUrlText}>Salvar</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.syncBtn, loading && { opacity: 0.7 }]}
            onPress={handleSyncAll}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.syncBtnText}>🔄 Sincronizar Fila Agora</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Lista de Operações da Fila */}
        <View style={styles.listSection}>
          <View style={styles.listHeaderRow}>
            <Text style={styles.sectionTitle}>
              {filterTab === "CONFLITOS"
                ? `Operações em Conflito (${conflictCount})`
                : filterTab === "PENDENTES"
                ? `Operações Pendentes (${pendingCount})`
                : `Todas as Operações (${allQueue.length})`}
            </Text>
          </View>

          {filteredItems.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>
                {filterTab === "CONFLITOS"
                  ? "🎉 Nenhum conflito pendente!"
                  : "Nenhuma operação pendente nesta visualização."}
              </Text>
              <Text style={styles.emptySubtitle}>
                {filterTab === "CONFLITOS"
                  ? "Todas as alterações locais estão alinhadas com o servidor."
                  : "A fila está limpa e sincronizada."}
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredItems}
              keyExtractor={(item) => item.client_op_id}
              contentContainerStyle={{ gap: 10, paddingBottom: 30 }}
              renderItem={({ item }) => {
                const badge = getStatusBadge(item.status);
                const isConflict = item.status === "CONFLICT";
                const isRejected = item.status === "REJECTED";
                const isOperating = actionLoadingId === item.client_op_id;

                return (
                  <View
                    style={[
                      styles.queueItem,
                      isConflict && styles.queueItemConflict,
                      isRejected && styles.queueItemRejected,
                    ]}
                  >
                    {/* Cabeçalho do Card */}
                    <View style={styles.queueItemHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.queueEntity}>
                          {item.entity.toUpperCase()} · {item.action}
                        </Text>
                        <Text style={styles.queueOpId}>Op ID: {item.client_op_id}</Text>
                      </View>
                      <View
                        style={[
                          styles.queueStatusBadge,
                          { backgroundColor: badge.bg, borderColor: badge.border },
                        ]}
                      >
                        <Text style={[styles.queueStatusText, { color: badge.text }]}>
                          {badge.label}
                        </Text>
                      </View>
                    </View>

                    {/* Dados da Operação */}
                    {renderPayloadInfo(item)}

                    {/* Datas de criação e última tentativa */}
                    <View style={styles.dateRow}>
                      <Text style={styles.dateMeta}>
                        Criado: {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(item.created_at).toLocaleDateString()}
                      </Text>
                      {item.last_attempt_at && (
                        <Text style={styles.dateMeta}>
                          Última tentativa: {new Date(item.last_attempt_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      )}
                    </View>

                    {/* Caixa de Erro ou Conflito do Servidor */}
                    {item.error_message && (
                      <View
                        style={[
                          styles.errorAlertBox,
                          isConflict ? styles.errorConflictBox : styles.errorGenericBox,
                        ]}
                      >
                        <Text style={styles.errorAlertTitle}>
                          {isConflict ? "⚠️ Motivo do Conflito no Servidor:" : "Motivo do Erro:"}
                        </Text>
                        <Text style={styles.errorAlertText}>{item.error_message}</Text>
                        {item.server_state_info && (
                          <Text style={styles.serverInfoText}>ℹ️ {item.server_state_info}</Text>
                        )}
                      </View>
                    )}

                    {/* Ações de Resolução Seguras (exibidas em CONFLICT ou REJECTED) */}
                    {(isConflict || isRejected) && (
                      <View style={styles.resolutionActionsRow}>
                        <TouchableOpacity
                          style={[styles.resBtn, styles.resBtnPull]}
                          onPress={() => handleResolvePullFromServer(item)}
                          disabled={isOperating}
                        >
                          {isOperating ? (
                            <ActivityIndicator size="small" color="#1e40af" />
                          ) : (
                            <Text style={styles.resBtnPullText}>🔄 Atualizar do Servidor</Text>
                          )}
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.resBtn, styles.resBtnDiscard]}
                          onPress={() => handleOpenDiscardModal(item)}
                          disabled={isOperating}
                        >
                          <Text style={styles.resBtnDiscardText}>🗑️ Descartar Operação</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              }}
            />
          )}
        </View>
      </View>

      {/* Modal de Confirmação Detalhada de Descarte */}
      {itemToDiscard && discardSummary && (
        <Modal
          visible={!!itemToDiscard}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setItemToDiscard(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>⚠️ Descartar Operação Conflitante</Text>
              </View>

              <View style={styles.modalBody}>
                <Text style={styles.modalWarningText}>
                  A operação local não será enviada ao servidor e o registro no dispositivo móvel será alinhado com o estado oficial mais recente.
                </Text>

                <View style={styles.discardCardDetails}>
                  <Text style={styles.discardDetailLabel}>Registro Alvo:</Text>
                  <Text style={styles.discardDetailVal}>{discardSummary.planoNome}</Text>

                  <Text style={styles.discardDetailLabel}>Ação Local que Será Cancelada:</Text>
                  <Text style={styles.discardDetailVal}>{discardSummary.acaoDesc}</Text>

                  <Text style={styles.discardDetailLabel}>Apontamento do Operador:</Text>
                  <Text style={styles.discardDetailValItalic}>{discardSummary.motivoLocal}</Text>

                  {itemToDiscard.error_message && (
                    <>
                      <Text style={styles.discardDetailLabel}>Conflito com o Servidor:</Text>
                      <Text style={styles.discardDetailConflictVal}>
                        {itemToDiscard.error_message}
                      </Text>
                    </>
                  )}
                </View>

                <Text style={styles.discardNoticeText}>
                  Outras operações da fila continuarão salvas com segurança.
                </Text>
              </View>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setItemToDiscard(null)}
                >
                  <Text style={styles.modalCancelBtnText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalConfirmDiscardBtn}
                  onPress={handleConfirmDiscard}
                >
                  <Text style={styles.modalConfirmDiscardBtnText}>Confirmar Descarte</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#132a22",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backButton: {
    paddingVertical: 4,
  },
  backButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  content: {
    padding: 16,
    flex: 1,
  },
  countersRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  counterCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  counterCardActive: {
    borderColor: "#1b7d52",
    backgroundColor: "#f0fdf4",
  },
  counterCardConflict: {
    borderColor: "#fca5a5",
    backgroundColor: "#fef2f2",
  },
  counterNum: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
  },
  counterLabel: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 14,
    borderColor: "#e2e8f0",
    borderWidth: 1,
    marginBottom: 14,
  },
  serverStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1e293b",
    flex: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  urlInputRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  urlInput: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    color: "#1e293b",
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  saveUrlBtn: {
    backgroundColor: "#334155",
    paddingHorizontal: 12,
    justifyContent: "center",
    borderRadius: 6,
  },
  saveUrlText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
  },
  syncBtn: {
    backgroundColor: "#1b7d52",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  syncBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  listSection: {
    flex: 1,
  },
  listHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1e293b",
  },
  emptyBox: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1e293b",
    textAlign: "center",
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
  },
  queueItem: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  queueItemConflict: {
    borderColor: "#fca5a5",
    backgroundColor: "#fffaf0",
  },
  queueItemRejected: {
    borderColor: "#fdba74",
    backgroundColor: "#fff7ed",
  },
  queueItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  queueEntity: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
  },
  queueOpId: {
    fontSize: 10,
    color: "#64748b",
    marginTop: 1,
    fontFamily: "monospace",
  },
  queueStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  queueStatusText: {
    fontSize: 11,
    fontWeight: "700",
  },
  payloadBox: {
    backgroundColor: "#f8fafc",
    padding: 8,
    borderRadius: 6,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  payloadText: {
    fontSize: 12,
    color: "#334155",
    marginBottom: 2,
  },
  payloadBold: {
    fontWeight: "700",
    color: "#0f172a",
  },
  payloadItalic: {
    fontStyle: "italic",
    color: "#475569",
  },
  dateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
    marginBottom: 6,
  },
  dateMeta: {
    fontSize: 10,
    color: "#94a3b8",
  },
  errorAlertBox: {
    borderRadius: 6,
    padding: 8,
    marginTop: 4,
    marginBottom: 8,
    borderWidth: 1,
  },
  errorConflictBox: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
  },
  errorGenericBox: {
    backgroundColor: "#fff7ed",
    borderColor: "#fed7aa",
  },
  errorAlertTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#991b1b",
    marginBottom: 2,
  },
  errorAlertText: {
    fontSize: 11,
    color: "#b91c1c",
    lineHeight: 15,
  },
  serverInfoText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#1e40af",
    marginTop: 4,
  },
  resolutionActionsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  resBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  resBtnPull: {
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  resBtnPullText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1d4ed8",
  },
  resBtnDiscard: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  resBtnDiscardText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#b91c1c",
  },
  // Modal de descarte
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    width: "100%",
    maxWidth: 420,
    overflow: "hidden",
  },
  modalHeader: {
    backgroundColor: "#fee2e2",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#fca5a5",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#991b1b",
  },
  modalBody: {
    padding: 16,
  },
  modalWarningText: {
    fontSize: 13,
    color: "#475569",
    marginBottom: 12,
    lineHeight: 18,
  },
  discardCardDetails: {
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 12,
  },
  discardDetailLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
    marginTop: 4,
  },
  discardDetailVal: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
  },
  discardDetailValItalic: {
    fontSize: 12,
    fontStyle: "italic",
    color: "#334155",
  },
  discardDetailConflictVal: {
    fontSize: 12,
    color: "#b91c1c",
    fontWeight: "600",
  },
  discardNoticeText: {
    fontSize: 11,
    color: "#64748b",
  },
  modalFooter: {
    flexDirection: "row",
    gap: 10,
    padding: 16,
    backgroundColor: "#f8fafc",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: "#e2e8f0",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
  },
  modalConfirmDiscardBtn: {
    flex: 1,
    backgroundColor: "#b91c1c",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  modalConfirmDiscardBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff",
  },
});
