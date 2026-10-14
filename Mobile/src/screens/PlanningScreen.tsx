import React, { useState, useEffect, useMemo, useRef } from "react";
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
  RefreshControl,
  useWindowDimensions,
} from "react-native";
import { Search, X, CalendarDays, Sprout } from "lucide-react-native";
import { MobileCropPlan, CropPlanStatus, PendingSyncItem, MobileFarm, MobileSeason } from "../types";
import { localDb } from "../database/sqlite";
import { syncManager } from "../services/syncManager";

interface PlanningScreenProps {
  onOpenSync: () => void;
  userRole?: string;
  initialViewMode?: "GANTT" | "LISTA";
}

type TimelineScale = "SEMANA" | "MES";

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

// Cores temáticas para culturas agrícolas idênticas ao navegador e ao padrão corporativo
const CROP_MOBILE_COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  SOJA: { bg: "#ecfdf5", border: "#10b981", text: "#047857", badge: "#059669" },
  MILHO: { bg: "#fffbeb", border: "#f59e0b", text: "#b45309", badge: "#d97706" },
  FEIJÃO: { bg: "#ecfeff", border: "#06b6d4", text: "#0e7490", badge: "#0891b2" },
  FEIJAO: { bg: "#ecfeff", border: "#06b6d4", text: "#0e7490", badge: "#0891b2" },
  ALGODÃO: { bg: "#faf5ff", border: "#a855f7", text: "#7e22ce", badge: "#9333ea" },
  ALGODAO: { bg: "#faf5ff", border: "#a855f7", text: "#7e22ce", badge: "#9333ea" },
  SORGO: { bg: "#fff7ed", border: "#f97316", text: "#c2410c", badge: "#ea580c" },
  TRIGO: { bg: "#fefce8", border: "#eab308", text: "#a16207", badge: "#ca8a04" },
  DEFAULT: { bg: "#eff6ff", border: "#3b82f6", text: "#1e40af", badge: "#2563eb" },
};

function getCropColors(name: string) {
  const upper = (name || "").toUpperCase();
  for (const k of Object.keys(CROP_MOBILE_COLORS)) {
    if (upper.includes(k)) return CROP_MOBILE_COLORS[k];
  }
  return CROP_MOBILE_COLORS.DEFAULT;
}

