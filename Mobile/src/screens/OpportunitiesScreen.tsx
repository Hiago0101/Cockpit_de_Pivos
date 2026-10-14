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
  ScrollView,
} from "react-native";
import { MobileOpportunity, OpportunityStatus, OpportunityPriority } from "../types";
import { localDb } from "../database/sqlite";
import { syncManager } from "../services/syncManager";

interface OpportunitiesScreenProps {
  onOpenSync: () => void;
  userRole?: string;
}

export function OpportunitiesScreen({ onOpenSync, userRole = "OPERADOR" }: OpportunitiesScreenProps) {
  const [opportunities, setOpportunities] = useState<MobileOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("TODOS");
  const [priorityFilter, setPriorityFilter] = useState<string>("TODAS");
  const [selectedOpportunity, setSelectedOpportunity] = useState<MobileOpportunity | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string>("");

  const loadData = async () => {
    setLoading(true);
    const data = await localDb.getOpportunities();
    setOpportunities(data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    setLastSyncTime(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
  }, []);

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      const result = await syncManager.syncAll();
      await loadData();
      setLastSyncTime(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
      Alert.alert("Sincronização", result.message);
    } catch (err: any) {
      Alert.alert("Erro de Sincronização", err?.message || "Falha ao conectar ao servidor.");
    } finally {
      setSyncing(false);
    }
  };

  const filteredOpportunities = opportunities.filter((opp) => {
    const matchesSearch =
      opp.titulo.toLowerCase().includes(search.toLowerCase()) ||
      opp.descricao.toLowerCase().includes(search.toLowerCase()) ||
      (opp.fazenda_nome && opp.fazenda_nome.toLowerCase().includes(search.toLowerCase())) ||
      (opp.pivo_nome && opp.pivo_nome.toLowerCase().includes(search.toLowerCase()));

    if (!matchesSearch) return false;

    if (statusFilter !== "TODOS" && opp.status !== statusFilter) return false;
    if (priorityFilter !== "TODAS" && opp.prioridade !== priorityFilter) return false;

    return true;
  });

  const getPriorityStyle = (priority: OpportunityPriority) => {
    switch (priority) {
      case "CRITICA":
        return { bg: "#fee2e2", text: "#b91c1c", border: "#fca5a5" };
      case "ALTA":
        return { bg: "#ffedd5", text: "#c2410c", border: "#fed7aa" };
      case "MEDIA":
        return { bg: "#fef3c7", text: "#b45309", border: "#fde68a" };
      case "BAIXA":
      default:
        return { bg: "#f1f5f9", text: "#475569", border: "#cbd5e1" };
    }
  };

  const getStatusStyle = (status: OpportunityStatus) => {
    switch (status) {
      case "DETECTADA":
        return { bg: "#e0f2fe", text: "#0369a1", label: "Detectada" };
      case "RECONHECIDA":
        return { bg: "#fef3c7", text: "#b45309", label: "Reconhecida" };
      case "RESOLVIDA":
        return { bg: "#dcfce7", text: "#15803d", label: "Resolvida" };
      case "DESCARTADA":
        return { bg: "#f1f5f9", text: "#64748b", label: "Descartada" };
      default:
        return { bg: "#f1f5f9", text: "#64748b", label: status };
    }
  };

  const formatPeriod = (startStr: string, endStr: string) => {
    try {
      const d1 = new Date(startStr);
      const d2 = new Date(endStr);
      const fmt = (d: Date) =>
        d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) +
        " " +
        d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      return `${fmt(d1)} → ${fmt(d2)}`;
    } catch {
      return `${startStr} a ${endStr}`;
    }
  };

  // Contadores
  const detectadasCount = opportunities.filter((o) => o.status === "DETECTADA").length;
  const reconhecidasCount = opportunities.filter((o) => o.status === "RECONHECIDA").length;
  const criticasCount = opportunities.filter((o) => o.prioridade === "CRITICA" || o.prioridade === "ALTA").length;

  return (
    <View style={styles.container}>
      {/* Header limpo (sem botão sincronizar no topo) */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Janelas de Oportunidade</Text>
          <Text style={styles.headerSubtitle}>
            Recomendações agronômicas, tarifas noturnas e plantio
          </Text>
        </View>
      </View>

      {/* Resumo de Indicadores */}
      <View style={styles.metricsRow}>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{opportunities.length}</Text>
          <Text style={styles.metricLabel}>Total</Text>
        </View>
        <View style={[styles.metricCard, { borderLeftColor: "#0284c7" }]}>
          <Text style={[styles.metricValue, { color: "#0284c7" }]}>{detectadasCount}</Text>
          <Text style={styles.metricLabel}>Detectadas</Text>
        </View>
        <View style={[styles.metricCard, { borderLeftColor: "#d97706" }]}>
          <Text style={[styles.metricValue, { color: "#d97706" }]}>{reconhecidasCount}</Text>
          <Text style={styles.metricLabel}>Reconhecidas</Text>
        </View>
        <View style={[styles.metricCard, { borderLeftColor: "#dc2626" }]}>
          <Text style={[styles.metricValue, { color: "#dc2626" }]}>{criticasCount}</Text>
          <Text style={styles.metricLabel}>Críticas/Altas</Text>
        </View>
      </View>

      {/* Barra de Busca */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar oportunidade, fazenda ou pivô..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor="#94a3b8"
        />
      </View>

      {/* Filtros de Situação */}
      <View style={styles.filtersScrollContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterGroup}>
          <Text style={styles.filterHeaderLabel}>Status:</Text>
          {["TODOS", "DETECTADA", "RECONHECIDA", "RESOLVIDA", "DESCARTADA"].map((st) => (
            <TouchableOpacity
              key={st}
              style={[styles.filterChip, statusFilter === st && styles.filterChipActive]}
              onPress={() => setStatusFilter(st)}
            >
              <Text style={[styles.filterChipText, statusFilter === st && styles.filterChipTextActive]}>
                {st === "TODOS" ? "Todos" : st.charAt(0) + st.slice(1).toLowerCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Filtros de Prioridade */}
      <View style={styles.filtersScrollContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterGroup}>
          <Text style={styles.filterHeaderLabel}>Prioridade:</Text>
          {["TODAS", "CRITICA", "ALTA", "MEDIA", "BAIXA"].map((pr) => (
            <TouchableOpacity
              key={pr}
              style={[styles.filterChip, priorityFilter === pr && styles.filterChipActive]}
              onPress={() => setPriorityFilter(pr)}
            >
              <Text style={[styles.filterChipText, priorityFilter === pr && styles.filterChipTextActive]}>
                {pr === "TODAS" ? "Todas" : pr.charAt(0) + pr.slice(1).toLowerCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Lista de Oportunidades */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#1b7d52" />
          <Text style={styles.loadingText}>Carregando dados salvos localmente...</Text>
        </View>
      ) : filteredOpportunities.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>Nenhuma oportunidade encontrada</Text>
          <Text style={styles.emptyText}>
            {opportunities.length === 0
              ? "Nenhuma janela agrícola foi baixada ainda. Toque em 'Sincronizar' quando estiver conectado."
              : "Nenhum resultado corresponde aos filtros selecionados."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredOpportunities}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const pStyle = getPriorityStyle(item.prioridade);
            const sStyle = getStatusStyle(item.status);
            return (
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.7}
                onPress={() => setSelectedOpportunity(item)}
              >
                {/* Cabeçalho do Card */}
                <View style={styles.cardHeader}>
                  <View style={[styles.priorityBadge, { backgroundColor: pStyle.bg, borderColor: pStyle.border }]}>
                    <Text style={[styles.priorityBadgeText, { color: pStyle.text }]}>
                      {item.prioridade}
                    </Text>
                  </View>
                  <View style={styles.headerBadgesRight}>
                    {item.is_vencida && item.status !== "RESOLVIDA" && item.status !== "DESCARTADA" && (
                      <View style={styles.overdueBadge}>
                        <Text style={styles.overdueBadgeText}>Vencida</Text>
                      </View>
                    )}
                    <View style={[styles.statusBadge, { backgroundColor: sStyle.bg }]}>
                      <Text style={[styles.statusBadgeText, { color: sStyle.text }]}>{sStyle.label}</Text>
                    </View>
                  </View>
                </View>

                {/* Título & Descrição */}
                <Text style={styles.cardTitle}>{item.titulo}</Text>
                {item.descricao ? (
                  <Text style={styles.cardDesc} numberOfLines={2}>
                    {item.descricao}
                  </Text>
                ) : null}

                {/* Período */}
                <View style={styles.periodRow}>
                  <Text style={styles.periodIcon}>⏱</Text>
                  <Text style={styles.periodText}>{formatPeriod(item.inicio_janela, item.fim_janela)}</Text>
                </View>

                {/* Vínculos */}
                <View style={styles.tagsRow}>
                  {item.fazenda_nome && (
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>📍 {item.fazenda_nome}</Text>
                    </View>
                  )}
                  {item.pivo_nome && (
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>⚙️ {item.pivo_nome}</Text>
                    </View>
                  )}
                  {item.cultura_nome && (
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>🌱 {item.cultura_nome}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Modal de Detalhes da Oportunidade */}
      <Modal
        visible={!!selectedOpportunity}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedOpportunity(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {selectedOpportunity && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{selectedOpportunity.titulo}</Text>
                  <TouchableOpacity
                    style={styles.modalCloseButton}
                    onPress={() => setSelectedOpportunity(null)}
                  >
                    <Text style={styles.modalCloseButtonText}>✕</Text>
                  </TouchableOpacity>
                </View>

                {/* Badges */}
                <View style={styles.modalBadgesRow}>
                  <View
                    style={[
                      styles.priorityBadge,
                      {
                        backgroundColor: getPriorityStyle(selectedOpportunity.prioridade).bg,
                        borderColor: getPriorityStyle(selectedOpportunity.prioridade).border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.priorityBadgeText,
                        { color: getPriorityStyle(selectedOpportunity.prioridade).text },
                      ]}
                    >
                      Prioridade: {selectedOpportunity.prioridade}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: getStatusStyle(selectedOpportunity.status).bg },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        { color: getStatusStyle(selectedOpportunity.status).text },
                      ]}
                    >
                      {getStatusStyle(selectedOpportunity.status).label}
                    </Text>
                  </View>
                </View>

                {/* Período */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionLabel}>Janela Operacional</Text>
                  <Text style={styles.modalSectionValue}>
                    {formatPeriod(selectedOpportunity.inicio_janela, selectedOpportunity.fim_janela)}
                  </Text>
                </View>

                {/* Descrição */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionLabel}>Descrição Operacional</Text>
                  <Text style={styles.modalSectionValue}>
                    {selectedOpportunity.descricao || "Sem detalhes adicionais informados."}
                  </Text>
                </View>

                {/* Justificativa / Evidência */}
                {selectedOpportunity.justificativa ? (
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionLabel}>Justificativa Agrícola</Text>
                    <Text style={styles.modalSectionValue}>{selectedOpportunity.justificativa}</Text>
                  </View>
                ) : null}

                {/* Vínculos */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionLabel}>Vínculos Cadastrais</Text>
                  <Text style={styles.modalDetailText}>
                    Fazenda: {selectedOpportunity.fazenda_nome || "—"}
                  </Text>
                  <Text style={styles.modalDetailText}>
                    Pivô: {selectedOpportunity.pivo_nome || selectedOpportunity.pivo_codigo || "Nenhum pivô específico"}
                  </Text>
                  <Text style={styles.modalDetailText}>
                    Talhão: {selectedOpportunity.talhao_nome || "Nenhum talhão específico"}
                  </Text>
                  <Text style={styles.modalDetailText}>
                    Safra: {selectedOpportunity.safra_nome || "Nenhuma safra específica"}
                  </Text>
                  <Text style={styles.modalDetailText}>
                    Cultura: {selectedOpportunity.cultura_nome || "Nenhuma cultura vinculada"}
                  </Text>
                </View>

                {/* Aviso Offline Operacional */}
                <View style={styles.offlineNoticeBox}>
                  <Text style={styles.offlineNoticeTitle}>ℹ️ Consulta em Campo</Text>
                  <Text style={styles.offlineNoticeText}>
                    Esta janela está disponível para consulta offline. Alterações de situação (reconhecer,
                    resolver ou descartar) devem ser submetidas via web ou sincronizadas com validação central.
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.modalDismissButton}
                  onPress={() => setSelectedOpportunity(null)}
                >
                  <Text style={styles.modalDismissButtonText}>Fechar Detalhes</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
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
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0f172a",
  },
  headerSubtitle: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
  },
  syncButton: {
    backgroundColor: "#1b7d52",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  syncButtonDisabled: {
    opacity: 0.6,
  },
  syncButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  metricsRow: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  metricCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
    alignItems: "center",
    borderLeftWidth: 3,
    borderLeftColor: "#64748b",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  metricValue: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
  },
  metricLabel: {
    fontSize: 10,
    color: "#64748b",
    marginTop: 2,
  },
  searchContainer: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  searchInput: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    color: "#0f172a",
  },
  filtersScrollContainer: {
    paddingHorizontal: 12,
    paddingVertical: 2,
  },
  filterGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  filterHeaderLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748b",
    marginRight: 4,
  },
  filterChip: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
  filterChipActive: {
    backgroundColor: "#1b7d52",
    borderColor: "#1b7d52",
  },
  filterChipText: {
    fontSize: 11,
    color: "#475569",
    fontWeight: "600",
  },
  filterChipTextActive: {
    color: "#ffffff",
    fontWeight: "700",
  },
  listContent: {
    padding: 12,
    gap: 10,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  priorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  priorityBadgeText: {
    fontSize: 10,
    fontWeight: "800",
  },
  headerBadgesRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  overdueBadge: {
    backgroundColor: "#fee2e2",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  overdueBadgeText: {
    color: "#dc2626",
    fontSize: 10,
    fontWeight: "700",
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 12,
    color: "#64748b",
    lineHeight: 16,
    marginBottom: 8,
  },
  periodRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    padding: 6,
    borderRadius: 6,
    marginBottom: 8,
    gap: 6,
  },
  periodIcon: {
    fontSize: 12,
  },
  periodText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#334155",
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  tag: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagText: {
    fontSize: 10,
    color: "#475569",
    fontWeight: "500",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 12,
    color: "#64748b",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "85%",
    padding: 16,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
    flex: 1,
    marginRight: 10,
  },
  modalCloseButton: {
    padding: 6,
  },
  modalCloseButtonText: {
    fontSize: 18,
    color: "#64748b",
    fontWeight: "700",
  },
  modalBadgesRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 12,
  },
  modalSection: {
    marginBottom: 12,
  },
  modalSectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  modalSectionValue: {
    fontSize: 13,
    color: "#0f172a",
    lineHeight: 18,
  },
  modalDetailText: {
    fontSize: 12,
    color: "#334155",
    marginBottom: 2,
  },
  offlineNoticeBox: {
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    marginBottom: 16,
  },
  offlineNoticeTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1e40af",
    marginBottom: 2,
  },
  offlineNoticeText: {
    fontSize: 11,
    color: "#1e3a8a",
    lineHeight: 15,
  },
  modalDismissButton: {
    backgroundColor: "#1b7d52",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    marginBottom: 12,
  },
  modalDismissButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
});
