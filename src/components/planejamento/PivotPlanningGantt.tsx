import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  api,
  type PlanCalendarEvent,
  type FreePeriodWindow,
  type PlanningConflict,
  type PlanCalendarResponse,
  type CropPlan,
  type Season,
  type Farm,
  type Pivot,
  type Field,
  type Crop,
} from "@/services/api";
import { PlanDetailModal } from "./PlanDetailModal";
import { PlanFormModal } from "./PlanFormModal";
import { StatusTransitionModal } from "./StatusTransitionModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Plus,
  Clock,
  AlertTriangle,
  CircleDot,
  Layers,
  Sprout,
  CheckCircle2,
  Calendar,
  Building2,
  Filter,
} from "lucide-react";

interface PivotPlanningGanttProps {
  compact?: boolean;
  initialHorizon?: 3 | 6 | 12 | 24;
  defaultFazendaId?: string;
  showNewPlanButton?: boolean;
  onNewPlanClick?: () => void;
}

// Cores harmoniosas e específicas por cultura
const DEFAULT_CROP_COLOR = {
  bg: "bg-blue-500/15 dark:bg-blue-500/20",
  border: "border-blue-500",
  text: "text-blue-700 dark:text-blue-300",
  dot: "bg-blue-500",
};

const CROP_COLOR_MAP: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  SOJA: { bg: "bg-emerald-500/15 dark:bg-emerald-500/20", border: "border-emerald-500", text: "text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
  MILHO: { bg: "bg-amber-500/15 dark:bg-amber-500/20", border: "border-amber-500", text: "text-amber-700 dark:text-amber-300", dot: "bg-amber-500" },
  FEIJÃO: { bg: "bg-cyan-500/15 dark:bg-cyan-500/20", border: "border-cyan-500", text: "text-cyan-700 dark:text-cyan-300", dot: "bg-cyan-500" },
  FEIJAO: { bg: "bg-cyan-500/15 dark:bg-cyan-500/20", border: "border-cyan-500", text: "text-cyan-700 dark:text-cyan-300", dot: "bg-cyan-500" },
  ALGODÃO: { bg: "bg-purple-500/15 dark:bg-purple-500/20", border: "border-purple-500", text: "text-purple-700 dark:text-purple-300", dot: "bg-purple-500" },
  ALGODAO: { bg: "bg-purple-500/15 dark:bg-purple-500/20", border: "border-purple-500", text: "text-purple-700 dark:text-purple-300", dot: "bg-purple-500" },
  SORGO: { bg: "bg-orange-500/15 dark:bg-orange-500/20", border: "border-orange-500", text: "text-orange-700 dark:text-orange-300", dot: "bg-orange-500" },
  TRIGO: { bg: "bg-yellow-500/15 dark:bg-yellow-500/20", border: "border-yellow-500", text: "text-yellow-700 dark:text-yellow-300", dot: "bg-yellow-500" },
  DEFAULT: DEFAULT_CROP_COLOR,
};

function getCropColors(cultureName: string): { bg: string; border: string; text: string; dot: string } {
  const upper = (cultureName || "").toUpperCase().trim();
  for (const key of Object.keys(CROP_COLOR_MAP)) {
    if (upper.includes(key)) {
      const match = CROP_COLOR_MAP[key];
      if (match) return match;
    }
  }
  return DEFAULT_CROP_COLOR;
}

