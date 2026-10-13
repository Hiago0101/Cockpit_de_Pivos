import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert,
} from "react-native";
import { MobileCropPlan, CropPlanStatus, PendingSyncItem } from "../types";
import { localDb } from "../database/sqlite";
import { syncManager } from "../services/syncManager";

interface PlanningScreenProps {
  onOpenSync: () => void;
  userRole?: string;
}

export function PlanningScreen({ onOpenSync, userRole = "OPERADOR" }: PlanningScreenProps) {
  const [plans, setPlans] = useState<MobileCropPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("TODOS");
  const [selectedPlan, setSelectedPlan] = useState<MobileCropPlan | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [conflictCount, setConflictCount] = useState(0);
  const [conflictQueue, setConflictQueue] = useState<PendingSyncItem[]>([]);
  const [resolvingOpId, setResolvingOpId] = useState<string | null>(null);

  const isConsultor = userRole === "CONSULTOR";

  const loadData = async () => {
    setLoading(true);
    const data = await localDb.getPlans();
    setPlans(data);
    const count = await localDb.getQueueCount();
    setPendingCount(count);
    const conflicts = await localDb.getConflictQueue();
    setConflictQueue(conflicts);
    setConflictCount(conflicts.length);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSyncNow = async () => {
    setSyncing(true);
    const result = await syncManager.syncAll();
    await loadData();
    setSyncing(false);
    Alert.alert("Sincronização", result.message);
  };

  const handleStatusTransition = async (plan: MobileCropPlan, nextStatus: CropPlanStatus) => {
    if (isConsultor) {
      Alert.alert("Acesso Restrito", "Consultores possuem perfil apenas de leitura.");
      return;
    }

    const actionNames: Record<CropPlanStatus, string> = {
      RASCUNHO: "retornar para Rascunho",
      PLANEJADO: "planejar cultivo",
      EM_ANDAMENTO: "iniciar plantio (Em Andamento)",
      CONCLUIDO: "concluir ciclo de colheita",
      CANCELADO: "cancelar planejamento",
    };

    Alert.alert(
      "Confirmar Operação",
      `Deseja ${actionNames[nextStatus] || nextStatus} para o plano "${plan.cultura_nome}" (${plan.alvo_nome})?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Confirmar",
          onPress: async () => {
            const updated = await localDb.updateLocalPlanStatus(
              plan.id,
              nextStatus,
              `Alteração operacional via dispositivo móvel por perfil ${userRole}`
            );
            if (updated) {
              setSelectedPlan(updated);
              await loadData();
              Alert.alert(
                "Registrado",
                "Status atualizado localmente e enfileirado para sincronização com o servidor."
              );
            }
          },
        },
      ]
    );
  };

  const getConflictForPlan = (planId: string): PendingSyncItem | undefined => {
    return conflictQueue.find((item) => {
      try {
        const payload = JSON.parse(item.payload);
        return payload.id === planId || payload.plano_id === planId;
      } catch {
        return false;
      }
    });
  };

  const handleResolveConflictFromServer = async (client_op_id: string) => {
    setResolvingOpId(client_op_id);
    const res = await syncManager.resolveConflictWithServer(client_op_id);
    setResolvingOpId(null);
    await loadData();
    if (selectedPlan) {
      const fresh = (await localDb.getPlans()).find((p) => p.id === selectedPlan.id);
      if (fresh) setSelectedPlan(fresh);
    }
    Alert.alert(res.success ? "Atualizado do Servidor" : "Aviso", res.message);
  };

  const handleDiscardConflict = (client_op_id: string, planName: string) => {
    Alert.alert(
      "Descartar Operação Conflitante",
      `Deseja descartar a alteração pendente de "${planName}"? O plano local será revertido para o estado anterior seguro e a operação removida da fila.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Descartar",
          style: "destructive",
          onPress: async () => {
            setResolvingOpId(client_op_id);
            const res = await syncManager.discardConflictingOperation(client_op_id);
            setResolvingOpId(null);
            await loadData();
            if (selectedPlan) {
              const fresh = (await localDb.getPlans()).find((p) => p.id === selectedPlan.id);
              if (fresh) setSelectedPlan(fresh);
            }
            Alert.alert("Descartado", res.message);
          },
        },
      ]
    );
  };

  const filteredPlans = plans.filter((p) => {
    const q = search.toLowerCase();
    const matchesSearch =
      p.cultura_nome.toLowerCase().includes(q) ||
      p.safra_nome.toLowerCase().includes(q) ||
      p.fazenda_nome.toLowerCase().includes(q) ||
      p.alvo_nome.toLowerCase().includes(q);

    if (!matchesSearch) return false;
    if (statusFilter === "TODOS") return true;
    return p.status === statusFilter;
  });

  const getStatusBadgeStyle = (status: CropPlanStatus) => {
    switch (status) {
      case "PLANEJADO":
        return { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe" };
      case "EM_ANDAMENTO":
        return { bg: "#ecfdf5", text: "#047857", border: "#a7f3d0" };
      case "CONCLUIDO":
        return { bg: "#f0fdf4", text: "#15803d", border: "#86efac" };
      case "CANCELADO":
        return { bg: "#fef2f2", text: "#b91c1c", border: "#fecaca" };
      default:
        return { bg: "#f8fafc", text: "#475569", border: "#e2e8f0" };
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    const parts = dateStr.split("-");
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  };

  const activeConflictForModal = selectedPlan ? getConflictForPlan(selectedPlan.id) : undefined;

  return (
    <View style={styles.container}>
      {/* Barra de Status e Sincronização */}
      <View style={styles.syncBar}>
        <TouchableOpacity style={styles.syncInfo} onPress={onOpenSync} activeOpacity={0.7}>
          <Text style={styles.syncTitle}>Planejamento Agrícola</Text>
          <View style={styles.syncSubRow}>
            <Text style={styles.syncSubtitle}>
              {pendingCount > 0 ? `${pendingCount} operação(ões) pendente(s)` : "Base de dados local"}
            </Text>
            {conflictCount > 0 && (
              <View style={styles.syncConflictBadge}>
                <Text style={styles.syncConflictBadgeText}>⚠️ {conflictCount} conflito(s)</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.syncButton}
          onPress={handleSyncNow}
          disabled={syncing}
        >
          {syncing ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.syncButtonText}>Sincronizar</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Banner de Aviso de Conflitos */}
      {conflictCount > 0 && (
        <View style={styles.conflictBanner}>
          <View style={styles.conflictBannerInfo}>
            <Text style={styles.conflictBannerTitle}>
              ⚠️ {conflictCount} {conflictCount === 1 ? "conflito de sincronização detectado" : "conflitos de sincronização detectados"}
            </Text>
            <Text style={styles.conflictBannerDesc}>
              Operações locais divergentes do servidor. Revise e alinhe os dados.
            </Text>
          </View>
          <TouchableOpacity style={styles.conflictBannerBtn} onPress={onOpenSync}>
            <Text style={styles.conflictBannerBtnText}>Resolver</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Busca Rápida */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar cultura, alvo, safra, fazenda..."
          placeholderTextColor="#94a3b8"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Filtros de Status */}
      <View style={styles.filtersContainer}>
        {(["TODOS", "PLANEJADO", "EM_ANDAMENTO", "CONCLUIDO"] as const).map((st) => (
          <TouchableOpacity
            key={st}
            style={[styles.filterChip, statusFilter === st && styles.filterChipActive]}
            onPress={() => setStatusFilter(st)}
          >
            <Text style={[styles.filterChipText, statusFilter === st && styles.filterChipTextActive]}>
              {st === "TODOS" ? "Todos" : st === "EM_ANDAMENTO" ? "Em Curso" : st === "PLANEJADO" ? "Planejado" : "Concluído"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Listagem de Planos */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1b7d52" />
          <Text style={styles.loadingText}>Carregando planos agrícolas...</Text>
        </View>
      ) : filteredPlans.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>Nenhum plano encontrado</Text>
          <Text style={styles.emptySubtitle}>
            {plans.length === 0
              ? "Toque em 'Sincronizar' para baixar os dados do servidor."
              : "Nenhum registro corresponde aos filtros selecionados."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredPlans}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const badge = getStatusBadgeStyle(item.status);
            const planConflict = getConflictForPlan(item.id);

            return (
              <TouchableOpacity
                style={[styles.planCard, planConflict && styles.planCardConflict]}
                onPress={() => setSelectedPlan(item)}
                activeOpacity={0.7}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cropTitleGroup}>
                    <Text style={styles.cropName}>{item.cultura_nome}</Text>
                    <Text style={styles.targetName}>• {item.alvo_nome}</Text>
                    {planConflict && (
                      <View style={styles.cardConflictBadge}>
                        <Text style={styles.cardConflictBadgeText}>⚠️ CONFLITO</Text>
                      </View>
                    )}
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
                    <Text style={[styles.statusBadgeText, { color: badge.text }]}>
                      {item.status_display || item.status}
                    </Text>
                  </View>
                </View>

                {planConflict && (
                  <View style={styles.cardConflictBox}>
                    <Text style={styles.cardConflictText} numberOfLines={2}>
                      ⚠️ Conflito: {planConflict.error_message || "Rejeitado ou modificado no servidor."}
                    </Text>
                  </View>
                )}

                <View style={styles.cardDetails}>
                  <Text style={styles.metaText}>
                    Fazenda: <Text style={styles.metaBold}>{item.fazenda_nome}</Text>
                  </Text>
                  <Text style={styles.metaText}>
                    Safra: <Text style={styles.metaBold}>{item.safra_nome}</Text>
                  </Text>
                </View>

                <View style={styles.cardFooter}>
                  <View style={styles.dateGroup}>
                    <Text style={styles.dateLabel}>Plantio: {formatDate(item.data_plantio)}</Text>
                    <Text style={styles.dateLabel}>Colheita: {formatDate(item.data_colheita_prevista)}</Text>
                  </View>
                  <Text style={styles.areaBadge}>{Number(item.area_planejada_ha).toFixed(1)} ha</Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Modal de Detalhes do Plano & Operações */}
      {selectedPlan && (
        <Modal
          visible={!!selectedPlan}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setSelectedPlan(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>{selectedPlan.cultura_nome}</Text>
                  <Text style={styles.modalSubtitle}>{selectedPlan.alvo_nome} · {selectedPlan.fazenda_nome}</Text>
                </View>
                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={() => setSelectedPlan(null)}
                >
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.modalBody}>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Safra:</Text>
                  <Text style={styles.modalVal}>{selectedPlan.safra_nome}</Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Área Planejada:</Text>
                  <Text style={styles.modalVal}>{Number(selectedPlan.area_planejada_ha).toFixed(2)} hectares</Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Data Plantio:</Text>
                  <Text style={styles.modalVal}>{formatDate(selectedPlan.data_plantio)}</Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Colheita Prevista:</Text>
                  <Text style={styles.modalVal}>{formatDate(selectedPlan.data_colheita_prevista)}</Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Situação Atual:</Text>
                  <Text style={[styles.modalVal, { fontWeight: "bold" }]}>
                    {selectedPlan.status_display || selectedPlan.status}
                  </Text>
                </View>
                {selectedPlan.observacoes ? (
                  <View style={styles.obsBox}>
                    <Text style={styles.obsLabel}>Observações:</Text>
                    <Text style={styles.obsText}>{selectedPlan.observacoes}</Text>
                  </View>
                ) : null}
              </View>

              {/* Caixa de Resolução de Conflito no Modal */}
              {activeConflictForModal && (
                <View style={styles.modalConflictCard}>
                  <View style={styles.modalConflictHeader}>
                    <Text style={styles.modalConflictTitle}>⚠️ Conflito de Sincronização</Text>
                    <Text style={styles.modalConflictBadge}>Ação Necessária</Text>
                  </View>
                  <Text style={styles.modalConflictMsg}>
                    {activeConflictForModal.error_message || "A alteração local diverge do estado registrado no servidor."}
                  </Text>
                  {activeConflictForModal.server_state_info && (
                    <Text style={styles.modalConflictServerInfo}>
                      ℹ️ {activeConflictForModal.server_state_info}
                    </Text>
                  )}
                  {activeConflictForModal.last_attempt_at && (
                    <Text style={styles.modalConflictTime}>
                      Última tentativa: {new Date(activeConflictForModal.last_attempt_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(activeConflictForModal.last_attempt_at).toLocaleDateString()}
                    </Text>
                  )}

                  <View style={styles.modalConflictActions}>
                    <TouchableOpacity
                      style={[styles.modalConflictActionBtn, styles.modalConflictPullBtn]}
                      onPress={() => handleResolveConflictFromServer(activeConflictForModal.client_op_id)}
                      disabled={resolvingOpId === activeConflictForModal.client_op_id}
                    >
                      {resolvingOpId === activeConflictForModal.client_op_id ? (
                        <ActivityIndicator size="small" color="#1e40af" />
                      ) : (
                        <Text style={styles.modalConflictPullText}>🔄 Atualizar do Servidor</Text>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.modalConflictActionBtn, styles.modalConflictDiscardBtn]}
                      onPress={() => handleDiscardConflict(activeConflictForModal.client_op_id, selectedPlan.cultura_nome)}
                      disabled={resolvingOpId === activeConflictForModal.client_op_id}
                    >
                      <Text style={styles.modalConflictDiscardText}>🗑️ Descartar Alteração</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={styles.modalConflictQueueLink}
                    onPress={() => {
                      setSelectedPlan(null);
                      onOpenSync();
                    }}
                  >
                    <Text style={styles.modalConflictQueueLinkText}>
                      Abrir Fila de Sincronização Detalhada →
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Botões Operacionais de Transição */}
              {!isConsultor && (
                <View style={styles.modalActions}>
                  {activeConflictForModal ? (
                    <View style={styles.conflictLockedBox}>
                      <Text style={styles.conflictLockedText}>
                        🔒 Transições operacionais suspensas enquanto houver conflito pendente neste plano. Utilize as ações acima para alinhar com o servidor.
                      </Text>
                    </View>
                  ) : (
                    <>
                      {selectedPlan.status === "PLANEJADO" && (
                        <TouchableOpacity
                          style={[styles.actionBtn, { backgroundColor: "#047857" }]}
                          onPress={() => handleStatusTransition(selectedPlan, "EM_ANDAMENTO")}
                        >
                          <Text style={styles.actionBtnText}>🌱 Iniciar Plantio (Em Andamento)</Text>
                        </TouchableOpacity>
                      )}

                      {selectedPlan.status === "EM_ANDAMENTO" && (
                        <TouchableOpacity
                          style={[styles.actionBtn, { backgroundColor: "#15803d" }]}
                          onPress={() => handleStatusTransition(selectedPlan, "CONCLUIDO")}
                        >
                          <Text style={styles.actionBtnText}>🌾 Concluir Colheita</Text>
                        </TouchableOpacity>
                      )}

                      {selectedPlan.status === "RASCUNHO" && (
                        <TouchableOpacity
                          style={[styles.actionBtn, { backgroundColor: "#1d4ed8" }]}
                          onPress={() => handleStatusTransition(selectedPlan, "PLANEJADO")}
                        >
                          <Text style={styles.actionBtnText}>✓ Marcar como Planejado</Text>
                        </TouchableOpacity>
                      )}

                      {(selectedPlan.status === "PLANEJADO" || selectedPlan.status === "EM_ANDAMENTO") && (
                        <TouchableOpacity
                          style={[styles.actionBtn, { backgroundColor: "#b91c1c", marginTop: 8 }]}
                          onPress={() => handleStatusTransition(selectedPlan, "CANCELADO")}
                        >
                          <Text style={styles.actionBtnText}>✕ Cancelar Planejamento</Text>
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                </View>
              )}

              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setSelectedPlan(null)}
              >
                <Text style={styles.modalCloseButtonText}>Fechar</Text>
              </TouchableOpacity>
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
    backgroundColor: "#f4f6f8",
  },
  syncBar: {
    backgroundColor: "#132a22",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  syncInfo: {
    flex: 1,
  },
  syncTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "bold",
  },
  syncSubRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  syncSubtitle: {
    color: "#a7f3d0",
    fontSize: 11,
  },
  syncConflictBadge: {
    backgroundColor: "#ef4444",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  syncConflictBadgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "bold",
  },
  conflictBanner: {
    backgroundColor: "#fef2f2",
    borderBottomWidth: 1,
    borderBottomColor: "#fecaca",
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  conflictBannerInfo: {
    flex: 1,
    marginRight: 10,
  },
  conflictBannerTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#991b1b",
  },
  conflictBannerDesc: {
    fontSize: 11,
    color: "#b91c1c",
    marginTop: 2,
  },
  conflictBannerBtn: {
    backgroundColor: "#b91c1c",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  conflictBannerBtnText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "bold",
  },
  syncButton: {
    backgroundColor: "#1b7d52",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  syncButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "bold",
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  searchInput: {
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: "#0f172a",
  },
  filtersContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#ffffff",
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#f1f5f9",
  },
  filterChipActive: {
    backgroundColor: "#1b7d52",
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
  },
  filterChipTextActive: {
    color: "#ffffff",
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  planCard: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    marginBottom: 8,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  cropTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 6,
  },
  cropName: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#0f172a",
  },
  targetName: {
    fontSize: 13,
    color: "#64748b",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  cardDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#f8fafc",
  },
  metaText: {
    fontSize: 12,
    color: "#64748b",
  },
  metaBold: {
    fontWeight: "600",
    color: "#1e293b",
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    padding: 8,
    borderRadius: 6,
  },
  dateGroup: {
    gap: 2,
  },
  dateLabel: {
    fontSize: 11,
    color: "#475569",
  },
  areaBadge: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#1b7d52",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: "#64748b",
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#334155",
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
    maxWidth: 260,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#0f172a",
  },
  modalSubtitle: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  closeBtnText: {
    fontSize: 18,
    color: "#64748b",
  },
  modalBody: {
    gap: 10,
    marginBottom: 16,
  },
  modalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalLabel: {
    fontSize: 13,
    color: "#64748b",
  },
  modalVal: {
    fontSize: 13,
    color: "#0f172a",
    fontWeight: "500",
  },
  obsBox: {
    backgroundColor: "#f8fafc",
    padding: 10,
    borderRadius: 8,
    marginTop: 6,
  },
  obsLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
    marginBottom: 2,
  },
  obsText: {
    fontSize: 12,
    color: "#334155",
  },
  modalActions: {
    marginTop: 8,
    marginBottom: 12,
  },
  actionBtn: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  actionBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "bold",
  },
  planCardConflict: {
    borderColor: "#fca5a5",
    backgroundColor: "#fffafa",
  },
  cardConflictBadge: {
    backgroundColor: "#fee2e2",
    borderColor: "#fca5a5",
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  cardConflictBadgeText: {
    color: "#991b1b",
    fontSize: 9,
    fontWeight: "bold",
  },
  cardConflictBox: {
    backgroundColor: "#fff1f2",
    borderLeftWidth: 3,
    borderLeftColor: "#e11d48",
    padding: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  cardConflictText: {
    fontSize: 11,
    color: "#9f1239",
    lineHeight: 15,
  },
  modalConflictCard: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  modalConflictHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  modalConflictTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#991b1b",
  },
  modalConflictBadge: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#b91c1c",
    backgroundColor: "#fee2e2",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  modalConflictMsg: {
    fontSize: 12,
    color: "#7f1d1d",
    lineHeight: 17,
    marginBottom: 6,
  },
  modalConflictServerInfo: {
    fontSize: 11,
    color: "#1e3a8a",
    backgroundColor: "#eff6ff",
    padding: 6,
    borderRadius: 4,
    marginBottom: 6,
  },
  modalConflictTime: {
    fontSize: 10,
    color: "#991b1b",
    marginBottom: 10,
  },
  modalConflictActions: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  modalConflictActionBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  modalConflictPullBtn: {
    backgroundColor: "#eff6ff",
    borderColor: "#bfdbfe",
    borderWidth: 1,
  },
  modalConflictPullText: {
    color: "#1e40af",
    fontSize: 11,
    fontWeight: "bold",
  },
  modalConflictDiscardBtn: {
    backgroundColor: "#fff1f2",
    borderColor: "#fecdd3",
    borderWidth: 1,
  },
  modalConflictDiscardText: {
    color: "#be123c",
    fontSize: 11,
    fontWeight: "bold",
  },
  modalConflictQueueLink: {
    alignItems: "center",
    paddingVertical: 4,
  },
  modalConflictQueueLinkText: {
    color: "#991b1b",
    fontSize: 11,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  conflictLockedBox: {
    backgroundColor: "#fef3c7",
    borderColor: "#fde68a",
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  conflictLockedText: {
    fontSize: 11,
    color: "#92400e",
    lineHeight: 16,
    textAlign: "center",
  },
  modalCloseButton: {
    backgroundColor: "#f1f5f9",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  modalCloseButtonText: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "600",
  },
});