export function PlanningScreen({ onOpenSync, userRole = "OPERADOR", initialViewMode = "GANTT" }: PlanningScreenProps) {
  const viewMode = initialViewMode;
  const { width: screenWidth } = useWindowDimensions();
  const isDesktop = screenWidth >= 768;
  const leftColWidth = isDesktop ? 210 : screenWidth < 360 ? 94 : 108;
  const HEADER_HEIGHT = 46;

  const [plans, setPlans] = useState<MobileCropPlan[]>([]);
  const [farms, setFarms] = useState<MobileFarm[]>([]);
  const [seasons, setSeasons] = useState<MobileSeason[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Escala Temporal do Gantt
  const [timelineScale, setTimelineScale] = useState<TimelineScale>("MES");
  const [baseDate, setBaseDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });

  // Refs de rolagem para sincronização horizontal precisa
  const headerScrollRef = useRef<ScrollView>(null);
  const bodyScrollRef = useRef<ScrollView>(null);
  const isHeaderScrolling = useRef(false);

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

  const loadData = async (shouldSync = false) => {
    setLoading(true);
    if (shouldSync) {
      await syncManager.syncAll().catch(() => {});
    }

    let pData = await localDb.getPlans();
    let fData = await localDb.getFarms();
    let sData = await localDb.getSeasons();

    // Auto-sync se os planos locais estiverem vazios
    if (pData.length === 0 && !shouldSync) {
      await syncManager.syncAll().catch(() => {});
      pData = await localDb.getPlans();
      fData = await localDb.getFarms();
      sData = await localDb.getSeasons();
    }

    const [count, conflicts] = await Promise.all([
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
    setRefreshing(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData(true);
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
      areaHa: number;
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
          areaHa: Number(p.area_planejada_ha || 0),
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

  // Altura dinâmica de linha para preencher o espaço vertical quando houver poucos pivôs
  const ROW_HEIGHT = useMemo(() => {
    const count = pivotGroups.length;
    if (count <= 2) return isDesktop ? 104 : 88;
    if (count <= 4) return isDesktop ? 94 : 80;
    if (count <= 6) return isDesktop ? 82 : 72;
    return 62;
  }, [pivotGroups.length, isDesktop]);

  const BAR_HEIGHT = useMemo(() => {
    if (ROW_HEIGHT >= 80) return 46;
    if (ROW_HEIGHT >= 72) return 42;
    return 38;
  }, [ROW_HEIGHT]);

  // Métricas operacionais para preenchimento de tela no Cockpit
  const totalPlannedArea = useMemo(() => {
    return plans.reduce((acc, p) => acc + Number(p.area_planejada_ha || 0), 0);
  }, [plans]);

  const activePlansCount = useMemo(() => {
    return plans.filter((p) => p.status !== "CANCELADO").length;
  }, [plans]);

  const totalFreeIntervalsCount = useMemo(() => {
    return pivotGroups.reduce((acc, g) => acc + g.freeIntervals.length, 0);
  }, [pivotGroups]);

  // Colunas da Régua Temporal Compartilhada (Semana ou Mês)
  const timelineCols = useMemo(() => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    if (timelineScale === "MES") {
      const cols = [];
      const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      const colWidth = isDesktop ? 120 : 88;
      const startYear = baseDate.getFullYear();
      const startMonth = baseDate.getMonth() - 1;

      for (let i = 0; i < 10; i++) {
        const cur = new Date(startYear, startMonth + i, 1);
        const next = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
        const isCurMonth = cur.getMonth() === now.getMonth() && cur.getFullYear() === now.getFullYear();

        cols.push({
          key: `m-${cur.getFullYear()}-${cur.getMonth()}`,
          title: `${monthNames[cur.getMonth()]}/${String(cur.getFullYear()).slice(-2)}`,
          sub: `${cur.getFullYear()}`,
          start: cur,
          end: next,
          width: colWidth,
          left: i * colWidth,
          isToday: isCurMonth,
          isWeekend: false,
        });
      }
      return cols;
    } else {
      // Escala SEMANA: 21 dias (3 semanas: 1 anterior, atual e 1 posterior)
      const cols = [];
      const dayWidth = isDesktop ? 68 : 50;
      const weekDays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
      const dayOfWeek = (baseDate.getDay() + 6) % 7; // Segunda = 0
      const startMonday = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() - dayOfWeek - 7);

      for (let i = 0; i < 21; i++) {
        const cur = new Date(startMonday.getFullYear(), startMonday.getMonth(), startMonday.getDate() + i, 0, 0, 0);
        const next = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1, 0, 0, 0);
        const curStr = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`;
        const dow = (cur.getDay() + 6) % 7;

        cols.push({
          key: `d-${curStr}`,
          title: `${weekDays[dow]} ${cur.getDate()}`,
          sub: `${String(cur.getMonth() + 1).padStart(2, "0")}/${String(cur.getFullYear()).slice(-2)}`,
          start: cur,
          end: next,
          width: dayWidth,
          left: i * dayWidth,
          isToday: curStr === todayStr,
          isWeekend: dow >= 5,
        });
      }
      return cols;
    }
  }, [timelineScale, baseDate, isDesktop]);

  const timelineStart = timelineCols[0]?.start || new Date();
  const timelineEnd = timelineCols[timelineCols.length - 1]?.end || new Date();
  const totalTimelineDays = Math.max(1, (timelineEnd.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24));
  const totalTimelineWidth = timelineCols.reduce((acc, col) => acc + col.width, 0);

  // Marcador de Hoje (Linha Vermelha Vertical)
  const todayOffset = useMemo(() => {
    const nowT = new Date().getTime();
    const startT = timelineStart.getTime();
    const endT = timelineEnd.getTime();
    if (nowT < startT || nowT > endT) return null;
    const diffDays = (nowT - startT) / (1000 * 60 * 60 * 24);
    return (diffDays / totalTimelineDays) * totalTimelineWidth;
  }, [timelineStart, timelineEnd, totalTimelineDays, totalTimelineWidth]);

  // Conversão de datas para posições absolutas na escala compartilhada
  const getPosition = (startDateStr?: string | null, endDateStr?: string | null) => {
    if (!startDateStr || !endDateStr) return null;
    const s = new Date(startDateStr + "T00:00:00").getTime();
    const e = new Date(endDateStr + "T23:59:59").getTime();
    const startT = timelineStart.getTime();
    const endT = timelineEnd.getTime();

    if (e < startT || s > endT) return null;

    const clampedS = Math.max(s, startT);
    const clampedE = Math.min(e, endT);

    const diffDays = (clampedS - startT) / (1000 * 60 * 60 * 24);
    const durationClamped = Math.max(0.5, (clampedE - clampedS) / (1000 * 60 * 60 * 24));
    const fullDays = Math.max(1, Math.round((e - s) / (1000 * 60 * 60 * 24)));

    const left = (diffDays / totalTimelineDays) * totalTimelineWidth;
    const minBarWidth = timelineScale === "MES" ? 28 : 34;
    const width = Math.max(minBarWidth, (durationClamped / totalTimelineDays) * totalTimelineWidth);

    return { left, width, days: fullDays };
  };

  // Controles de Navegação Temporal
  const handleToday = () => {
    const d = new Date();
    if (timelineScale === "MES") {
      d.setDate(1);
    }
    setBaseDate(d);
    setTimeout(() => {
      if (todayOffset != null) {
        const scrollTarget = Math.max(0, todayOffset - (screenWidth - leftColWidth) / 2);
        headerScrollRef.current?.scrollTo({ x: scrollTarget, animated: true });
        bodyScrollRef.current?.scrollTo({ x: scrollTarget, animated: true });
      }
    }, 120);
  };

  const handlePrevPeriod = () => {
    setBaseDate((prev) => {
      const next = new Date(prev);
      if (timelineScale === "MES") {
        next.setMonth(next.getMonth() - 2);
      } else {
        next.setDate(next.getDate() - 7);
      }
      return next;
    });
  };

  const handleNextPeriod = () => {
    setBaseDate((prev) => {
      const next = new Date(prev);
      if (timelineScale === "MES") {
        next.setMonth(next.getMonth() + 2);
      } else {
        next.setDate(next.getDate() + 7);
      }
      return next;
    });
  };

  const periodLabelText = useMemo(() => {
    if (timelineCols.length === 0) return "";
    const first = timelineCols[0];
    const last = timelineCols[timelineCols.length - 1];
    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

    if (timelineScale === "MES") {
      return `${monthNames[first.start.getMonth()]}/${String(first.start.getFullYear()).slice(-2)} – ${monthNames[last.start.getMonth()]}/${String(last.start.getFullYear()).slice(-2)}`;
    } else {
      return `${first.start.getDate()} ${monthNames[first.start.getMonth()]} – ${last.start.getDate()} ${monthNames[last.start.getMonth()]}, ${last.start.getFullYear()}`;
    }
  }, [timelineCols, timelineScale]);

  const activeConflictForModal = selectedPlan ? getConflictForPlan(selectedPlan.id) : undefined;

  return (
    <View style={styles.container}>
      {/* 1. Cabeçalho Padronizado */}
      <View style={styles.topHeader}>
        <View style={styles.titleRow}>
          <View style={styles.screenTitleGroup}>
            <View style={styles.screenIconBox}>
              <CalendarDays size={20} color="#10b981" />
            </View>
            <View>
              <Text style={styles.screenTitle}>
                {viewMode === "GANTT" ? "Cockpit de Pivôs" : "Planejamento de Cultivo"}
              </Text>
              <Text style={styles.screenSubtitle}>
                {viewMode === "GANTT"
                  ? `${pivotGroups.length} unidade(s) monitorada(s)`
                  : `${filteredPlans.length} plano(s) cadastrado(s)`}
              </Text>
            </View>
          </View>
        </View>

        {/* Barra de Controles do Cronograma (Apenas na tela do Cockpit) */}
        {viewMode === "GANTT" && (
          <View style={styles.timelineControlBar}>
            {/* Navegação e Período */}
            <View style={styles.navControls}>
              <TouchableOpacity style={styles.navArrowBtn} onPress={handlePrevPeriod} activeOpacity={0.7}>
                <Text style={styles.navArrowText}>◀</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.todayBtn} onPress={handleToday} activeOpacity={0.7}>
                <Text style={styles.todayBtnText}>Hoje</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.navArrowBtn} onPress={handleNextPeriod} activeOpacity={0.7}>
                <Text style={styles.navArrowText}>▶</Text>
              </TouchableOpacity>

              <Text style={styles.periodLabel} numberOfLines={1}>
                {periodLabelText}
              </Text>
            </View>

            {/* Seletor de Escala: Semana vs Mês */}
            <View style={styles.scaleSelector}>
              <TouchableOpacity
                style={[styles.scaleBtn, timelineScale === "SEMANA" && styles.scaleBtnActive]}
                onPress={() => setTimelineScale("SEMANA")}
                activeOpacity={0.7}
              >
                <Text style={[styles.scaleBtnText, timelineScale === "SEMANA" && styles.scaleBtnTextActive]}>
                  Semana
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.scaleBtn, timelineScale === "MES" && styles.scaleBtnActive]}
                onPress={() => setTimelineScale("MES")}
                activeOpacity={0.7}
              >
                <Text style={[styles.scaleBtnText, timelineScale === "MES" && styles.scaleBtnTextActive]}>
                  Mês
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Alerta de conflito / sobreposição se houver */}
        {conflictCount > 0 && (
          <TouchableOpacity
            style={styles.conflictAlertBanner}
            onPress={onOpenSync}
            activeOpacity={0.8}
          >
            <Text style={styles.conflictAlertText}>
              ⚠️ {conflictCount} sobreposição(ões) de período detectada(s)
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 2. Filtros Compactos de Fazenda */}
      {farms.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterChipScroll}
          contentContainerStyle={styles.filterChipContent}
        >
          <TouchableOpacity
            style={[styles.chipPill, farmFilter === "TODAS" && styles.chipPillActive]}
            onPress={() => setFarmFilter("TODAS")}
            activeOpacity={0.7}
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
              activeOpacity={0.7}
            >
              <Text style={[styles.chipPillText, (farmFilter === f.id || farmFilter === f.nome) && styles.chipPillTextActive]}>
                {f.nome}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* =========================================================================
          MODO GANTT RESPONSIVO: COLUNA FIXA + CALENDÁRIO SINCRONIZADO
         ========================================================================= */}
      {viewMode === "GANTT" ? (
        <View style={styles.ganttContainer}>
          {loading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color="#1b7d52" />
              <Text style={styles.loadingText}>Carregando cronograma...</Text>
            </View>
          ) : pivotGroups.length === 0 ? (
            <View style={styles.centered}>
              <Text style={styles.emptyTitle}>Nenhum pivô planejado</Text>
              <Text style={styles.emptySubtitle}>
                Cadastre planos de cultivo para visualizar o cronograma compartilhado.
              </Text>
            </View>
          ) : (
            <View style={styles.ganttBoard}>
              {/* CABEÇALHO FIXO COM REGISTRO DE DATAS SINCRONIZADAS */}
              <View style={[styles.topStickyHeaderContainer, { height: HEADER_HEIGHT }]}>
                {/* Célula de canto: Coluna de Atividades Fixa */}
                <View style={[styles.pinnedCornerCell, { width: leftColWidth, height: HEADER_HEIGHT }]}>
                  <Text style={styles.pinnedCornerTitle}>PIVÔ / ÁREA</Text>
                </View>

                {/* Régua de datas rolável horizontalmente */}
                <ScrollView
                  ref={headerScrollRef}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  scrollEventThrottle={16}
                  onScroll={(e) => {
                    if (isHeaderScrolling.current) {
                      bodyScrollRef.current?.scrollTo({ x: e.nativeEvent.contentOffset.x, animated: false });
                    }
                  }}
                  onScrollBeginDrag={() => {
                    isHeaderScrolling.current = true;
                  }}
                  onScrollEndDrag={() => {
                    setTimeout(() => {
                      isHeaderScrolling.current = false;
                    }, 150);
                  }}
                  onMomentumScrollEnd={() => {
                    isHeaderScrolling.current = false;
                  }}
                  style={{ flex: 1 }}
                >
                  <View style={{ width: totalTimelineWidth, flexDirection: "row", height: HEADER_HEIGHT }}>
                    {timelineCols.map((col, idx) => (
                      <View
                        key={col.key || idx}
                        style={[
                          styles.timelineColHeader,
                          { width: col.width },
                          col.isWeekend && styles.timelineColHeaderWeekend,
                        ]}
                      >
                        <Text style={[styles.timelineColTitle, col.isToday && styles.timelineColTitleToday]}>
                          {col.title}
                        </Text>
                        {col.sub && (
                          <Text style={[styles.timelineColSub, col.isToday && styles.timelineColSubToday]}>
                            {col.sub}
                          </Text>
                        )}
                        {col.isToday && <View style={styles.todayIndicatorDot} />}
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </View>

              {/* CORPO DO GANTT COM ROLAGEM VERTICAL: ALINHAMENTO ESTRITO DE CADA LINHA */}
              <ScrollView
                style={styles.ganttScrollVertical}
                contentContainerStyle={{ flexGrow: 1 }}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={handleRefresh}
                    colors={["#10b981"]}
                  />
                }
              >
                <View style={{ flexDirection: "row" }}>
                  {/* COLUNA FIXA DE ATIVIDADES: FICA PRESA À ESQUERDA NO HORIZONTAL */}
                  <View style={[styles.pinnedActivitiesCol, { width: leftColWidth }]}>
                    {pivotGroups.map((group) => (
                      <View key={group.pivoId} style={[styles.leftPivotCell, { height: ROW_HEIGHT }]}>
                        <View style={styles.leftPivotCodeRow}>
                          <Text style={styles.leftPivotCode} numberOfLines={1}>
                            {group.codigo}
                          </Text>
                          {isDesktop && group.areaHa > 0 && (
                            <View style={styles.areaBadge}>
                              <Text style={styles.areaBadgeText}>{Math.round(group.areaHa)} ha</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.leftPivotFarm} numberOfLines={1}>
                          {group.fazendaNome}
                        </Text>
                        {!isDesktop && group.areaHa > 0 && (
                          <Text style={styles.leftPivotAreaMini} numberOfLines={1}>
                            {Math.round(group.areaHa)} ha
                          </Text>
                        )}
                      </View>
                    ))}
                  </View>

                  {/* CALENDÁRIO HORIZONTAL ROLÁVEL COM TRILHA COMPARTILHADA */}
                  <ScrollView
                    ref={bodyScrollRef}
                    horizontal
                    showsHorizontalScrollIndicator={true}
                    scrollEventThrottle={16}
                    onScroll={(e) => {
                      if (!isHeaderScrolling.current) {
                        headerScrollRef.current?.scrollTo({ x: e.nativeEvent.contentOffset.x, animated: false });
                      }
                    }}
                    onScrollBeginDrag={() => {
                      isHeaderScrolling.current = false;
                    }}
                    style={{ flex: 1 }}
                  >
                    <View style={{ width: totalTimelineWidth }}>
                      {pivotGroups.map((group) => (
                        <View key={group.pivoId} style={[styles.timelineTrackRow, { height: ROW_HEIGHT }]}>
                          {/* Grade de fundo sincronizada com as colunas */}
                          {timelineCols.map((col, idx) => (
                            <View
                              key={col.key || idx}
                              pointerEvents="none"
                              style={[
                                styles.timelineGridLine,
                                {
                                  left: col.left,
                                  width: col.width,
                                  backgroundColor: col.isWeekend ? "#f8fafc" : "transparent",
                                },
                              ]}
                            />
                          ))}

                          {/* Marcador vertical de hoje */}
                          {todayOffset != null && (
                            <View pointerEvents="none" style={[styles.todayVerticalLine, { left: todayOffset }]} />
                          )}

                          {/* 1. Faixas de Período Livre Entre Cultivos (com largura mínima de 58px para nunca cortar o texto) */}
                          {group.freeIntervals.map((fp) => {
                            const pos = getPosition(fp.start, fp.end);
                            if (!pos) return null;
                            const pillWidth = Math.max(pos.width, 58);
                            const pillLeft = pos.left + (pos.width - pillWidth) / 2;
                            return (
                              <View
                                key={fp.id}
                                style={[
                                  styles.ganttFreeInterval,
                                  { left: pillLeft, width: pillWidth },
                                ]}
                              >
                                <Text style={styles.ganttFreeText} numberOfLines={1}>
                                  ⏱️ {fp.dias}d
                                </Text>
                              </View>
                            );
                          })}

                          {/* 2. Faixas de Conflito de Sobreposição */}
                          {group.conflicts.map((conf) => {
                            const pos = getPosition(conf.start, conf.end);
                            if (!pos) return null;
                            const confWidth = Math.max(pos.width, 64);
                            const confLeft = pos.left + (pos.width - confWidth) / 2;
                            return (
                              <View
                                key={conf.id}
                                style={[
                                  styles.ganttConflictInterval,
                                  { left: confLeft, width: confWidth },
                                ]}
                              >
                                <Text style={styles.ganttConflictText} numberOfLines={1}>
                                  ⚠️ {conf.dias_sobreposicao}d
                                </Text>
                              </View>
                            );
                          })}

                          {/* 3. Barras dos Cultivos Agrícolas */}
                          {group.plans.map((p) => {
                            const pos = getPosition(p.data_plantio, p.data_colheita_prevista);
                            if (!pos) return null;
                            const colors = getCropColors(p.cultura_nome);

                            return (
                              <TouchableOpacity
                                key={p.id}
                                style={[
                                  styles.ganttCropBar,
                                  {
                                    left: pos.left,
                                    width: pos.width,
                                    height: BAR_HEIGHT,
                                    backgroundColor: colors.bg,
                                    borderColor: colors.border,
                                  },
                                ]}
                                onPress={() => setSelectedPlan(p)}
                                activeOpacity={0.75}
                                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                              >
                                <View style={styles.ganttBarInner}>
                                  <View style={styles.ganttBarHeader}>
                                    <View style={[styles.cropDotTiny, { backgroundColor: colors.border }]} />
                                    <Text style={[styles.ganttBarCropName, { color: colors.text }]} numberOfLines={1}>
                                      {p.cultura_nome}
                                    </Text>
                                    {p.data_plantio_real && (
                                      <Text style={styles.ganttRealCheck}>✓</Text>
                                    )}
                                  </View>
                                  <Text style={[styles.ganttBarDuration, { color: colors.text }]} numberOfLines={1}>
                                    {pos.days}d {pos.width > 75 ? `• ${formatShortMonth(p.data_plantio)}` : ""}
                                  </Text>
                                </View>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                </View>

                {/* PAINEL OPERACIONAL INFERIOR: PREENCHE O ESPAÇO COM MÉTRICAS ÚTEIS */}
                <View style={styles.cockpitSummarySection}>
                  <View style={styles.summaryTitleRow}>
                    <Text style={styles.summarySectionTitle}>Resumo Operacional</Text>
                    <Text style={styles.summarySectionSub}>Visão geral dos cultivos e áreas</Text>
                  </View>

                  <View style={styles.summaryCardsGrid}>
                    <View style={styles.summaryKpiCard}>
                      <Text style={styles.summaryKpiValue}>{pivotGroups.length}</Text>
                      <Text style={styles.summaryKpiLabel}>Pivôs Ativos</Text>
                    </View>

                    <View style={styles.summaryKpiCard}>
                      <Text style={[styles.summaryKpiValue, { color: "#059669" }]}>
                        {Math.round(totalPlannedArea)} <Text style={styles.summaryKpiUnit}>ha</Text>
                      </Text>
                      <Text style={styles.summaryKpiLabel}>Área Total</Text>
                    </View>

                    <View style={styles.summaryKpiCard}>
                      <Text style={[styles.summaryKpiValue, { color: "#2563eb" }]}>{activePlansCount}</Text>
                      <Text style={styles.summaryKpiLabel}>Cultivos</Text>
                    </View>

                    <View style={styles.summaryKpiCard}>
                      <Text style={[styles.summaryKpiValue, { color: totalFreeIntervalsCount > 0 ? "#d97706" : "#64748b" }]}>
                        {totalFreeIntervalsCount}
                      </Text>
                      <Text style={styles.summaryKpiLabel}>Janelas Livres</Text>
                    </View>
                  </View>
                </View>
              </ScrollView>
            </View>
          )}

          {/* Legenda Resumida no Rodapé */}
          <View style={styles.mobileLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: "#10b981" }]} />
              <Text style={styles.legendText}>Cultivo</Text>
            </View>
            <View style={styles.legendItem}>
              <Text style={styles.legendTextBold}>✓</Text>
              <Text style={styles.legendText}>Plantado</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendBox, { backgroundColor: "#f8fafc", borderColor: "#94a3b8" }]} />
              <Text style={styles.legendText}>Livre</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendBox, { backgroundColor: "#fef2f2", borderColor: "#ef4444" }]} />
              <Text style={styles.legendText}>Conflito</Text>
            </View>
            {todayOffset != null && (
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: "#ef4444" }]} />
                <Text style={styles.legendText}>Hoje</Text>
              </View>
            )}
          </View>
        </View>
      ) : (
        /* =========================================================================
            MODO LISTA PADRÃO (TELA DE PLANEJAMENTO)
           ========================================================================= */
        <View style={styles.listContainer}>
          {/* Busca Rápida Padronizada */}
          <View style={styles.searchBarContainer}>
            <View style={styles.searchBox}>
              <Search size={18} color="#94a3b8" />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar cultura, alvo, safra, fazenda..."
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
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  colors={["#10b981"]}
                />
              }
              renderItem={({ item }) => {
                const colors = getCropColors(item.cultura_nome);
                const planConflict = getConflictForPlan(item.id);

                return (
                  <TouchableOpacity
                    style={[
                      styles.planCard,
                      isDesktop && styles.planCardDesktop,
                      planConflict && styles.planCardConflict,
                    ]}
                    onPress={() => setSelectedPlan(item)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.cardHeader}>
                      <View style={styles.cropTitleGroup}>
                        <View style={[styles.cropDotMini, { backgroundColor: colors.border }]} />
                        <Text style={styles.cropName}>{item.cultura_nome}</Text>
                        <Text style={styles.targetName}>• {item.alvo_nome}</Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                        <Text style={[styles.statusBadgeText, { color: colors.text }]}>
                          {item.status_display || item.status}
                        </Text>
                      </View>
                    </View>

                    {planConflict && (
                      <View style={styles.cardConflictBadge}>
                        <Text style={styles.cardConflictBadgeText}>⚠️ Sobreposição de período com outro cultivo</Text>
                      </View>
                    )}

                    <View style={styles.cardDetailsGrid}>
                      <View style={styles.detailCol}>
                        <Text style={styles.detailColLabel}>Fazenda</Text>
                        <Text style={styles.detailColValue} numberOfLines={1}>{item.fazenda_nome || "—"}</Text>
                      </View>
                      <View style={styles.detailCol}>
                        <Text style={styles.detailColLabel}>Safra</Text>
                        <Text style={styles.detailColValue} numberOfLines={1}>{item.safra_nome || "—"}</Text>
                      </View>
                      <View style={styles.detailCol}>
                        <Text style={styles.detailColLabel}>Área</Text>
                        <Text style={styles.detailColValue}>{Number(item.area_planejada_ha).toFixed(0)} ha</Text>
                      </View>
                    </View>

                    <View style={styles.cardFooterDates}>
                      <Text style={styles.dateRangeText}>
                        Previsto: {formatDate(item.data_plantio)} → {formatDate(item.data_colheita_prevista)}
                      </Text>
                      {item.data_plantio_real && (
                        <View style={styles.realPlantTag}>
                          <Text style={styles.realPlantTagText}>✓ Plantado</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      )}

      {/* 3. Modal de Detalhes do Plano & Operações */}
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
  topHeader: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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

  // Barra de Controles do Cronograma (Navegação & Escala)
  timelineControlBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  navControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  navArrowBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  navArrowText: {
    fontSize: 10,
    color: "#334155",
    fontWeight: "bold",
  },
  todayBtn: {
    paddingHorizontal: 8,
    height: 28,
    borderRadius: 6,
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    alignItems: "center",
    justifyContent: "center",
  },
  todayBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#166534",
  },
  periodLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#334155",
    marginLeft: 4,
    flexShrink: 1,
  },
  scaleSelector: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderRadius: 6,
    padding: 2,
  },
  scaleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
  },
  scaleBtnActive: {
    backgroundColor: "#1b7d52",
  },
  scaleBtnText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748b",
  },
  scaleBtnTextActive: {
    color: "#ffffff",
    fontWeight: "bold",
  },

  // Alerta de conflito
  conflictAlertBanner: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    marginTop: 8,
  },
  conflictAlertText: {
    color: "#dc2626",
    fontSize: 11,
    fontWeight: "700",
  },

  // Chips de Fazenda
  filterChipScroll: {
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    maxHeight: 40,
  },
  filterChipContent: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  chipPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
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

  // Gantt Responsivo
  ganttContainer: {
    flex: 1,
  },
  ganttBoard: {
    flex: 1,
  },
  topStickyHeaderContainer: {
    flexDirection: "row",
    backgroundColor: "#f8fafc",
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
    zIndex: 10,
  },
  pinnedCornerCell: {
    backgroundColor: "#f8fafc",
    justifyContent: "center",
    paddingHorizontal: 8,
    borderRightWidth: 1,
    borderRightColor: "#cbd5e1",
  },
  pinnedCornerTitle: {
    fontSize: 10,
    fontWeight: "800",
    color: "#475569",
    letterSpacing: 0.4,
  },
  timelineColHeader: {
    justifyContent: "center",
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: "#e2e8f0",
    paddingHorizontal: 2,
    position: "relative",
  },
  timelineColHeaderWeekend: {
    backgroundColor: "#f1f5f9",
  },
  timelineColTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
  },
  timelineColTitleToday: {
    color: "#166534",
    fontWeight: "900",
  },
  timelineColSub: {
    fontSize: 9,
    color: "#94a3b8",
    marginTop: 1,
  },
  timelineColSubToday: {
    color: "#059669",
    fontWeight: "700",
  },
  todayIndicatorDot: {
    position: "absolute",
    bottom: 2,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#ef4444",
  },

  // Rolagem vertical e trilhas
  ganttScrollVertical: {
    flex: 1,
  },
  pinnedActivitiesCol: {
    backgroundColor: "#ffffff",
    borderRightWidth: 1,
    borderRightColor: "#cbd5e1",
    zIndex: 5,
  },
  leftPivotCell: {
    justifyContent: "center",
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  leftPivotCodeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
  },
  leftPivotCode: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0f172a",
  },
  areaBadge: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  areaBadgeText: {
    fontSize: 9,
    fontWeight: "600",
    color: "#64748b",
  },
  leftPivotFarm: {
    fontSize: 10,
    color: "#64748b",
    marginTop: 1,
  },
  leftPivotAreaMini: {
    fontSize: 9,
    fontWeight: "600",
    color: "#059669",
    marginTop: 1,
  },
  timelineTrackRow: {
    position: "relative",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    justifyContent: "center",
  },
  timelineGridLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    borderRightWidth: 1,
    borderRightColor: "#f1f5f9",
  },
  todayVerticalLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: "#ef4444",
    zIndex: 4,
  },

  // Barras e Faixas
  ganttCropBar: {
    position: "absolute",
    borderRadius: 6,
    borderWidth: 1.5,
    paddingHorizontal: 6,
    justifyContent: "center",
    zIndex: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 1.5,
    elevation: 2,
  },
  ganttBarInner: {
    justifyContent: "center",
  },
  ganttBarHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  cropDotTiny: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  ganttBarCropName: {
    fontSize: 11,
    fontWeight: "800",
    flexShrink: 1,
  },
  ganttRealCheck: {
    fontSize: 9,
    fontWeight: "900",
    color: "#059669",
  },
  ganttBarDuration: {
    fontSize: 9,
    fontWeight: "600",
    marginTop: 1,
    opacity: 0.85,
  },
  ganttFreeInterval: {
    position: "absolute",
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#334155",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    zIndex: 10,
    elevation: 3,
  },
  ganttFreeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#0f172a",
    textAlign: "center",
  },
  ganttConflictInterval: {
    position: "absolute",
    height: 26,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#ef4444",
    backgroundColor: "#fee2e2",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    zIndex: 12,
    elevation: 4,
  },
  ganttConflictText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#b91c1c",
  },

  // Painel de Resumo Operacional abaixo do Gantt
  cockpitSummarySection: {
    backgroundColor: "#ffffff",
    marginHorizontal: 12,
    marginTop: 14,
    marginBottom: 20,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  summaryTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingBottom: 8,
  },
  summarySectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0f172a",
  },
  summarySectionSub: {
    fontSize: 10,
    color: "#64748b",
  },
  summaryCardsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  summaryKpiCard: {
    flex: 1,
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  summaryKpiValue: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
  },
  summaryKpiUnit: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748b",
  },
  summaryKpiLabel: {
    fontSize: 9,
    color: "#64748b",
    marginTop: 2,
    fontWeight: "500",
    textAlign: "center",
  },

  // Legenda
  mobileLegend: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
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
    width: 10,
    height: 10,
    borderRadius: 2,
    borderWidth: 1,
  },
  legendText: {
    fontSize: 10,
    color: "#64748b",
    fontWeight: "500",
  },
  legendTextBold: {
    fontSize: 10,
    color: "#059669",
    fontWeight: "bold",
  },

  // Modo Lista
  listContainer: {
    flex: 1,
  },
  searchBarContainer: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
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
  filtersContainer: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  filterChip: {
    paddingHorizontal: 10,
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
  },
  listContent: {
    padding: 12,
    gap: 10,
  },
  planCard: {
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
  planCardDesktop: {
    maxWidth: 960,
    width: "100%",
    alignSelf: "center",
  },
  planCardConflict: {
    borderColor: "#f87171",
    borderWidth: 1.5,
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
    gap: 6,
    flex: 1,
  },
  cropDotMini: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  cropName: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#0f172a",
  },
  targetName: {
    fontSize: 12,
    color: "#64748b",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "bold",
  },
  cardConflictBadge: {
    backgroundColor: "#fef2f2",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 8,
  },
  cardConflictBadgeText: {
    color: "#b91c1c",
    fontSize: 10,
    fontWeight: "600",
  },
  cardDetailsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#f8fafc",
    borderRadius: 6,
    padding: 8,
    marginBottom: 8,
  },
  detailCol: {
    flex: 1,
  },
  detailColLabel: {
    fontSize: 9,
    color: "#64748b",
    textTransform: "uppercase",
    fontWeight: "600",
  },
  detailColValue: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#0f172a",
    marginTop: 1,
  },
  cardFooterDates: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dateRangeText: {
    fontSize: 11,
    color: "#475569",
  },
  realPlantTag: {
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  realPlantTagText: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#059669",
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