export function PivotPlanningGantt({
  compact = false,
  initialHorizon = 12,
  defaultFazendaId = "",
  showNewPlanButton = true,
  onNewPlanClick,
}: PivotPlanningGanttProps) {
  const [horizonMonths, setHorizonMonths] = useState<3 | 6 | 12 | 24>(initialHorizon);
  const [viewDate, setViewDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });

  // Filtros
  const [selectedFarm, setSelectedFarm] = useState<string>(defaultFazendaId);
  const [selectedSeason, setSelectedSeason] = useState<string>("");
  const [selectedCrop, setSelectedCrop] = useState<string>("");

  // Dados
  const [farms, setFarms] = useState<Farm[]>([]);
  const [pivots, setPivots] = useState<Pivot[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [calendarData, setCalendarData] = useState<PlanCalendarResponse>({ events: [], total: 0 });
  const [loading, setLoading] = useState<boolean>(true);

  // Modais de interação
  const [selectedPlanForDetail, setSelectedPlanForDetail] = useState<CropPlan | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [planToEdit, setPlanToEdit] = useState<CropPlan | null>(null);

  // Carrega catálogos iniciais
  useEffect(() => {
    Promise.all([
      api.getFarms().catch(() => []),
      api.getPivots().catch(() => []),
      api.getFields().catch(() => []),
      api.getSeasons().catch(() => []),
      api.getCrops().catch(() => []),
    ]).then(([fData, pData, tData, sData, cData]) => {
      setFarms(fData);
      setPivots(pData);
      setFields(tData);
      setSeasons(sData);
      setCrops(cData);
    });
  }, []);

  // Carrega dados dinâmicos do calendário de planejamento
  const fetchCalendar = async () => {
    setLoading(true);
    try {
      const res = await api.getPlanCalendar({
        safra: selectedSeason || undefined,
        fazenda: selectedFarm || undefined,
        cultura: selectedCrop || undefined,
      });
      setCalendarData(res);
    } catch {
      setCalendarData({ events: [], total: 0 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendar();
  }, [selectedFarm, selectedSeason, selectedCrop]);

  // Navegação no tempo
  const handlePrev = () => {
    setViewDate((prev) => {
      const next = new Date(prev);
      next.setMonth(next.getMonth() - Math.min(horizonMonths, 6));
      return next;
    });
  };

  const handleNext = () => {
    setViewDate((prev) => {
      const next = new Date(prev);
      next.setMonth(next.getMonth() + Math.min(horizonMonths, 6));
      return next;
    });
  };

  const handleToday = () => {
    const d = new Date();
    d.setDate(1);
    setViewDate(d);
  };

  // Cálculo das colunas do horizonte de meses
  const monthColumns = useMemo(() => {
    const list: Array<{ label: string; year: number; month: number; start: Date; end: Date; days: number }> = [];
    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

    for (let i = 0; i < horizonMonths; i++) {
      const cur = new Date(viewDate.getFullYear(), viewDate.getMonth() + i, 1);
      const nextMonth = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
      const daysInMonth = Math.round((nextMonth.getTime() - cur.getTime()) / (1000 * 60 * 60 * 24));

      list.push({
        label: `${monthNames[cur.getMonth()]} ${String(cur.getFullYear()).slice(-2)}`,
        year: cur.getFullYear(),
        month: cur.getMonth(),
        start: cur,
        end: nextMonth,
        days: daysInMonth,
      });
    }
    return list;
  }, [viewDate, horizonMonths]);

  // Intervalo global visível do Gantt
  const windowStart = monthColumns[0]?.start || viewDate;
  const windowEnd = monthColumns[monthColumns.length - 1]?.end || new Date();
  const totalWindowDays = Math.max(
    1,
    Math.round((windowEnd.getTime() - windowStart.getTime()) / (1000 * 60 * 60 * 24))
  );

  // Unidades de planejamento (Pivôs e Talhões)
  const planningUnits = useMemo(() => {
    const list: Array<{
      id: string;
      tipo: "PIVO" | "TALHAO";
      codigo: string;
      nome: string;
      area_ha: number;
      fazenda: string;
      fazenda_nome?: string | undefined;
      status_operacional?: string | undefined;
    }> = [];
    const seenUnitIds = new Set<string>();

    // 1. Pivôs existentes
    for (const p of pivots) {
      list.push({
        id: p.id,
        tipo: "PIVO",
        codigo: p.codigo,
        nome: p.nome || `Pivô ${p.codigo}`,
        area_ha: Number(p.area_irrigada_ha || 0),
        fazenda: p.fazenda,
        fazenda_nome: p.fazenda_nome,
        status_operacional: p.status_operacional,
      });
      seenUnitIds.add(p.id);
    }

    // 2. Talhões existentes
    for (const t of fields) {
      if (!seenUnitIds.has(t.id)) {
        list.push({
          id: t.id,
          tipo: "TALHAO",
          codigo: t.codigo,
          nome: t.descricao || t.nome || `Talhão ${t.codigo}`,
          area_ha: Number(t.area_ha || 0),
          fazenda: t.fazenda,
          fazenda_nome: t.fazenda_nome,
        });
        seenUnitIds.add(t.id);
      }
    }

    // 3. Unidades dos eventos de calendário (caso algum evento venha com talhão/pivô não listado)
    for (const evt of calendarData.events || []) {
      const unitId = evt.pivo_id || evt.talhao_id;
      if (unitId && !seenUnitIds.has(unitId)) {
        list.push({
          id: unitId,
          tipo: evt.pivo_id ? "PIVO" : "TALHAO",
          codigo: evt.pivo_codigo || evt.talhao_codigo || "Área",
          nome: evt.pivo_nome || (evt.talhao_codigo ? `Talhão ${evt.talhao_codigo}` : "Área"),
          area_ha: Number(evt.area_planejada_ha || 0),
          fazenda: evt.fazenda_id || "",
          fazenda_nome: evt.fazenda_nome || "",
        });
        seenUnitIds.add(unitId);
      }
    }

    if (selectedFarm) {
      return list.filter((u) => u.fazenda === selectedFarm);
    }
    return list;
  }, [pivots, fields, calendarData.events, selectedFarm]);

  // Agrupamento das unidades por fazenda
  const unitsByFarm = useMemo(() => {
    const map = new Map<string, { farm: Farm | null; units: typeof planningUnits }>();

    for (const unit of planningUnits) {
      const farmId = unit.fazenda || "sem_fazenda";
      if (!map.has(farmId)) {
        const farmObj = farms.find((f) => f.id === farmId) || null;
        map.set(farmId, { farm: farmObj, units: [] });
      }
      map.get(farmId)!.units.push(unit);
    }

    return Array.from(map.values());
  }, [planningUnits, farms]);

  // Eventos mapeados por unidade (pivô ou talhão)
  const eventsByUnit = useMemo(() => {
    const map = new Map<string, PlanCalendarEvent[]>();
    for (const evt of calendarData.events || []) {
      const key = evt.pivo_id || evt.talhao_id;
      if (key) {
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(evt);
      }
    }
    return map;
  }, [calendarData.events]);

  // Períodos livres mapeados por unidade
  const freePeriodsByUnit = useMemo(() => {
    const map = new Map<string, FreePeriodWindow[]>();
    for (const fp of calendarData.periodos_livres || []) {
      const key = fp.pivo_id || fp.talhao_id;
      if (key) {
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(fp);
      }
    }
    return map;
  }, [calendarData.periodos_livres]);

  // Conflitos mapeados por unidade
  const conflictsByUnit = useMemo(() => {
    const map = new Map<string, PlanningConflict[]>();
    for (const c of calendarData.conflitos || []) {
      const key = c.pivo_id || c.talhao_id;
      if (key) {
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(c);
      }
    }
    return map;
  }, [calendarData.conflitos]);

  // Indicador de sem planejamento futuro por unidade
  const semPlanejamentoByUnit = useMemo(() => {
    const map = new Map<string, { apos_data: string; ultima_cultura: string }>();
    for (const sp of calendarData.sem_planejamento_futuro || []) {
      const key = sp.pivo_id || sp.talhao_id;
      if (key) {
        map.set(key, { apos_data: sp.apos_data, ultima_cultura: sp.ultima_cultura });
      }
    }
    return map;
  }, [calendarData.sem_planejamento_futuro]);

  // Utilitário para posicionamento percentual no Gantt
  const calculateBarPosition = (startDateStr: string, endDateStr: string) => {
    const start = new Date(startDateStr + "T00:00:00");
    const end = new Date(endDateStr + "T00:00:00");

    if (end < windowStart || start > windowEnd) {
      return null;
    }

    const effectiveStart = start < windowStart ? windowStart : start;
    const effectiveEnd = end > windowEnd ? windowEnd : end;

    const daysFromStart = Math.max(
      0,
      Math.round((effectiveStart.getTime() - windowStart.getTime()) / (1000 * 60 * 60 * 24))
    );
    const durationDays = Math.max(
      1,
      Math.round((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24))
    );

    const leftPercent = (daysFromStart / totalWindowDays) * 100;
    const widthPercent = (durationDays / totalWindowDays) * 100;

    return {
      left: `${Math.max(0, leftPercent)}%`,
      width: `${Math.max(1.2, Math.min(100 - leftPercent, widthPercent))}%`,
      actualDays: Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
    };
  };

  const handleOpenPlanDetail = async (planId: string) => {
    try {
      const plan = await api.getPlan(planId);
      setSelectedPlanForDetail(plan);
      setDetailModalOpen(true);
    } catch {
      // Ignora erro de rede
    }
  };

  return (
    <div className="space-y-4 w-full">
      {/* Barra de Controles e Filtros do Gantt */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
              <CalendarDays className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <span>Planejamento dos Pivôs</span>
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                  Gantt Dinâmico
                </span>
              </h3>
              <p className="text-xs text-muted-foreground">
                Cronograma operacional, culturas programadas, janelas livres e períodos sem planejamento futuro
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Seletor de Horizonte de Meses */}
            <div className="flex items-center rounded-lg border border-border bg-muted/30 p-0.5">
              {([3, 6, 12, 24] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setHorizonMonths(m)}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
                    horizonMonths === m
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m} meses
                </button>
              ))}
            </div>

            {/* Navegação no Tempo */}
            <div className="flex items-center rounded-lg border border-border bg-background p-0.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePrev}
                className="h-7 w-7 p-0"
                title="Período anterior"
              >
                <ChevronLeft className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToday}
                className="h-7 px-2 text-xs font-medium"
              >
                Hoje
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNext}
                className="h-7 w-7 p-0"
                title="Próximo período"
              >
                <ChevronRight className="size-3.5" />
              </Button>
            </div>

            {/* Atualizar */}
            <Button
              variant="outline"
              size="sm"
              onClick={fetchCalendar}
              disabled={loading}
              className="h-8 gap-1.5 text-xs"
              title="Recarregar dados"
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>

            {/* Novo Planejamento */}
            {showNewPlanButton && (
              <Button
                size="sm"
                onClick={() => {
                  if (onNewPlanClick) {
                    onNewPlanClick();
                  } else {
                    setPlanToEdit(null);
                    setFormModalOpen(true);
                  }
                }}
                className="h-8 gap-1.5 text-xs font-semibold"
              >
                <Plus className="size-3.5" />
                Novo Planejamento
              </Button>
            )}
          </div>
        </div>

        {/* Linha de Filtros Consistentes */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 border-t border-border/60">
          <select
            className="h-8 rounded-md border border-input bg-background px-2.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={selectedFarm}
            onChange={(e) => setSelectedFarm(e.target.value)}
          >
            <option value="">Todas as Fazendas</option>
            {farms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome} ({f.filial || f.codigo})
              </option>
            ))}
          </select>

          <select
            className="h-8 rounded-md border border-input bg-background px-2.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={selectedSeason}
            onChange={(e) => setSelectedSeason(e.target.value)}
          >
            <option value="">Todas as Safras</option>
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </select>

          <select
            className="h-8 rounded-md border border-input bg-background px-2.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={selectedCrop}
            onChange={(e) => setSelectedCrop(e.target.value)}
          >
            <option value="">Todas as Culturas</option>
            {crops.map((c) => (
              <option key={c.id} value={c.id}>
                {c.descricao}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Container Principal do Gantt com Rolagem Horizontal Suave */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        {loading && planningUnits.length === 0 ? (
          <div className="py-24 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
            <RefreshCw className="size-5 animate-spin text-primary" />
            <span>Carregando cronograma de planejamento...</span>
          </div>
        ) : planningUnits.length === 0 ? (
          <div className="py-24 text-center text-xs text-muted-foreground space-y-2">
            <p className="font-semibold text-foreground text-sm">Nenhuma unidade ou talhão encontrado para exibição.</p>
            <p>Cadastre talhões ou pivôs e planos de plantio para visualizar o gráfico de planejamento.</p>
          </div>
        ) : (
          <div className="overflow-x-auto select-none w-full">
            <div className="w-full min-w-[980px]">
              {/* Cabeçalho do Eixo de Tempo (Meses e Anos) */}
              <div className="flex border-b border-border bg-muted/50 sticky top-0 z-10 text-xs">
                {/* Coluna de Identificação da Unidade */}
                <div className="w-56 shrink-0 p-3 font-bold text-foreground border-r border-border flex items-center justify-between">
                  <span>Unidade / Talhão</span>
                  <span className="text-[10px] text-muted-foreground font-normal">Área (ha)</span>
                </div>

                {/* Meses do Horizonte */}
                <div className="flex-1 flex">
                  {monthColumns.map((col, idx) => (
                    <div
                      key={idx}
                      className="flex-1 p-2.5 text-center font-bold text-[11px] text-muted-foreground border-r border-border/60 last:border-r-0"
                    >
                      {col.label}
                    </div>
                  ))}
                </div>
              </div>

              {/* Linhas Agrupadas por Fazenda */}
              <div className="divide-y divide-border">
                {unitsByFarm.map((group, gIdx) => (
                  <div key={gIdx} className="space-y-0">
                    {/* Header da Fazenda */}
                    <div className="bg-muted/30 px-3.5 py-1.5 text-xs font-bold text-foreground flex items-center gap-2 border-b border-border/50">
                      <Building2 className="size-3.5 text-primary" />
                      <span>{group.farm ? group.farm.nome : "Fazenda Não Atribuída"}</span>
                      {group.farm?.filial && (
                        <span className="text-[10px] text-muted-foreground font-normal">
                          (Filial {group.farm.filial})
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground ml-auto font-normal">
                        {group.units.length} unidade(s)
                      </span>
                    </div>

                    {/* Linhas de cada Unidade / Talhão */}
                    {group.units.map((unit) => {
                      const unitEvents = eventsByUnit.get(unit.id) || [];
                      const unitFreePeriods = freePeriodsByUnit.get(unit.id) || [];
                      const unitConflicts = conflictsByUnit.get(unit.id) || [];
                      const unitSemFuturo = semPlanejamentoByUnit.get(unit.id);

                      return (
                        <div
                          key={unit.id}
                          className="flex min-h-[56px] hover:bg-muted/20 transition-colors group relative"
                        >
                          {/* Coluna Esquerda da Unidade */}
                          <div className="w-56 shrink-0 p-3 border-r border-border flex flex-col justify-center bg-card group-hover:bg-muted/10">
                            <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
                              <span
                                className={`size-2 rounded-full ${
                                  unit.tipo === "PIVO"
                                    ? "bg-emerald-500"
                                    : "bg-sky-500"
                                }`}
                              />
                              <span>{unit.codigo}</span>
                              <span className="text-[10px] text-muted-foreground font-normal ml-auto">
                                {unit.tipo === "PIVO" ? "Pivô" : "Talhão"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-0.5">
                              <span className="truncate max-w-[120px]" title={unit.nome}>
                                {unit.nome}
                              </span>
                              <span className="font-semibold text-foreground">
                                {Number(unit.area_ha || 0).toFixed(1)} ha
                              </span>
                            </div>
                          </div>

                          {/* Pista do Gantt (Linha do Tempo) */}
                          <div className="flex-1 relative min-h-[56px] flex items-center">
                            {/* Grid de fundo por mês */}
                            <div className="absolute inset-0 flex pointer-events-none">
                              {monthColumns.map((_, idx) => (
                                <div
                                  key={idx}
                                  className="flex-1 border-r border-border/40 last:border-r-0"
                                />
                              ))}
                            </div>

                            {/* BARRAS DE CULTIVO PLANEJADO / REALIZADO */}
                            {unitEvents.map((evt) => {
                              const pos = calculateBarPosition(evt.data_plantio, evt.data_colheita_prevista);
                              if (!pos) return null;

                              const colors = getCropColors(evt.cultura_nome);
                              const hasRealPlantio = Boolean(evt.data_plantio_real);
                              const hasRealColheita = Boolean(evt.data_colheita_real);

                              return (
                                <div
                                  key={evt.id}
                                  onClick={() => handleOpenPlanDetail(evt.id)}
                                  style={{ left: pos.left, width: pos.width }}
                                  className={`absolute top-2 bottom-2 z-10 rounded-md border ${colors.border} ${colors.bg} px-2 py-1 flex flex-col justify-center cursor-pointer shadow-sm hover:ring-2 hover:ring-primary/40 transition-all overflow-hidden`}
                                  title={`${evt.cultura_nome} (${pos.actualDays} dias)\nPrevisto: ${evt.data_plantio} a ${evt.data_colheita_prevista}\nStatus: ${evt.status_display}${
                                    hasRealPlantio ? `\nPlantio Real: ${evt.data_plantio_real}` : ""
                                  }${hasRealColheita ? `\nColheita Real: ${evt.data_colheita_real}` : ""}`}
                                >
                                  {/* Rótulo da Cultura e Duração */}
                                  <div className="flex items-center justify-between gap-1 leading-none">
                                    <div className="flex items-center gap-1 min-w-0">
                                      <span className={`size-1.5 rounded-full ${colors.dot} shrink-0`} />
                                      <span className={`font-bold text-[11px] truncate ${colors.text}`}>
                                        {evt.cultura_nome}
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-muted-foreground font-semibold shrink-0">
                                      {pos.actualDays}d
                                    </span>
                                  </div>

                                  {/* Intervalo de Datas e Marco Realizado */}
                                  <div className="flex items-center justify-between text-[9px] text-muted-foreground mt-0.5 leading-none">
                                    <span className="truncate">
                                      {evt.data_plantio ? evt.data_plantio.slice(5) : ""} → {evt.data_colheita_prevista ? evt.data_colheita_prevista.slice(5) : ""}
                                    </span>
                                    {hasRealPlantio && (
                                      <span
                                        className="rounded bg-emerald-600/20 px-1 py-0.2 text-[9px] font-bold text-emerald-700 dark:text-emerald-300"
                                        title={`Plantio Real: ${evt.data_plantio_real}`}
                                      >
                                        ✓ Real
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}

                            {/* FAIXAS DE PERÍODO LIVRE */}
                            {unitFreePeriods.map((fp) => {
                              const pos = calculateBarPosition(fp.start, fp.end);
                              if (!pos) return null;

                              return (
                                <div
                                  key={fp.id}
                                  style={{ left: pos.left, width: pos.width, minWidth: "76px" }}
                                  className="absolute top-2.5 bottom-2.5 z-10 rounded border border-dashed border-zinc-400 bg-zinc-100/95 dark:bg-zinc-800/95 px-1.5 flex items-center justify-center text-[10px] font-bold text-zinc-700 dark:text-zinc-200 shadow-xs whitespace-nowrap hover:bg-zinc-200 transition-colors"
                                  title={`Intervalo Livre: ${fp.dias_livres} dias (${fp.start} a ${fp.end})\nEntre ${fp.cultura_anterior} e ${fp.cultura_proxima}`}
                                >
                                  <span className="flex items-center gap-1 shrink-0">
                                    <Clock className="size-2.5 shrink-0 opacity-70" />
                                    <span>LIVRE ({fp.dias_livres}d)</span>
                                  </span>
                                </div>
                              );
                            })}

                            {/* FAIXAS DE CONFLITO / SOBREPOSIÇÃO */}
                            {unitConflicts.map((conf) => {
                              const pos = calculateBarPosition(conf.start, conf.end);
                              if (!pos) return null;

                              return (
                                <div
                                  key={conf.id}
                                  style={{ left: pos.left, width: pos.width, minWidth: "84px" }}
                                  className="absolute top-1 bottom-1 z-20 rounded border-2 border-rose-500 bg-rose-500/30 px-1.5 flex items-center justify-center text-[10px] font-bold text-rose-700 dark:text-rose-300 animate-pulse shadow-sm whitespace-nowrap"
                                  title={conf.mensagem}
                                >
                                  <span className="flex items-center gap-1 shrink-0">
                                    <AlertTriangle className="size-3 text-rose-600 shrink-0" />
                                    <span>CONFLITO ({conf.dias_sobreposicao}d)</span>
                                  </span>
                                </div>
                              );
                            })}

                            {/* MARCADOR DE SEM PLANEJAMENTO FUTURO */}
                            {unitSemFuturo && (
                              (() => {
                                const pos = calculateBarPosition(unitSemFuturo.apos_data, unitSemFuturo.apos_data);
                                if (!pos) return null;

                                return (
                                  <div
                                    style={{ left: pos.left }}
                                    className="absolute top-3 bottom-3 z-0 flex items-center pl-1 text-[9px] text-muted-foreground/60 italic pointer-events-none"
                                  >
                                    <span>• Sem planejamento futuro</span>
                                  </div>
                                );
                              })()
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* LEGENDA OFICIAL DO GANTT CONFORME REQUISITO 8 */}
        <div className="border-t border-border bg-muted/30 p-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="font-bold text-[11px] text-muted-foreground uppercase tracking-wider">
              Legenda do Gantt:
            </span>

            <div className="flex flex-wrap items-center gap-4 text-[11px]">
              {/* 1. Cultura planejada */}
              <div className="flex items-center gap-1.5">
                <span className="size-3 rounded border border-emerald-500 bg-emerald-500/20" />
                <span className="text-foreground">Cultura planejada</span>
              </div>

              {/* 2. Cultivo realizado */}
              <div className="flex items-center gap-1.5">
                <span className="size-3 rounded border border-emerald-600 bg-emerald-600" />
                <span className="text-foreground">Cultivo realizado (✓)</span>
              </div>

              {/* 3. Período livre */}
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-5 rounded border border-dashed border-zinc-400 bg-zinc-200/60 dark:bg-zinc-800/60" />
                <span className="text-foreground font-semibold">Período livre (dias)</span>
              </div>

              {/* 4. Colheita */}
              <div className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-amber-500" />
                <span className="text-foreground">Marco de colheita</span>
              </div>

              {/* 5. Conflito de planejamento */}
              <div className="flex items-center gap-1.5">
                <span className="size-3 rounded border-2 border-rose-500 bg-rose-500/30" />
                <span className="text-rose-600 dark:text-rose-400 font-bold">Conflito de datas</span>
              </div>

              {/* 6. Sem planejamento futuro */}
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground/60 italic">• Sem planejamento futuro</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modais de Ação Integrados */}
      {selectedPlanForDetail && (
        <PlanDetailModal
          isOpen={detailModalOpen}
          plan={selectedPlanForDetail}
          onClose={() => setDetailModalOpen(false)}
          onEdit={(plan) => {
            setDetailModalOpen(false);
            setPlanToEdit(plan);
            setFormModalOpen(true);
          }}
          onTransitionStatus={() => {
            setDetailModalOpen(false);
            fetchCalendar();
          }}
        />
      )}

      {formModalOpen && (
        <PlanFormModal
          isOpen={formModalOpen}
          planToEdit={planToEdit}
          onClose={() => setFormModalOpen(false)}
          onSuccess={() => {
            fetchCalendar();
          }}
        />
      )}
    </div>
  );
}
