import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert,
} from "react-native";
import { MobileCropPlan, CropPlanStatus, PendingSyncItem, MobileFarm, MobileSeason } from "../types";
import { localDb } from "../database/sqlite";
import { syncManager } from "../services/syncManager";

interface PlanningScreenProps {
  onOpenSync: () => void;
  userRole?: string;
}

type ViewMode = "GANTT" | "LISTA";
type GanttSubMode = "TIMELINE" | "SEQUENCE";

interface FreeInterval {
  id: string;
  pivo_id: string;
  pivo_codigo: string;
  start: string;
  end: string;
  dias: number;
  cultura_ant: string;
  cultura_prox: string;
}

interface ConflictInterval {
  id: string;
  pivo_id: string;
  pivo_codigo: string;
  start: string;
  end: string;
  dias_sobreposicao: number;
  cultura1: string;
  cultura2: string;
}

// Cores temáticas para culturas agrícolas no celular
const CROP_MOBILE_COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  SOJA: { bg: "#ecfdf5", border: "#10b981", text: "#065f46", badge: "#059669" },
  MILHO: { bg: "#fffbeb", border: "#f59e0b", text: "#92400e", badge: "#d97706" },
  FEIJÃO: { bg: "#ecfeff", border: "#06b6d4", text: "#155e75", badge: "#0891b2" },
  FEIJAO: { bg: "#ecfeff", border: "#06b6d4", text: "#155e75", badge: "#0891b2" },
  ALGODÃO: { bg: "#faf5ff", border: "#a855f7", text: "#6b21a8", badge: "#9333ea" },
  ALGODAO: { bg: "#faf5ff", border: "#a855f7", text: "#6b21a8", badge: "#9333ea" },
  SORGO: { bg: "#fff7ed", border: "#f97316", text: "#9a3412", badge: "#ea580c" },
  TRIGO: { bg: "#fefce8", border: "#eab308", text: "#854d0e", badge: "#ca8a04" },
  DEFAULT: { bg: "#eff6ff", border: "#3b82f6", text: "#1e40af", badge: "#2563eb" },
};

function getCropColors(name: string) {
  const upper = (name || "").toUpperCase();
  for (const k of Object.keys(CROP_MOBILE_COLORS)) {
    if (upper.includes(k)) return CROP_MOBILE_COLORS[k];
  }
  return CROP_MOBILE_COLORS.DEFAULT;
}

