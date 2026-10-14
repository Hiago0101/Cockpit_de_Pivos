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
  useWindowDimensions,
} from "react-native";
import {
  Sprout,
  Search,
  X,
  Building2,
  Copy,
  Check,
  RefreshCw,
} from "lucide-react-native";
import { MobileCrop, MobileFarm } from "../types";
import { localDb } from "../database/sqlite";

export function CropsScreen() {
  const { width: screenWidth } = useWindowDimensions();
  const isDesktop = screenWidth >= 768;

  const [crops, setCrops] = useState<MobileCrop[]>([]);
  const [farms, setFarms] = useState<MobileFarm[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [cData, fData] = await Promise.all([
        localDb.getCrops(),
        localDb.getFarms(),
      ]);
      setCrops(cData);
      setFarms(fData);
    } catch (err) {
      console.warn("Erro ao carregar culturas:", err);
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

  const handleCopy = (id: string) => {
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredCrops = crops.filter((c) => {
    const desc = c.descricao || "";
    const pims = c.id_pims || "";
    const farmNome = c.fazenda_nome || "";
    const term = search.toLowerCase();
    return (
      desc.toLowerCase().includes(term) ||
      pims.toLowerCase().includes(term) ||
      farmNome.toLowerCase().includes(term)
    );
  });

  const getCropColor = (name?: string) => {
    const upper = (name || "").toUpperCase();
    if (upper.includes("SOJA")) return { bg: "#ecfdf5", text: "#065f46", border: "#10b981", badge: "#059669" };
    if (upper.includes("MILHO")) return { bg: "#fffbeb", text: "#92400e", border: "#f59e0b", badge: "#d97706" };
    if (upper.includes("FEIJ")) return { bg: "#ecfeff", text: "#155e75", border: "#06b6d4", badge: "#0891b2" };
    if (upper.includes("ALGOD")) return { bg: "#faf5ff", text: "#6b21a8", border: "#a855f7", badge: "#9333ea" };
    if (upper.includes("SORGO")) return { bg: "#fff7ed", text: "#9a3412", border: "#f97316", badge: "#ea580c" };
    if (upper.includes("TRIGO")) return { bg: "#fefce8", text: "#854d0e", border: "#eab308", badge: "#ca8a04" };
    return { bg: "#eff6ff", text: "#1e40af", border: "#3b82f6", badge: "#2563eb" };
  };

  return (
    <View style={styles.container}>
      {/* 1. Header Padronizado */}
      <View style={styles.screenHeader}>
        <View style={styles.screenTitleRow}>
          <View style={styles.screenTitleGroup}>
            <View style={styles.screenIconBox}>
              <Sprout size={20} color="#10b981" />
            </View>
            <View>
              <Text style={styles.screenTitle}>Gestão de Culturas</Text>
              <Text style={styles.screenSubtitle}>
                {crops.length} cultura(s) agrícola(s) cadastrada(s)
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.refreshButton}
            onPress={handleRefresh}
            disabled={loading}
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
              placeholder="Buscar cultura por nome ou ID PIMS..."
              placeholderTextColor="#94a3b8"
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={16} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* 3. Lista e Cards Padronizados */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#1b7d52" />
          <Text style={styles.loadingText}>Carregando culturas...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredCrops}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, isDesktop && styles.listContentDesktop]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={["#10b981"]}
            />
          }
          renderItem={({ item }) => {
            const theme = getCropColor(item.descricao);
            const farmNome = item.fazenda_nome || (item.fazenda ? farms.find((f) => f.id === item.fazenda)?.nome : null) || "Catálogo Geral";

            return (
              <View style={[styles.recordCard, isDesktop && styles.recordCardDesktop]}>
                {/* Linha Superior: Ícone + Título + Badge de Tipo */}
                <View style={styles.cardHeaderRow}>
                  <View style={styles.cardTitleGroup}>
                    <View style={[styles.cardIconBox, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                      <Sprout size={18} color={theme.text} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {item.descricao}
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                        <Building2 size={12} color="#64748b" />
                        <Text style={styles.cardSubtitle} numberOfLines={1}>
                          {farmNome}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={[styles.typeBadge, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                    <Text style={[styles.typeBadgeText, { color: theme.text }]}>AGRÍCOLA</Text>
                  </View>
                </View>

                {/* Grade de Métricas Padronizada (3 colunas) */}
                <View style={styles.metricsGrid}>
                  <View style={styles.metricCol}>
                    <Text style={styles.metricLabel}>CULTURA</Text>
                    <Text style={styles.metricValue} numberOfLines={1}>
                      {item.descricao}
                    </Text>
                  </View>
                  <View style={styles.metricCol}>
                    <Text style={styles.metricLabel}>CÓDIGO PIMS</Text>
                    <Text style={styles.metricValue} numberOfLines={1}>
                      {item.id_pims || "—"}
                    </Text>
                  </View>
                  <View style={styles.metricCol}>
                    <Text style={styles.metricLabel}>UNIDADE</Text>
                    <Text style={styles.metricValue} numberOfLines={1}>
                      {item.fazenda ? "Por Fazenda" : "Geral"}
                    </Text>
                  </View>
                </View>

                {/* Rodapé: ID do Sistema com botão de cópia */}
                <View style={styles.cardFooter}>
                  <View style={styles.idGroup}>
                    <Text style={styles.idLabel}>ID:</Text>
                    <Text style={styles.idValue} numberOfLines={1}>
                      {item.id.slice(0, 10)}...
                    </Text>
                    <TouchableOpacity
                      style={styles.copyBtn}
                      onPress={() => handleCopy(item.id)}
                      activeOpacity={0.7}
                    >
                      {copiedId === item.id ? (
                        <Check size={12} color="#10b981" />
                      ) : (
                        <Copy size={12} color="#64748b" />
                      )}
                      <Text style={styles.copyBtnText}>
                        {copiedId === item.id ? "Copiado!" : "Copiar"}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.statusPill}>
                    <Text style={styles.statusPillText}>Ativa</Text>
                  </View>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconBox}>
                <Sprout size={36} color="#94a3b8" />
              </View>
              <Text style={styles.emptyTitle}>Nenhuma cultura encontrada</Text>
              <Text style={styles.emptySubtitle}>
                {search.length > 0
                  ? "Tente refinar sua busca por nome ou código PIMS."
                  : "Nenhuma cultura agronômica sincronizada no catálogo."}
              </Text>
            </View>
          }
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
  screenHeader: {
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  screenTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  screenTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  screenIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
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
    marginTop: 2,
    fontWeight: "500",
  },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  searchBarContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
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

  // Conteúdo da Lista e Cards
  listContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 32,
  },
  listContentDesktop: {
    alignItems: "center",
  },
  recordCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  recordCardDesktop: {
    maxWidth: 960,
    width: "100%",
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  cardTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  cardIconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
  },
  cardSubtitle: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "500",
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  // Grade de Métricas
  metricsGrid: {
    flexDirection: "row",
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    padding: 10,
    marginBottom: 12,
  },
  metricCol: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0f172a",
  },

  // Rodapé do Card
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 10,
  },
  idGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  idLabel: {
    fontSize: 10,
    color: "#94a3b8",
    fontWeight: "600",
  },
  idValue: {
    fontSize: 11,
    fontFamily: "monospace",
    color: "#64748b",
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "#f1f5f9",
  },
  copyBtnText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748b",
  },
  statusPill: {
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#047857",
  },

  // Estados Centrais e Vazios
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: "#64748b",
    fontWeight: "500",
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
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 18,
  },
});
