import React, { useState, useEffect } from "react";
import {
  api,
  type PlanCalendarEvent,
  type Season,
  type Farm,
  type Crop,
  type CropPlanStatus,
} from "@/services/api";
import { StatusBadge } from "./StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  CalendarDays,
  Filter,
  RefreshCw,
  Sprout,
  ChevronLeft,
  ChevronRight,
  Layers,
  Calendar,
} from "lucide-react";

interface PlanningCalendarProps {
  onSelectEvent?: (eventId: string) => void;
}

export function PlanningCalendar({ onSelectEvent }: PlanningCalendarProps) {
  const [events, setEvents] = useState<PlanCalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);

  // Filtros
  const [selectedSeason, setSelectedSeason] = useState<string>("");
  const [selectedFarm, setSelectedFarm] = useState<string>("");
  const [selectedCrop, setSelectedCrop] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  // Carrega catálogos
  useEffect(() => {
    Promise.all([
      api.getSeasons().catch(() => []),
      api.getFarms().catch(() => []),
      api.getCrops().catch(() => []),
    ]).then(([sData, fData, cData]) => {
      setSeasons(sData);
      setFarms(fData);
      setCrops(cData);
    });
  }, []);

  const loadCalendar = async () => {
    setLoading(true);
    try {
      const res = await api.getPlanCalendar({
        ano: selectedYear,
        safra: selectedSeason || undefined,
        fazenda: selectedFarm || undefined,
        cultura: selectedCrop || undefined,
        status: selectedStatus || undefined,
      });
      setEvents(res.events || []);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCalendar();
  }, [selectedYear, selectedSeason, selectedFarm, selectedCrop, selectedStatus]);

  // Calcula posição e largura do cronograma para cada evento no ano selecionado
  const getTimelineBarStyles = (startDateStr: string, endDateStr: string) => {
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    const yearStart = new Date(selectedYear, 0, 1);
    const yearEnd = new Date(selectedYear, 11, 31);

    const effectiveStart = start < yearStart ? yearStart : start;
    const effectiveEnd = end > yearEnd ? yearEnd : end;

    if (effectiveEnd < yearStart || effectiveStart > yearEnd) {
      return { left: "0%", width: "0%", visible: false };
    }

    const totalDaysInYear = 365;
    const startDay = Math.floor((effectiveStart.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24));
    const durationDays = Math.max(5, Math.ceil((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)));

    const leftPercent = (startDay / totalDaysInYear) * 100;
    const widthPercent = (durationDays / totalDaysInYear) * 100;

    return {
      left: `${Math.max(0, leftPercent)}%`,
      width: `${Math.min(100 - leftPercent, widthPercent)}%`,
      visible: true,
    };
  };

  return (
    <div className="space-y-4">
      {/* Barra de Filtros e Controles */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
              <CalendarDays className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">
                Cronograma Temporal de Safras e Cultivos
              </h3>
              <p className="text-xs text-muted-foreground">
                Visualização integrada das janelas de plantio e colheita por período
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Seletor de Ano */}
            <div className="flex items-center rounded-lg border border-border bg-background p-1">
              <button
                onClick={() => setSelectedYear((y) => y - 1)}
                className="p-1 text-muted-foreground hover:text-foreground rounded"
                title="Ano anterior"
              >
                <ChevronLeft className="size-4" />
              </button>
              <span className="px-3 text-xs font-bold text-foreground">{selectedYear}</span>
              <button
                onClick={() => setSelectedYear((y) => y + 1)}
                className="p-1 text-muted-foreground hover:text-foreground rounded"
                title="Próximo ano"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>

            <Button variant="outline" size="sm" onClick={loadCalendar} disabled={loading} className="gap-1.5 text-xs">
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Linha de Filtros */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
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
            value={selectedFarm}
            onChange={(e) => setSelectedFarm(e.target.value)}
          >
            <option value="">Todas as Fazendas</option>
            {farms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome} ({f.codigo})
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
                {c.nome}
              </option>
            ))}
          </select>

          <select
            className="h-8 rounded-md border border-input bg-background px-2.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option value="">Todas as Situações</option>
            <option value="RASCUNHO">Rascunho</option>
            <option value="PLANEJADO">Planejado</option>
            <option value="EM_ANDAMENTO">Em Andamento</option>
            <option value="CONCLUIDO">Concluído</option>
            <option value="CANCELADO">Cancelado</option>
          </select>
        </div>
      </div>

      {/* Visualização de Cronograma Gantt */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        {/* Cabeçalho dos 12 Meses */}
        <div className="grid grid-cols-12 border-b border-border bg-muted/40 text-center text-[11px] font-semibold text-muted-foreground py-2.5">
          {months.map((m, idx) => (
            <div key={idx} className="border-r last:border-r-0 border-border/50 truncate px-1">
              <span className="hidden md:inline">{m}</span>
              <span className="md:hidden">{m.slice(0, 3)}</span>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="py-16 text-center text-xs text-muted-foreground">
            Carregando cronograma das safras e pivôs...
          </div>
        ) : events.length === 0 ? (
          <div className="py-16 text-center text-xs text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground">Nenhum plano de plantio encontrado no período selecionado.</p>
            <p>Ajuste os filtros ou cadastre um novo planejamento de cultivo para este ano.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {events.map((evt) => {
              const bar = getTimelineBarStyles(evt.start, evt.end);
              return (
                <div
                  key={evt.id}
                  onClick={() => onSelectEvent?.(evt.id)}
                  className="group relative p-3 hover:bg-muted/30 transition-colors cursor-pointer"
                >
                  {/* Informações do Cultivo */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground group-hover:text-primary transition-colors">
                        {evt.title}
                      </span>
                      <span className="text-muted-foreground">· {evt.safra_nome}</span>
                      {evt.fazenda_nome && (
                        <span className="text-[11px] text-muted-foreground">({evt.fazenda_nome})</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-foreground">
                        {evt.area_planejada_ha} ha
                      </span>
                      <StatusBadge status={evt.status} className="text-[10px] py-0 px-1.5" />
                    </div>
                  </div>

                  {/* Linha do Tempo Visual */}
                  <div className="relative h-6 w-full rounded-md bg-muted/40 overflow-hidden border border-border/40">
                    {/* Linhas verticais de divisão dos 12 meses */}
                    <div className="absolute inset-0 grid grid-cols-12 pointer-events-none">
                      {Array.from({ length: 12 }).map((_, i) => (
                        <div key={i} className="border-r last:border-r-0 border-border/30 h-full" />
                      ))}
                    </div>

                    {/* Barra do Período */}
                    {bar.visible && (
                      <div
                        className={`absolute top-0.5 bottom-0.5 rounded px-2 text-[10px] font-bold text-white flex items-center justify-between shadow-sm transition-all duration-300 ${
                          evt.status === "EM_ANDAMENTO"
                            ? "bg-emerald-600 dark:bg-emerald-500"
                            : evt.status === "PLANEJADO"
                            ? "bg-blue-600 dark:bg-blue-500"
                            : evt.status === "CONCLUIDO"
                            ? "bg-purple-600 dark:bg-purple-500"
                            : evt.status === "CANCELADO"
                            ? "bg-rose-600/60 dark:bg-rose-500/60 line-through"
                            : "bg-slate-500"
                        }`}
                        style={{ left: bar.left, width: bar.width }}
                        title={`${evt.cultura_nome}: ${evt.start} até ${evt.end} (${evt.area_planejada_ha} ha)`}
                      >
                        <span className="truncate pr-1 text-[9px] drop-shadow-sm">
                          {evt.start}
                        </span>
                        <span className="truncate pl-1 text-[9px] drop-shadow-sm hidden sm:inline">
                          {evt.end}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
