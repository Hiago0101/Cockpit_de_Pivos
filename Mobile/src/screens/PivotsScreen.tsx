import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  RefreshControl,
  ScrollView,
} from "react-native";
import {
  CircleGauge,
  Search,
  X,
  Droplets,
  Compass,
  Layers,
  ChevronRight,
  Plus,
  Building2,
  Activity,
  RotateCw,
} from "lucide-react-native";
import { MobilePivot } from "../types";
import { localDb } from "../database/sqlite";
import { syncManager } from "../services/syncManager";

interface PivotsScreenProps {
  onSelectPivot: (pivot: MobilePivot) => void;
  onOpenSync: () => void;
  onOpenNewIrrigation: (pivot?: MobilePivot) => void;
}

export function PivotsScreen({ onSelectPivot, onOpenSync, onOpenNewIrrigation }: PivotsScreenProps) {
  const [pivots, setPivots] = useState<MobilePivot[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>("TODOS");
  const [search, setSearch] = useState("");

  const loadData = async () => {
    try {
      const data = await localDb.getPivots();
      setPivots(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await syncManager.syncAll().catch(() => {});
    await loadData();
  };

  const filteredPivots = pivots.filter((p) => {
    const matchesSearch =
      p.codigo.toLowerCase().includes(search.toLowerCase()) ||
      p.nome.toLowerCase().includes(search.toLowerCase()) ||
      (p.fazenda_nome && p.fazenda_nome.toLowerCase().includes(search.toLowerCase()));

    if (!matchesSearch) return false;
    if (filter === "TODOS") return true;
    if (filter === "IRRIGANDO") return p.status_operacional === "IRRIGANDO" || p.status_operacional === "FERTIRRIGANDO";
    if (filter === "PARADO") return p.status_operacional === "PARADO";
    if (filter === "FALHA") return p.status_operacional === "FALHA";
    return true;
  });

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "IRRIGANDO":
      case "FERTIRRIGANDO":
        return {
          label: status === "FERTIRRIGANDO" ? "Fertirrigando" : "Irrigando",
          bg: "#ecfdf5",
          border: "#a7f3d0",
          text: "#059669",
          dot: "#10b981",
        };
      case "PARADO":
        return {
          label: "Parado",
          bg: "#f8fafc",
          border: "#e2e8f0",
          text: "#64748b",
          dot: "#94a3b8",
        };
      case "FALHA":
        return {
          label: "Falha / Alerta",
          bg: "#fef2f2",
          border: "#fecaca",
          text: "#dc2626",
          dot: "#ef4444",
        };
      default:
        return {
          label: status || "Operacional",
          bg: "#fffbeb",
          border: "#fde68a",
          text: "#d97706",
          dot: "#f59e0b",
        };
    }
  };

  return (
    <View style={styles.container}>
      {/* Cabeçalho da Tela (sem o botão feio de sincronizar no topo) */}
      <View style={styles.headerArea}>
        <View style={styles.titleRow}>
          <View>
            <Text style={styles.screenTitle}>Pivôs & Irrigação</Text>
            <Text style={styles.screenSubtitle}>
              {pivots.length} equipamento(s) cadastrado(s)
            </Text>
          </View>

          <TouchableOpacity
            style={styles.newIrrigationBtn}
            onPress={() => onOpenNewIrrigation()}
            activeOpacity={0.8}
          >
            <Plus size={16} color="#ffffff" strokeWidth={2.5} />
            <Text style={styles.newIrrigationBtnText}>Novo Apontamento</Text>
          </TouchableOpacity>
        </View>

        {/* Campo de Busca */}
        <View style={styles.searchBox}>
          <Search size={18} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por código, nome ou fazenda..."
            placeholderTextColor="#94a3b8"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <X size={16} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>

        {/* Filtros em Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {[
            { id: "TODOS", label: "Todos", count: pivots.length },
            {
              id: "IRRIGANDO",
              label: "Irrigando",
              count: pivots.filter((p) => p.status_operacional === "IRRIGANDO" || p.status_operacional === "FERTIRRIGANDO").length,
            },
            {
              id: "PARADO",
              label: "Parados",
              count: pivots.filter((p) => p.status_operacional === "PARADO").length,
            },
            {
              id: "FALHA",
              label: "Falhas",
              count: pivots.filter((p) => p.status_operacional === "FALHA").length,
            },
          ].map((f) => (
            <TouchableOpacity
              key={f.id}
              style={[
                styles.filterChip,
                filter === f.id && styles.filterChipActive,
              ]}
              onPress={() => setFilter(f.id)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  filter === f.id && styles.filterChipTextActive,
                ]}
              >
                {f.label} ({f.count})
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Lista de Cards de Pivôs */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#10b981" />
          <Text style={styles.loadingText}>Carregando pivôs...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredPivots}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={["#10b981"]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <CircleGauge size={44} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>Nenhum pivô encontrado</Text>
              <Text style={styles.emptySubtitle}>
                Puxe para baixo para atualizar ou verifique seus filtros.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const st = getStatusConfig(item.status_operacional);
            const percent = Number(item.percentimetro_atual) || 0;

            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => onSelectPivot(item)}
                activeOpacity={0.85}
              >
                {/* Linha Superior: Código, Fazenda e Status */}
                <View style={styles.cardHeader}>
                  <View style={styles.cardLeftHeader}>
                    <View style={styles.pivotIconBadge}>
                      <CircleGauge size={20} color="#10b981" strokeWidth={2.2} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.codeRow}>
                        <Text style={styles.cardCode}>{item.codigo}</Text>
                        {item.area_irrigada_ha ? (
                          <View style={styles.areaBadge}>
                            <Text style={styles.areaBadgeText}>{item.area_irrigada_ha} ha</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.cardName} numberOfLines={1}>
                        {item.nome}
                      </Text>
                      <View style={styles.farmRow}>
                        <Building2 size={12} color="#64748b" />
                        <Text style={styles.cardFarm} numberOfLines={1}>
                          {item.fazenda_nome || "Fazenda Principal"}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.statusPill,
                      { backgroundColor: st.bg, borderColor: st.border },
                    ]}
                  >
                    <View style={[styles.statusDot, { backgroundColor: st.dot }]} />
                    <Text style={[styles.statusPillText, { color: st.text }]}>
                      {st.label}
                    </Text>
                  </View>
                </View>

                {/* Barra de Percentímetro Dinâmica */}
                <View style={styles.percentContainer}>
                  <View style={styles.percentHeaderRow}>
                    <Text style={styles.percentLabel}>Percentímetro</Text>
                    <Text style={styles.percentVal}>{percent}%</Text>
                  </View>
                  <View style={styles.percentBarTrack}>
                    <View
                      style={[
                        styles.percentBarFill,
                        {
                          width: `${Math.min(Math.max(percent, 0), 100)}%`,
                          backgroundColor: st.dot,
                        },
                      ]}
                    />
                  </View>
                </View>

                {/* Métricas Principais (3 Colunas Elegantes) */}
                <View style={styles.metricsGrid}>
                  <View style={styles.metricCard}>
                    <View style={styles.metricIconBox}>
                      <Droplets size={14} color="#0284c7" />
                    </View>
                    <Text style={styles.metricLabel}>Lâmina Atual</Text>
                    <Text style={styles.metricValue}>
                      {item.lamina_atual_mm ? `${item.lamina_atual_mm} mm` : "—"}
                    </Text>
                  </View>

                  <View style={styles.metricCard}>
                    <View style={styles.metricIconBox}>
                      <Compass size={14} color="#d97706" />
                    </View>
                    <Text style={styles.metricLabel}>Ângulo Atual</Text>
                    <Text style={styles.metricValue}>
                      {item.angulo_atual_graus !== undefined ? `${item.angulo_atual_graus}°` : "—"}
                    </Text>
                  </View>

                  <View style={styles.metricCard}>
                    <View style={styles.metricIconBox}>
                      <RotateCw size={14} color="#16a34a" />
                    </View>
                    <Text style={styles.metricLabel}>Sentido</Text>
                    <Text style={styles.metricValue}>
                      {item.sentido_rotacao === "ANTI_HORARIO" ? "Anti-horário" : "Horário"}
                    </Text>
                  </View>
                </View>

                {/* Rodapé do Card com Ações Rápidas */}
                <View style={styles.cardActionsRow}>
                  <TouchableOpacity
                    style={styles.cardActionBtn}
                    onPress={() => onOpenNewIrrigation(item)}
                    activeOpacity={0.7}
                  >
                    <Droplets size={14} color="#10b981" />
                    <Text style={styles.cardActionBtnText}>Apontar Irrigação</Text>
                  </TouchableOpacity>

                  <View style={styles.detailLink}>
                    <Text style={styles.detailLinkText}>Ver Detalhes</Text>
                    <ChevronRight size={16} color="#64748b" />
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  headerArea: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.3,
  },
  screenSubtitle: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  newIrrigationBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#10b981",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  newIrrigationBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#0f172a",
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  filterChipActive: {
    backgroundColor: "#10b981",
    borderColor: "#10b981",
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
  },
  filterChipTextActive: {
    color: "#ffffff",
    fontWeight: "700",
  },
  listContent: {
    padding: 16,
    gap: 14,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  cardLeftHeader: {
    flex: 1,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  pivotIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardCode: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.2,
  },
  areaBadge: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  areaBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
  },
  cardName: {
    fontSize: 13,
    color: "#334155",
    fontWeight: "600",
    marginTop: 2,
  },
  farmRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 3,
  },
  cardFarm: {
    fontSize: 11,
    color: "#64748b",
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  percentContainer: {
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  percentHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  percentLabel: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  percentVal: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0f172a",
  },
  percentBarTrack: {
    height: 6,
    backgroundColor: "#f1f5f9",
    borderRadius: 3,
    overflow: "hidden",
  },
  percentBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  metricsGrid: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  metricCard: {
    flex: 1,
    backgroundColor: "#f8fafc",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    alignItems: "center",
  },
  metricIconBox: {
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 10,
    color: "#64748b",
    fontWeight: "600",
  },
  metricValue: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0f172a",
    marginTop: 2,
  },
  cardActionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  cardActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "rgba(16, 185, 129, 0.08)",
  },
  cardActionBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#059669",
  },
  detailLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  detailLinkText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 8,
    color: "#64748b",
    fontSize: 13,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#334155",
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
  },
});
