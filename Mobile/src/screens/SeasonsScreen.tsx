import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  ScrollView,
  RefreshControl,
  useWindowDimensions,
} from "react-native";
import {
  Calendar,
  Search,
  X,
  Building2,
  CalendarDays,
  Clock,
  RefreshCw,
} from "lucide-react-native";
import { MobileSeason, MobileFarm } from "../types";
import { localDb } from "../database/sqlite";

interface SeasonsScreenProps {
  onOpenNewPlan?: (seasonId?: string) => void;
}

export function SeasonsScreen({ onOpenNewPlan }: SeasonsScreenProps) {
  const { width: screenWidth } = useWindowDimensions();
  const isDesktop = screenWidth >= 768;

  const [seasons, setSeasons] = useState<MobileSeason[]>([]);
  const [farms, setFarms] = useState<MobileFarm[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("TODAS");

  const loadData = async () => {
    try {
      const [sData, fData] = await Promise.all([
        localDb.getSeasons(),
        localDb.getFarms(),
      ]);
      setSeasons(sData);
      setFarms(fData);
    } catch (err) {
      console.warn("Erro ao carregar safras:", err);
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
    await loadData();
  };

  const filteredSeasons = seasons.filter((s) => {
    const matchesSearch = s.nome.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;
    if (statusFilter === "TODAS") return true;
    if (statusFilter === "ATIVAS") return s.ativa;
    if (statusFilter === "EM_ANDAMENTO") return s.status === "EM_ANDAMENTO";
    if (statusFilter === "CONCLUIDAS") return s.status === "ENCERRADA";
    return true;
  });

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "—";
    try {
      const parts = dateStr.split("T")[0].split("-");
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const getStatusBadge = (status: string, ativa: boolean) => {
    if (status === "EM_ANDAMENTO" || (ativa && status !== "ENCERRADA")) {
      return {
        label: "Em Andamento",
        bg: "#ecfdf5",
        text: "#047857",
        border: "#10b981",
      };
    }
    if (status === "PLANEJADA") {
      return {
        label: "Planejada",
        bg: "#eff6ff",
        text: "#1e40af",
        border: "#3b82f6",
      };
    }
    if (status === "ENCERRADA" || status === "CONCLUIDA") {
      return {
        label: "Concluída",
        bg: "#f8fafc",
        text: "#475569",
        border: "#cbd5e1",
      };
    }
    return {
      label: status || "Ativa",
      bg: "#f1f5f9",
      text: "#475569",
      border: "#cbd5e1",
    };
  };

  return (
    <View style={styles.container}>
      {/* 1. Header Padronizado */}
      <View style={styles.screenHeader}>
        <View style={styles.screenTitleRow}>
          <View style={styles.screenTitleGroup}>
            <View style={styles.screenIconBox}>
              <Calendar size={20} color="#10b981" />
            </View>
            <View>
              <Text style={styles.screenTitle}>Gestão de Safras</Text>
              <Text style={styles.screenSubtitle}>
                {seasons.length} ciclo(s) agrícola(s) cadastrado(s)
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.refreshButton}
            onPress={handleRefresh}
            activeOpacity={0.7}
          >
            <RefreshCw size={16} color="#64748b" />
          </TouchableOpacity>
        </View>

        {/* 2. Barra de Busca Padronizada */}
        <View style={styles.searchBarContainer}>
          <View style={styles.searchBox}>
            <Search size={18} color="#94a3b8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar safra por nome ou ano agrícola..."
              placeholderTextColor="#94a3b8"
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={16} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* 3. Filtros em Pills Padronizados */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterChipScroll}
          contentContainerStyle={styles.filterChipContent}
        >
          {[
            { id: "TODAS", label: "Todas" },
            { id: "ATIVAS", label: "Ativas" },
            { id: "EM_ANDAMENTO", label: "Em Andamento" },
            { id: "CONCLUIDAS", label: "Concluídas" },
          ].map((st) => (
            <TouchableOpacity
              key={st.id}
              style={[styles.filterChip, statusFilter === st.id && styles.filterChipActive]}
              onPress={() => setStatusFilter(st.id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterChipText, statusFilter === st.id && styles.filterChipTextActive]}>
                {st.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* 4. Lista e Cards Padronizados */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#1b7d52" />
          <Text style={styles.loadingText}>Carregando safras...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredSeasons}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, isDesktop && styles.listContentDesktop]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={["#10b981"]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconBox}>
                <Calendar size={36} color="#94a3b8" />
              </View>
              <Text style={styles.emptyTitle}>Nenhuma safra encontrada</Text>
              <Text style={styles.emptySubtitle}>
                {search.length > 0
                  ? "Tente alterar os termos de busca para localizar a safra."
                  : "Nenhum ciclo agrícola disponível no momento."}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const badge = getStatusBadge(item.status, item.ativa);
            return (
              <View style={[styles.recordCard, isDesktop && styles.recordCardDesktop]}>
                {/* Header do Card */}
                <View style={styles.cardHeaderRow}>
                  <View style={styles.cardTitleGroup}>
                    <View style={styles.cardIconBox}>
                      <CalendarDays size={18} color="#10b981" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {item.nome}
                      </Text>
                      <Text style={styles.cardSubtitle}>
                        {item.fazenda_nome ? `Fazenda: ${item.fazenda_nome}` : "Abrangência Geral da Safra"}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: badge.bg, borderColor: badge.border },
                    ]}
                  >
                    <Text style={[styles.statusBadgeText, { color: badge.text }]}>
                      {badge.label}
                    </Text>
                  </View>
                </View>

                {/* Grid de Métricas */}
                <View style={styles.metricsGrid}>
                  <View style={styles.metricsCol}>
                    <Text style={styles.metricsColLabel}>INÍCIO</Text>
                    <Text style={styles.metricsColValue}>{formatDate(item.data_inicio)}</Text>
                  </View>
                  <View style={styles.metricsCol}>
                    <Text style={styles.metricsColLabel}>TÉRMINO</Text>
                    <Text style={styles.metricsColValue}>{formatDate(item.data_fim)}</Text>
                  </View>
                  <View style={styles.metricsCol}>
                    <Text style={styles.metricsColLabel}>SITUAÇÃO</Text>
                    <Text style={[styles.metricsColValue, item.ativa ? { color: "#059669" } : { color: "#64748b" }]}>
                      {item.ativa ? "Ciclo Vigente" : "Inativa"}
                    </Text>
                  </View>
                </View>

                {/* Rodapé do Card */}
                <View style={styles.cardFooter}>
                  <View style={styles.footerInfoItem}>
                    <Clock size={13} color="#64748b" />
                    <Text style={styles.footerInfoText}>
                      Ciclo {item.nome}
                    </Text>
                  </View>
                  {item.fazenda_nome && (
                    <View style={styles.footerInfoItem}>
                      <Building2 size={13} color="#64748b" />
                      <Text style={styles.footerInfoText}>{item.fazenda_nome}</Text>
                    </View>
                  )}
                </View>
              </View>
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
  // Header da Tela
  screenHeader: {
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  screenTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  screenTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  screenIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    alignItems: "center",
    justifyContent: "center",
  },
  screenTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.3,
  },
  screenSubtitle: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 1,
  },
  refreshButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  // Barra de Busca
  searchBarContainer: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#0f172a",
    paddingVertical: 0,
  },
  // Chips de Filtro
  filterChipScroll: {
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    maxHeight: 44,
  },
  filterChipContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: "#f1f5f9",
  },
  filterChipActive: {
    backgroundColor: "#1b7d52",
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#475569",
  },
  filterChipTextActive: {
    color: "#ffffff",
    fontWeight: "bold",
  },
  // Lista
  listContent: {
    padding: 14,
    gap: 12,
  },
  listContentDesktop: {
    maxWidth: 960,
    width: "100%",
    alignSelf: "center",
  },
  // Card Padronizado
  recordCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  recordCardDesktop: {
    maxWidth: 960,
    width: "100%",
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  cardTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  cardIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
  },
  cardSubtitle: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  // Grid de Métricas
  metricsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  metricsCol: {
    flex: 1,
  },
  metricsColLabel: {
    fontSize: 9,
    color: "#64748b",
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  metricsColValue: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0f172a",
    marginTop: 2,
  },
  // Rodapé do Card
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 8,
  },
  footerInfoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  footerInfoText: {
    fontSize: 11,
    color: "#64748b",
  },
  // Carregamento e Vazio
  centerContainer: {
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
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#334155",
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
    maxWidth: 280,
  },
});
