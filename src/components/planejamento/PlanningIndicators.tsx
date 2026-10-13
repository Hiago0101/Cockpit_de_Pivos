import React, { useState, useEffect } from "react";
import {
  api,
  type PlanningIndicators as IndicatorsType,
  type Season,
  type Farm,
} from "@/services/api";
import { StatusBadge } from "./StatusBadge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  Calendar,
  Layers,
  Sprout,
  TrendingUp,
  MapPin,
  RefreshCw,
  AlertCircle,
} from "lucide-react";

export function PlanningIndicators() {
  const [indicators, setIndicators] = useState<IndicatorsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);

  const [selectedSeason, setSelectedSeason] = useState<string>("");
  const [selectedFarm, setSelectedFarm] = useState<string>("");

  useEffect(() => {
    Promise.all([
      api.getSeasons().catch(() => []),
      api.getFarms().catch(() => []),
    ]).then(([sData, fData]) => {
      setSeasons(sData);
      setFarms(fData);
    });
  }, []);

  const loadIndicators = async () => {
    setLoading(true);
    try {
      const data = await api.getPlanIndicators({
        safra: selectedSeason || undefined,
        fazenda: selectedFarm || undefined,
      });
      setIndicators(data);
    } catch {
      setIndicators(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIndicators();
  }, [selectedSeason, selectedFarm]);

  if (loading && !indicators) {
    return (
      <div className="py-20 text-center text-xs text-muted-foreground">
        Calculando indicadores consolidados de safras e áreas...
      </div>
    );
  }

  const ind = indicators;
  const totalArea = ind?.area_total_planejada_ha || 0;
  const statusCounts = ind?.planos_por_status || {
    RASCUNHO: 0,
    PLANEJADO: 0,
    EM_ANDAMENTO: 0,
    CONCLUIDO: 0,
    CANCELADO: 0,
  };

  return (
    <div className="space-y-4">
      {/* Barra de Filtros dos Indicadores */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
            <BarChart3 className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">
              Indicadores de Planejamento Agrícola
            </h3>
            <p className="text-xs text-muted-foreground">
              Métricas consolidadas de ocupação de área, safras vigentes e cronograma
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
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
                {f.nome}
              </option>
            ))}
          </select>

          <Button variant="outline" size="sm" onClick={loadIndicators} disabled={loading} className="gap-1.5 text-xs">
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Cards de Métricas Principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Área Total Planejada</span>
            <TrendingUp className="size-4 text-primary" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {totalArea.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
            <span className="text-xs font-normal text-muted-foreground ml-1">ha</span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Soma de hectares sob cultivo ativo
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Total de Planos</span>
            <Layers className="size-4 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {ind?.total_planos || 0}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Planos agrícolas cadastrados
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Em Andamento</span>
            <Sprout className="size-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {statusCounts.EM_ANDAMENTO}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Ciclos com plantio ativo em campo
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Concluídos / Colhidos</span>
            <Calendar className="size-4 text-purple-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-purple-600 dark:text-purple-400">
            {statusCounts.CONCLUIDO}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Safras e áreas finalizadas com sucesso
          </p>
        </div>
      </div>

      {/* Grid de Distribuição: Situação & Culturas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Distribuição por Situação */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
          <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
            Planos por Situação Operacional
          </h4>
          <div className="space-y-2.5">
            {[
              { label: "Rascunho", count: statusCounts.RASCUNHO, color: "bg-slate-500", key: "RASCUNHO" },
              { label: "Planejado", count: statusCounts.PLANEJADO, color: "bg-blue-500", key: "PLANEJADO" },
              { label: "Em Andamento", count: statusCounts.EM_ANDAMENTO, color: "bg-emerald-500", key: "EM_ANDAMENTO" },
              { label: "Concluído", count: statusCounts.CONCLUIDO, color: "bg-purple-500", key: "CONCLUIDO" },
              { label: "Cancelado", count: statusCounts.CANCELADO, color: "bg-rose-500", key: "CANCELADO" },
            ].map((st) => {
              const pct = (ind?.total_planos || 0) > 0 ? Math.round((st.count / (ind?.total_planos || 1)) * 100) : 0;
              return (
                <div key={st.key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">{st.label}</span>
                    <span className="text-muted-foreground">
                      {st.count} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full ${st.color}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Distribuição de Área por Cultura */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
          <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
            Área Planejada por Cultura (Hectares)
          </h4>
          {ind?.area_por_cultura.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              Nenhuma cultura alocada para os filtros selecionados.
            </p>
          ) : (
            <div className="space-y-2.5">
              {ind?.area_por_cultura.map((c) => {
                const pct = totalArea > 0 ? Math.round((c.area_ha / totalArea) * 100) : 0;
                return (
                  <div key={c.cultura_id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground flex items-center gap-1.5">
                        <Sprout className="size-3 text-primary" />
                        {c.cultura_nome}
                      </span>
                      <span className="text-muted-foreground">
                        {c.area_ha.toLocaleString("pt-BR", { minimumFractionDigits: 1 })} ha ({pct}%) · {c.planos_count} planos
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Grid: Planos por Fazenda & Próximos Plantios */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Distribuição por Fazenda */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
          <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
            Área por Unidade Agrícola / Fazenda
          </h4>
          {ind?.planos_por_fazenda.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              Nenhum registro para as fazendas filtradas.
            </p>
          ) : (
            <div className="space-y-2.5">
              {ind?.planos_por_fazenda.map((f) => (
                <div
                  key={f.fazenda_id}
                  className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-2.5 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <MapPin className="size-4 text-primary shrink-0" />
                    <div>
                      <div className="font-semibold text-foreground">{f.fazenda_nome}</div>
                      <div className="text-[11px] text-muted-foreground">{f.planos_count} planos associados</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-foreground text-sm">
                      {f.area_ha.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}
                    </span>
                    <span className="text-muted-foreground text-[11px] ml-1">ha</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Próximos Plantios Previstos */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
          <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
            Próximos Plantios no Calendário
          </h4>
          {ind?.proximos_plantios.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              Nenhum plantio agendado para as próximas semanas.
            </p>
          ) : (
            <div className="space-y-2">
              {ind?.proximos_plantios.map((pp) => (
                <div
                  key={pp.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-2.5 text-xs"
                >
                  <div>
                    <span className="font-semibold text-foreground">{pp.cultura_nome}</span>
                    <span className="text-muted-foreground ml-1">· {pp.alvo || pp.fazenda_nome}</span>
                    <div className="text-[11px] text-muted-foreground">
                      Safra {pp.safra_nome} · Previsto para {new Date(pp.data_plantio + "T00:00:00").toLocaleDateString("pt-BR")}
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1">
                    <span className="font-bold text-foreground">{pp.area_planejada_ha} ha</span>
                    <StatusBadge status={pp.status} className="text-[10px] py-0 px-1" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
