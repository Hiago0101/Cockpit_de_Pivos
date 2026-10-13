import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
} from "react-native";
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
  const [filter, setFilter] = useState<string>("TODOS");
  const [search, setSearch] = useState("");
  const [pendingCount, setPendingCount] = useState(0);

  const loadData = async () => {
    setLoading(true);
    const data = await localDb.getPivots();
    setPivots(data);
    const count = await localDb.getQueueCount();
    setPendingCount(count);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSyncNow = async () => {
    setLoading(true);
    await syncManager.syncAll();
    await loadData();
    setLoading(false);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "IRRIGANDO":
      case "FERTIRRIGANDO":
        return "#1b7d52"; // verde agrícola
      case "PARADO":
        return "#64748b"; // cinza
      case "FALHA":
        return "#dc2626"; // vermelho risco
      default:
        return "#f59e0b"; // atenção
    }
  };

  return (
    <View style={styles.container}>
      {/* Barra de Status e Sincronização */}
      <View style={styles.syncBar}>
        <View style={styles.syncInfo}>
          <Text style={styles.syncTitle}>Cockpit de Campo</Text>
          <Text style={styles.syncSubtitle}>
            {pendingCount > 0 ? `${pendingCount} ações pendentes de envio` : "Base local sincronizada"}
          </Text>
        </View>
        <TouchableOpacity style={styles.syncButton} onPress={handleSyncNow}>
          <Text style={styles.syncButtonText}>Sincronizar</Text>
        </TouchableOpacity>
      </View>

      {/* Busca Rápida */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por código, nome ou fazenda..."
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Filtros de Status */}
      <View style={styles.filterRow}>
        {["TODOS", "IRRIGANDO", "PARADO", "FALHA"].map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterTabText, filter === f && styles.filterTabTextActive]}>
              {f}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Lista de Pivôs */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1b7d52" />
          <Text style={styles.loadingText}>Carregando pivôs...</Text>
        </View>
      ) : filteredPivots.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>Nenhum pivô encontrado</Text>
          <Text style={styles.emptySubtitle}>
            {pivots.length === 0
              ? "Toque em Sincronizar para baixar a lista de pivôs do servidor central."
              : "Tente alterar os filtros de busca."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredPivots}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const statusColor = getStatusColor(item.status_operacional);
            return (
              <TouchableOpacity style={styles.card} onPress={() => onSelectPivot(item)}>
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.cardCode}>{item.codigo}</Text>
                    <Text style={styles.cardName}>{item.nome}</Text>
                    <Text style={styles.cardFarm}>{item.fazenda_nome || "Fazenda Principal"}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
                    <Text style={styles.statusBadgeText}>{item.status_display || item.status_operacional}</Text>
                  </View>
                </View>

                <View style={styles.cardDivider} />

                <View style={styles.cardMetrics}>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Percentímetro</Text>
                    <Text style={styles.metricValue}>{item.percentimetro_atual}%</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Lâmina Aplicada</Text>
                    <Text style={styles.metricValue}>{item.lamina_atual_mm} mm</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Ângulo Atual</Text>
                    <Text style={styles.metricValue}>{item.angulo_atual_graus}°</Text>
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
    backgroundColor: "#f4f6f8",
  },
  syncBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#132a22",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  syncInfo: {
    flex: 1,
  },
  syncTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  syncSubtitle: {
    color: "#a3b8b0",
    fontSize: 12,
    marginTop: 2,
  },
  syncButton: {
    backgroundColor: "#2e6f40",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
  },
  syncButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  searchInput: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    borderColor: "#e2e8f0",
    borderWidth: 1,
  },
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#e2e8f0",
  },
  filterTabActive: {
    backgroundColor: "#1b7d52",
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  filterTabTextActive: {
    color: "#ffffff",
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    padding: 16,
    borderColor: "#e2e8f0",
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  cardCode: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  cardName: {
    fontSize: 14,
    color: "#334155",
    marginTop: 2,
  },
  cardFarm: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
  },
  cardDivider: {
    height: 1,
    backgroundColor: "#f1f5f9",
    marginVertical: 12,
  },
  cardMetrics: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  metricItem: {
    alignItems: "center",
  },
  metricLabel: {
    fontSize: 11,
    color: "#64748b",
  },
  metricValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1e293b",
    marginTop: 2,
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
    padding: 24,
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
    marginTop: 6,
  },
});