export function PlanningScreen({ onOpenSync, userRole = "OPERADOR" }: PlanningScreenProps) {
  const [plans, setPlans] = useState<MobileCropPlan[]>([]);
  const [farms, setFarms] = useState<MobileFarm[]>([]);
  const [seasons, setSeasons] = useState<MobileSeason[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Modos de visualização
  const [viewMode, setViewMode] = useState<ViewMode>("GANTT");
  const [ganttSubMode, setGanttSubMode] = useState<GanttSubMode>("TIMELINE");

  // Filtros
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("TODOS");
  const [farmFilter, setFarmFilter] = useState<string>("TODAS");
  const [seasonFilter, setSeasonFilter] = useState<string>("TODAS");

  // Interação e sincronização
  const [selectedPlan, setSelectedPlan] = useState<MobileCropPlan | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [conflictCount, setConflictCount] = useState(0);
  const [conflictQueue, setConflictQueue] = useState<PendingSyncItem[]>([]);
  const [resolvingOpId, setResolvingOpId] = useState<string | null>(null);

  const isConsultor = userRole === "CONSULTOR";

  const loadData = async () => {
    setLoading(true);
    const [pData, fData, sData, count, conflicts] = await Promise.all([
      localDb.getPlans(),
      localDb.getFarms(),
      localDb.getSeasons(),
      localDb.getQueueCount(),
      localDb.getConflictQueue(),
    ]);
    setPlans(pData);
    setFarms(fData);
    setSeasons(sData);
    setPendingCount(count);
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
      `Deseja ${actionNames[nextStatus] || nextStatus} para "${plan.cultura_nome}" (${plan.alvo_nome})?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Confirmar",
          onPress: async () => {
            const todayStr = new Date().toISOString().split("T")[0];
            const updated = await localDb.updateLocalPlanStatus(
              plan.id,
              nextStatus,
              `Alteração operacional em campo por perfil ${userRole}`,
              todayStr
            );
            if (updated) {
              setSelectedPlan(updated);
              await loadData();
              Alert.alert("Registrado", "Status operacional atualizado e gravado offline.");
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
      `Deseja descartar a alteração pendente de "${planName}"?`,
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

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "—";
    const parts = dateStr.split("-");
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0].slice(-2)}`;
    return dateStr;
  };

  const formatShortMonth = (dateStr?: string | null) => {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
    return dateStr;
  };

  // Planos filtrados para a Lista
  const filteredPlans = useMemo(() => {
    return plans.filter((p) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        p.cultura_nome.toLowerCase().includes(q) ||
        p.safra_nome.toLowerCase().includes(q) ||
        p.fazenda_nome.toLowerCase().includes(q) ||
        p.alvo_nome.toLowerCase().includes(q);

      if (!matchesSearch) return false;
      if (farmFilter !== "TODAS" && p.fazenda !== farmFilter && p.fazenda_nome !== farmFilter) return false;
      if (seasonFilter !== "TODAS" && p.safra !== seasonFilter && p.safra_nome !== seasonFilter) return false;
      if (statusFilter !== "TODOS" && p.status !== statusFilter) return false;
      return true;
    });
  }, [plans, search, farmFilter, seasonFilter, statusFilter]);

  // Agrupamento por Pivô / Unidade para o Gantt
  const pivotGroups = useMemo(() => {
    const map = new Map<string, {
      pivoId: string;
      codigo: string;
      alvoNome: string;
      fazendaNome: string;
      plans: MobileCropPlan[];
      freeIntervals: FreeInterval[];
      conflicts: ConflictInterval[];
      semFuturoApos: string | null;
    }>();

    // Filtra apenas planos ativos para cálculo cronológico do Gantt (cancelados não entram na sequência)
    const activePlans = plans.filter((p) => {
      if (p.status === "CANCELADO") return false;
      if (farmFilter !== "TODAS" && p.fazenda !== farmFilter && p.fazenda_nome !== farmFilter) return false;
      if (seasonFilter !== "TODAS" && p.safra !== seasonFilter && p.safra_nome !== seasonFilter) return false;
      return true;
    });

    for (const p of activePlans) {
      const key = p.pivo || p.talhao || p.alvo_nome;
      if (!map.has(key)) {
        map.set(key, {
          pivoId: key,
          codigo: p.pivo_codigo || p.alvo_nome,
          alvoNome: p.alvo_nome,
          fazendaNome: p.fazenda_nome,
          plans: [],
          freeIntervals: [],
          conflicts: [],
          semFuturoApos: null,
        });
      }
      map.get(key)!.plans.push(p);
    }

    // Calcula intervalos livres e conflitos para cada pivô
    for (const group of map.values()) {
      group.plans.sort((a, b) => {
        const startA = a.data_plantio_real || a.data_plantio;
        const startB = b.data_plantio_real || b.data_plantio;
        return startA.localeCompare(startB);
      });

      for (let i = 0; i < group.plans.length - 1; i++) {
        const curr = group.plans[i];
        const next = group.plans[i + 1];

        const fimCurrStr = curr.data_colheita_real || curr.data_colheita_prevista;
        const iniNextStr = next.data_plantio_real || next.data_plantio;

        const fimCurr = new Date(fimCurrStr + "T00:00:00").getTime();
        const iniNext = new Date(iniNextStr + "T00:00:00").getTime();
        const deltaDias = Math.round((iniNext - fimCurr) / (1000 * 60 * 60 * 24));

        if (deltaDias > 0) {
          group.freeIntervals.push({
            id: `livre-${curr.id}-${next.id}`,
            pivo_id: group.pivoId,
            pivo_codigo: group.codigo,
            start: fimCurrStr,
            end: iniNextStr,
            dias: deltaDias,
            cultura_ant: curr.cultura_nome,
            cultura_prox: next.cultura_nome,
          });
        } else if (deltaDias < 0) {
          group.conflicts.push({
            id: `conf-${curr.id}-${next.id}`,
            pivo_id: group.pivoId,
            pivo_codigo: group.codigo,
            start: iniNextStr,
            end: fimCurrStr,
            dias_sobreposicao: Math.abs(deltaDias),
            cultura1: curr.cultura_nome,
            cultura2: next.cultura_nome,
          });
        }
      }

      if (group.plans.length > 0) {
        const last = group.plans[group.plans.length - 1];
        group.semFuturoApos = last.data_colheita_real || last.data_colheita_prevista;
      }
    }

    return Array.from(map.values());
  }, [plans, farmFilter, seasonFilter]);

  // Colunas mensais para a régua horizontal do Gantt mobile
  const timelineMonths = useMemo(() => {
    const list: Array<{ label: string; yearMonth: string; start: Date; end: Date }> = [];
    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    
    // Inicia 3 meses atrás e projeta 12 meses para frente para cobrir o ciclo agrícola atual
    const baseDate = new Date();
    baseDate.setDate(1);
    baseDate.setMonth(baseDate.getMonth() - 2);

    for (let i = 0; i < 14; i++) {
      const cur = new Date(baseDate.getFullYear(), baseDate.getMonth() + i, 1);
      const next = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
      list.push({
        label: `${monthNames[cur.getMonth()]}/${String(cur.getFullYear()).slice(-2)}`,
        yearMonth: `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`,
        start: cur,
        end: next,
      });
    }
    return list;
  }, []);

  const timelineStart = timelineMonths[0]?.start || new Date();
  const timelineEnd = timelineMonths[timelineMonths.length - 1]?.end || new Date();
  const totalTimelineDays = Math.max(1, Math.round((timelineEnd.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24)));
  const COLUMN_WIDTH = 95; // Largura amigável para toque e leitura no celular
  const TOTAL_TIMELINE_WIDTH = timelineMonths.length * COLUMN_WIDTH;

  // Função para converter datas em posição X e largura no gráfico móvel
  const getPositionX = (startDateStr: string, endDateStr: string) => {
    const s = new Date(startDateStr + "T00:00:00").getTime();
    const e = new Date(endDateStr + "T00:00:00").getTime();
    const startT = timelineStart.getTime();

    const diffStartDays = (s - startT) / (1000 * 60 * 60 * 24);
    const durationDays = Math.max(2, (e - s) / (1000 * 60 * 60 * 24));

    const left = (diffStartDays / totalTimelineDays) * TOTAL_TIMELINE_WIDTH;
    const width = Math.max(28, (durationDays / totalTimelineDays) * TOTAL_TIMELINE_WIDTH);

    return { left, width, days: Math.round(durationDays) };
  };

  const activeConflictForModal = selectedPlan ? getConflictForPlan(selectedPlan.id) : undefined;

  return (
    <View style={styles.container}>
      {/* 1. Barra de Sincronização e Status */}
      <View style={styles.syncBar}>
        <TouchableOpacity style={styles.syncInfo} onPress={onOpenSync} activeOpacity={0.7}>
          <Text style={styles.syncTitle}>Planejamento de Plantio</Text>
          <View style={styles.syncSubRow}>
            <Text style={styles.syncSubtitle}>
              {pendingCount > 0 ? `${pendingCount} alteração(ões) pendente(s)` : "Base de dados offline"}
            </Text>
            {conflictCount > 0 && (
              <View style={styles.syncConflictBadge}>
                <Text style={styles.syncConflictBadgeText}>⚠️ {conflictCount} conflito(s)</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.syncButton} onPress={handleSyncNow} disabled={syncing}>
          {syncing ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.syncButtonText}>Sincronizar</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* 2. Seletor de Modo Principal: Gráfico Gantt vs Lista Detalhada */}
      <View style={styles.viewModeBar}>
        <TouchableOpacity
          style={[styles.viewModeTab, viewMode === "GANTT" && styles.viewModeTabActive]}
          onPress={() => setViewMode("GANTT")}
        >
          <Text style={[styles.viewModeTabText, viewMode === "GANTT" && styles.viewModeTabTextActive]}>
            📊 Gráfico Gantt dos Pivôs
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.viewModeTab, viewMode === "LISTA" && styles.viewModeTabActive]}
          onPress={() => setViewMode("LISTA")}
        >
          <Text style={[styles.viewModeTabText, viewMode === "LISTA" && styles.viewModeTabTextActive]}>
            📋 Lista ({filteredPlans.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* 3. Filtros Rápidos de Fazenda */}
      {farms.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterChipScroll} contentContainerStyle={styles.filterChipContent}>
          <TouchableOpacity
            style={[styles.chipPill, farmFilter === "TODAS" && styles.chipPillActive]}
            onPress={() => setFarmFilter("TODAS")}
          >
            <Text style={[styles.chipPillText, farmFilter === "TODAS" && styles.chipPillTextActive]}>
              Todas as Fazendas
            </Text>
          </TouchableOpacity>
          {farms.map((f) => (
            <TouchableOpacity
              key={f.id}
              style={[styles.chipPill, (farmFilter === f.id || farmFilter === f.nome) && styles.chipPillActive]}
              onPress={() => setFarmFilter(f.id)}
            >
              <Text style={[styles.chipPillText, (farmFilter === f.id || farmFilter === f.nome) && styles.chipPillTextActive]}>
                {f.nome}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* =========================================================================
          MODO GANTT MOBILE: VISUALIZAÇÃO OTIMIZADA PARA TELAS DE CELULAR
         ========================================================================= */}
      {viewMode === "GANTT" ? (
        <View style={styles.ganttContainer}>
          {/* Sub-seletor de modo do Gantt: Linha do Tempo contínua ou Sequência em Cartões */}
          <View style={styles.subModeRow}>
            <View style={styles.subModeSelector}>
              <TouchableOpacity
                style={[styles.subModeBtn, ganttSubMode === "TIMELINE" && styles.subModeBtnActive]}
                onPress={() => setGanttSubMode("TIMELINE")}
              >
                <Text style={[styles.subModeBtnText, ganttSubMode === "TIMELINE" && styles.subModeBtnTextActive]}>
                  📅 Linha do Tempo
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.subModeBtn, ganttSubMode === "SEQUENCE" && styles.subModeBtnActive]}
                onPress={() => setGanttSubMode("SEQUENCE")}
              >
                <Text style={[styles.subModeBtnText, ganttSubMode === "SEQUENCE" && styles.subModeBtnTextActive]}>
                  🔄 Sequência por Pivô
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.ganttHint}>
              {ganttSubMode === "TIMELINE" ? "Deslize para navegar pelos meses" : "Sequência cronológica"}
            </Text>
          </View>

          {loading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color="#1b7d52" />
              <Text style={styles.loadingText}>Carregando cronograma...</Text>
            </View>
          ) : pivotGroups.length === 0 ? (
            <View style={styles.centered}>
              <Text style={styles.emptyTitle}>Nenhum pivô planejado</Text>
              <Text style={styles.emptySubtitle}>
                Cadastre planos de cultivo para visualizar as barras e períodos livres no celular.
              </Text>
            </View>
          ) : ganttSubMode === "TIMELINE" ? (
            /* SUB-MODO 1: TIMELINE HORIZONTAL COM MESES (GANTT REAL) */
            <ScrollView style={styles.ganttScrollVertical}>
              <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.ganttScrollHorizontal}>
                <View style={{ width: TOTAL_TIMELINE_WIDTH }}>
                  {/* Cabeçalho de Meses */}
                  <View style={styles.timelineHeaderRow}>
                    {timelineMonths.map((col, idx) => (
                      <View key={idx} style={[styles.timelineMonthCol, { width: COLUMN_WIDTH }]}>
                        <Text style={styles.timelineMonthLabel}>{col.label}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Linhas de cada Pivô */}
                  {pivotGroups.map((group) => (
                    <View key={group.pivoId} style={styles.timelinePivotRow}>
                      {/* Título do Pivô no topo da linha */}
                      <View style={styles.timelinePivotHeader}>
                        <Text style={styles.timelinePivotCode}>{group.codigo}</Text>
                        <Text style={styles.timelinePivotSub}>({group.fazendaNome})</Text>
                      </View>

                      {/* Trilha gráfica do Pivô */}
                      <View style={styles.timelineTrack}>
                        {/* Linhas de grade mensal de fundo */}
                        {timelineMonths.map((_, idx) => (
                          <View
                            key={idx}
                            style={[styles.timelineGridLine, { left: idx * COLUMN_WIDTH, width: COLUMN_WIDTH }]}
                          />
                        ))}

                        {/* 1. BARRAS DE CULTIVO */}
                        {group.plans.map((p) => {
                          const pos = getPositionX(p.data_plantio, p.data_colheita_prevista);
                          const colors = getCropColors(p.cultura_nome);
                          const hasReal = Boolean(p.data_plantio_real);

                          return (
                            <TouchableOpacity
                              key={p.id}
                              style={[
                                styles.ganttCropBar,
                                {
                                  left: pos.left,
                                  width: pos.width,
                                  backgroundColor: colors.bg,
                                  borderColor: colors.border,
                                },
                              ]}
                              onPress={() => setSelectedPlan(p)}
                              activeOpacity={0.8}
                            >
                              <View style={styles.ganttBarInner}>
                                <Text style={[styles.ganttCropText, { color: colors.text }]} numberOfLines={1}>
                                  {p.cultura_nome}
                                </Text>
                                <Text style={styles.ganttDatesText}>
                                  {formatShortMonth(p.data_plantio)}→{formatShortMonth(p.data_colheita_prevista)}
                                </Text>
                                {hasReal && (
                                  <View style={styles.realBadgeMini}>
                                    <Text style={styles.realBadgeMiniText}>✓ Real</Text>
                                  </View>
                                )}
                              </View>
                            </TouchableOpacity>
                          );
                        })}

                        {/* 2. FAIXAS DE PERÍODO LIVRE */}
                        {group.freeIntervals.map((fp) => {
                          const pos = getPositionX(fp.start, fp.end);
                          return (
                            <View
                              key={fp.id}
                              style={[
                                styles.ganttFreeBar,
                                {
                                  left: pos.left,
                                  width: pos.width,
                                },
                              ]}
                            >
                              <Text style={styles.ganttFreeText} numberOfLines={1}>
                                ⏱️ LIVRE ({fp.dias}d)
                              </Text>
                            </View>
                          );
                        })}

                        {/* 3. FAIXAS DE CONFLITO */}
                        {group.conflicts.map((conf) => {
                          const pos = getPositionX(conf.start, conf.end);
                          return (
                            <View
                              key={conf.id}
                              style={[
                                styles.ganttConflictBar,
                                {
                                  left: pos.left,
                                  width: pos.width,
                                },
                              ]}
                            >
                              <Text style={styles.ganttConflictText} numberOfLines={1}>
                                ⚠️ CONFLITO ({conf.dias_sobreposicao}d)
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  ))}
                </View>
              </ScrollView>
            </ScrollView>
          ) : (
            /* SUB-MODO 2: FLUXO DE SEQUÊNCIA CRONOLÓGICA (CARTÕES VERTICAIS) */
            <FlatList
              data={pivotGroups}
              keyExtractor={(item) => item.pivoId}
              contentContainerStyle={styles.sequenceList}
              renderItem={({ item: group }) => (
                <View style={styles.sequenceCard}>
                  <View style={styles.sequenceHeader}>
                    <View style={styles.sequencePivotTag}>
                      <Text style={styles.sequencePivotText}>{group.codigo}</Text>
                    </View>
                    <Text style={styles.sequenceFarmText}>{group.fazendaNome}</Text>
                  </View>

                  {/* Trilha de Blocos Sequenciais */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sequenceScroll}>
                    <View style={styles.sequenceTrackRow}>
                      {group.plans.map((p, pIdx) => {
                        const colors = getCropColors(p.cultura_nome);
                        const freeAfter = group.freeIntervals.find((fp) => fp.cultura_ant === p.cultura_nome);
                        const confAfter = group.conflicts.find((c) => c.cultura1 === p.cultura_nome);

                        return (
                          <React.Fragment key={p.id}>
                            {/* Bloco do Cultivo */}
                            <TouchableOpacity
                              style={[
                                styles.sequenceCropBlock,
                                { backgroundColor: colors.bg, borderColor: colors.border },
                              ]}
                              onPress={() => setSelectedPlan(p)}
                              activeOpacity={0.7}
                            >
                              <View style={styles.sequenceBlockHeader}>
                                <Text style={[styles.sequenceCropTitle, { color: colors.text }]}>
                                  {p.cultura_nome}
                                </Text>
                                <Text style={styles.sequenceAreaTag}>
                                  {Number(p.area_planejada_ha).toFixed(0)} ha
                                </Text>
                              </View>
                              <Text style={styles.sequenceDatePeriod}>
                                {formatDate(p.data_plantio)} → {formatDate(p.data_colheita_prevista)}
                              </Text>
                              <View style={styles.sequenceStatusLine}>
                                <Text style={styles.sequenceStatusText}>{p.status_display || p.status}</Text>
                                {p.data_plantio_real && (
                                  <Text style={styles.sequenceRealTag}>✓ Plantado</Text>
                                )}
                              </View>
                            </TouchableOpacity>

                            {/* Intervalo Livre Entre Cultivos */}
                            {freeAfter && (
                              <View style={styles.sequenceFreeBlock}>
                                <Text style={styles.sequenceFreeIcon}>⏱️</Text>
                                <Text style={styles.sequenceFreeTitle}>LIVRE</Text>
                                <Text style={styles.sequenceFreeDays}>{freeAfter.dias} dias</Text>
                              </View>
                            )}

                            {/* Alerta de Conflito */}
                            {confAfter && (
                              <View style={styles.sequenceConflictBlock}>
                                <Text style={styles.sequenceConflictIcon}>⚠️</Text>
                                <Text style={styles.sequenceConflictTitle}>CONFLITO</Text>
                                <Text style={styles.sequenceConflictDays}>{confAfter.dias_sobreposicao} dias</Text>
                              </View>
                            )}

                            {/* Marcador final se for o último cultivo */}
                            {pIdx === group.plans.length - 1 && (
                              <View style={styles.sequenceEndBlock}>
                                <Text style={styles.sequenceEndIcon}>📅</Text>
                                <Text style={styles.sequenceEndText}>Sem plano futuro</Text>
                              </View>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </View>
                  </ScrollView>
                </View>
              )}
            />
          )}

          {/* Legenda Resumida no Rodapé do Mobile */}
          <View style={styles.mobileLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#10b981" }]} />
              <Text style={styles.legendText}>Cultivo</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendBox, { backgroundColor: "#f1f5f9", borderColor: "#cbd5e1" }]} />
              <Text style={styles.legendText}>Livre (dias)</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendBox, { backgroundColor: "#fee2e2", borderColor: "#f87171" }]} />
              <Text style={styles.legendText}>Conflito</Text>
            </View>
            <View style={styles.legendItem}>
              <Text style={styles.legendText}>✓ Realizado</Text>
            </View>
          </View>
        </View>
      ) : (
        /* =========================================================================
            MODO LISTA PADRÃO
           ========================================================================= */
        <View style={styles.listContainer}>
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

          {loading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color="#1b7d52" />
              <Text style={styles.loadingText}>Carregando planos agrícolas...</Text>
            </View>
          ) : filteredPlans.length === 0 ? (
            <View style={styles.centered}>
              <Text style={styles.emptyTitle}>Nenhum plano encontrado</Text>
              <Text style={styles.emptySubtitle}>Nenhum registro corresponde aos filtros selecionados.</Text>
            </View>
          ) : (
            <FlatList
              data={filteredPlans}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => {
                const colors = getCropColors(item.cultura_nome);
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
                      <View style={[styles.statusBadge, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                        <Text style={[styles.statusBadgeText, { color: colors.text }]}>
                          {item.status_display || item.status}
                        </Text>
                      </View>
                    </View>

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
                        <Text style={styles.dateLabel}>Previsto: {formatDate(item.data_plantio)} → {formatDate(item.data_colheita_prevista)}</Text>
                        {item.data_plantio_real && (
                          <Text style={[styles.dateLabel, { color: "#059669", fontWeight: "600" }]}>
                            Plantio Real: {formatDate(item.data_plantio_real)}
                          </Text>
                        )}
                      </View>
                      <Text style={styles.areaBadge}>{Number(item.area_planejada_ha).toFixed(1)} ha</Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      )}

      {/* 4. Modal de Detalhes do Plano & Operações */}
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
                  <Text style={styles.modalSubtitle}>
                    {selectedPlan.alvo_nome} · {selectedPlan.fazenda_nome}
                  </Text>
                </View>
                <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedPlan(null)}>
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBodyScroll}>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Safra:</Text>
                  <Text style={styles.modalVal}>{selectedPlan.safra_nome}</Text>
                </View>

                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Área Planejada:</Text>
                  <Text style={styles.modalVal}>{Number(selectedPlan.area_planejada_ha).toFixed(2)} hectares</Text>
                </View>

                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Previsão de Plantio:</Text>
                  <Text style={styles.modalVal}>{formatDate(selectedPlan.data_plantio)}</Text>
                </View>

                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Plantio Realizado:</Text>
                  <Text style={[styles.modalVal, selectedPlan.data_plantio_real ? { color: "#059669", fontWeight: "bold" } : {}]}>
                    {formatDate(selectedPlan.data_plantio_real)}
                  </Text>
                </View>

                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Previsão de Colheita:</Text>
                  <Text style={styles.modalVal}>{formatDate(selectedPlan.data_colheita_prevista)}</Text>
                </View>

                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Colheita Realizada:</Text>
                  <Text style={[styles.modalVal, selectedPlan.data_colheita_real ? { color: "#059669", fontWeight: "bold" } : {}]}>
                    {formatDate(selectedPlan.data_colheita_real)}
                  </Text>
                </View>

                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Situação Operacional:</Text>
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

                {/* Conflito de Sincronização */}
                {activeConflictForModal && (
                  <View style={styles.modalConflictCard}>
                    <Text style={styles.modalConflictTitle}>⚠️ Conflito de Sincronização</Text>
                    <Text style={styles.modalConflictMsg}>
                      {activeConflictForModal.error_message || "A alteração local diverge do servidor."}
                    </Text>
                    <View style={styles.modalConflictActions}>
                      <TouchableOpacity
                        style={[styles.modalConflictActionBtn, styles.modalConflictPullBtn]}
                        onPress={() => handleResolveConflictFromServer(activeConflictForModal.client_op_id)}
                      >
                        <Text style={styles.modalConflictPullText}>🔄 Atualizar do Servidor</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.modalConflictActionBtn, styles.modalConflictDiscardBtn]}
                        onPress={() => handleDiscardConflict(activeConflictForModal.client_op_id, selectedPlan.cultura_nome)}
                      >
                        <Text style={styles.modalConflictDiscardText}>🗑️ Descartar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Ações de Transição Operacional */}
                {!isConsultor && !activeConflictForModal && (
                  <View style={styles.modalActions}>
                    {selectedPlan.status === "PLANEJADO" && (
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: "#047857" }]}
                        onPress={() => handleStatusTransition(selectedPlan, "EM_ANDAMENTO")}
                      >
                        <Text style={styles.actionBtnText}>🌱 Iniciar Plantio (Registrar Data)</Text>
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

                    {(selectedPlan.status === "PLANEJADO" || selectedPlan.status === "EM_ANDAMENTO") && (
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: "#b91c1c", marginTop: 8 }]}
                        onPress={() => handleStatusTransition(selectedPlan, "CANCELADO")}
                      >
                        <Text style={styles.actionBtnText}>✕ Cancelar Planejamento</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </ScrollView>

              <TouchableOpacity style={styles.modalCloseButton} onPress={() => setSelectedPlan(null)}>
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
    backgroundColor: "#f8fafc",
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

  // View Mode Tabs
  viewModeBar: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  viewModeTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  viewModeTabActive: {
    borderBottomColor: "#1b7d52",
    backgroundColor: "#f0fdf4",
  },
  viewModeTabText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
  },
  viewModeTabTextActive: {
    color: "#1b7d52",
    fontWeight: "bold",
  },

  // Chips de Fazenda
  filterChipScroll: {
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    maxHeight: 44,
  },
  filterChipContent: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  chipPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: "#f1f5f9",
  },
  chipPillActive: {
    backgroundColor: "#1b7d52",
  },
  chipPillText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#475569",
  },
  chipPillTextActive: {
    color: "#ffffff",
  },

  // Gantt Container & Sub-modos
  ganttContainer: {
    flex: 1,
  },
  subModeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  subModeSelector: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
    padding: 2,
  },
  subModeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  subModeBtnActive: {
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 1,
    elevation: 1,
  },
  subModeBtnText: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "500",
  },
  subModeBtnTextActive: {
    color: "#0f172a",
    fontWeight: "bold",
  },
  ganttHint: {
    fontSize: 10,
    color: "#94a3b8",
  },

  // Linha do tempo horizontal (Timeline Gantt)
  ganttScrollVertical: {
    flex: 1,
  },
  ganttScrollHorizontal: {
    flex: 1,
  },
  timelineHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#f8fafc",
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
  },
  timelineMonthCol: {
    paddingVertical: 8,
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: "#e2e8f0",
  },
  timelineMonthLabel: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#475569",
  },
  timelinePivotRow: {
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingVertical: 6,
  },
  timelinePivotHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  timelinePivotCode: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#0f172a",
  },
  timelinePivotSub: {
    fontSize: 11,
    color: "#64748b",
  },
  timelineTrack: {
    height: 48,
    position: "relative",
  },
  timelineGridLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    borderRightWidth: 1,
    borderRightColor: "#f1f5f9",
  },
  ganttCropBar: {
    position: "absolute",
    top: 4,
    bottom: 4,
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  ganttBarInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
  },
  ganttCropText: {
    fontSize: 10,
    fontWeight: "bold",
  },
  ganttDatesText: {
    fontSize: 9,
    color: "#64748b",
  },
  realBadgeMini: {
    backgroundColor: "#059669",
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 3,
  },
  realBadgeMiniText: {
    color: "#ffffff",
    fontSize: 8,
    fontWeight: "bold",
  },
  ganttFreeBar: {
    position: "absolute",
    top: 10,
    bottom: 10,
    borderRadius: 4,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#94a3b8",
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  ganttFreeText: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#475569",
  },
  ganttConflictBar: {
    position: "absolute",
    top: 8,
    bottom: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#ef4444",
    backgroundColor: "#fee2e2",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  ganttConflictText: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#b91c1c",
  },

  // Modo Sequência em Cartões (Vertical)
  sequenceList: {
    padding: 12,
    gap: 10,
  },
  sequenceCard: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  sequenceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  sequencePivotTag: {
    backgroundColor: "#f0fdf4",
    borderColor: "#bbf7d0",
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  sequencePivotText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#166534",
  },
  sequenceFarmText: {
    fontSize: 11,
    color: "#64748b",
  },
  sequenceScroll: {
    paddingVertical: 2,
  },
  sequenceTrackRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sequenceCropBlock: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    minWidth: 140,
  },
  sequenceBlockHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  sequenceCropTitle: {
    fontSize: 13,
    fontWeight: "bold",
  },
  sequenceAreaTag: {
    fontSize: 10,
    color: "#64748b",
  },
  sequenceDatePeriod: {
    fontSize: 10,
    color: "#475569",
    marginBottom: 4,
  },
  sequenceStatusLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sequenceStatusText: {
    fontSize: 9,
    fontWeight: "600",
    color: "#64748b",
  },
  sequenceRealTag: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#059669",
    backgroundColor: "#d1fae5",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  sequenceFreeBlock: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#cbd5e1",
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 80,
  },
  sequenceFreeIcon: {
    fontSize: 12,
    marginBottom: 2,
  },
  sequenceFreeTitle: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#475569",
  },
  sequenceFreeDays: {
    fontSize: 9,
    color: "#64748b",
  },
  sequenceConflictBlock: {
    borderWidth: 1,
    borderColor: "#fca5a5",
    backgroundColor: "#fef2f2",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 80,
  },
  sequenceConflictIcon: {
    fontSize: 12,
  },
  sequenceConflictTitle: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#b91c1c",
  },
  sequenceConflictDays: {
    fontSize: 8,
    color: "#991b1b",
  },
  sequenceEndBlock: {
    borderWidth: 1,
    borderStyle: "dotted",
    borderColor: "#e2e8f0",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  sequenceEndIcon: {
    fontSize: 11,
  },
  sequenceEndText: {
    fontSize: 9,
    color: "#94a3b8",
    fontStyle: "italic",
  },

  // Legenda no rodapé
  mobileLegend: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 8,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendBox: {
    width: 12,
    height: 8,
    borderWidth: 1,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 10,
    color: "#64748b",
  },

  // Modo Lista
  listContainer: {
    flex: 1,
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
  planCardConflict: {
    borderColor: "#fca5a5",
    backgroundColor: "#fffafa",
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

  // Modal
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
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingBottom: 10,
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
  modalBodyScroll: {
    maxHeight: 380,
  },
  modalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f8fafc",
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
    marginTop: 8,
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
  modalConflictCard: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  modalConflictTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#991b1b",
    marginBottom: 4,
  },
  modalConflictMsg: {
    fontSize: 11,
    color: "#7f1d1d",
    marginBottom: 8,
  },
  modalConflictActions: {
    flexDirection: "row",
    gap: 8,
  },
  modalConflictActionBtn: {
    flex: 1,
    paddingVertical: 8,
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
  modalActions: {
    marginTop: 14,
    marginBottom: 10,
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
  modalCloseButton: {
    backgroundColor: "#f1f5f9",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },
  modalCloseButtonText: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "600",
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
    maxWidth: 280,
  },
});
