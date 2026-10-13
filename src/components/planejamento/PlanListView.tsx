import React, { useState, useEffect } from "react";
import {
  api,
  type CropPlan,
  type CropPlanStatus,
  type Season,
  type Farm,
  type Crop,
} from "@/services/api";
import { StatusBadge } from "./StatusBadge";
import { PlanFormModal } from "./PlanFormModal";
import { PlanDetailModal } from "./PlanDetailModal";
import { StatusTransitionModal } from "./StatusTransitionModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  CalendarDays,
  Plus,
  Search,
  RefreshCw,
  Eye,
  Edit,
  ArrowRight,
  Filter,
  Layers,
  Sprout,
  Calendar,
  CircleDot,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
} from "lucide-react";

export function PlanListView() {
  const [plans, setPlans] = useState<CropPlan[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [search, setSearch] = useState("");
  const [safraFilter, setSafraFilter] = useState("");
  const [fazendaFilter, setFazendaFilter] = useState("");
  const [culturaFilter, setCulturaFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  // Catálogos
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);

  // Modais
  const [formOpen, setFormOpen] = useState(false);
  const [selectedPlanForEdit, setSelectedPlanForEdit] = useState<CropPlan | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedPlanForDetail, setSelectedPlanForDetail] = useState<CropPlan | null>(null);

  const [transitionOpen, setTransitionOpen] = useState(false);
  const [planToTransition, setPlanToTransition] = useState<CropPlan | null>(null);
  const [targetTransitionStatus, setTargetTransitionStatus] = useState<CropPlanStatus | null>(null);

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

  const loadPlans = async () => {
    setLoading(true);
    try {
      const res = await api.getPlans({
        safra: safraFilter || undefined,
        fazenda: fazendaFilter || undefined,
        cultura: culturaFilter || undefined,
        status: statusFilter || undefined,
        search: search || undefined,
        page: page,
      });
      setPlans(res.results || []);
      setTotalCount(res.count || (res.results ? res.results.length : 0));
    } catch {
      setPlans([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, [safraFilter, fazendaFilter, culturaFilter, statusFilter, search, page]);

  const handleOpenDetail = (plan: CropPlan) => {
    setSelectedPlanForDetail(plan);
    setDetailOpen(true);
  };

  const handleOpenCreate = () => {
    setSelectedPlanForEdit(null);
    setFormOpen(true);
  };

  const handleOpenEdit = (plan: CropPlan) => {
    setSelectedPlanForEdit(plan);
    setFormOpen(true);
  };

  const handleOpenTransition = (plan: CropPlan, targetStatus: CropPlanStatus) => {
    setPlanToTransition(plan);
    setTargetTransitionStatus(targetStatus);
    setTransitionOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Header com Busca, Filtros e Botão Novo */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
              <CalendarDays className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">
                Planos de Cultivo & Ocupação Agrícola
              </h3>
              <p className="text-xs text-muted-foreground">
                Gestão integrada de safras, áreas irrigadas, datas de ciclo e status operacional
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleOpenCreate} className="h-8 gap-1.5 text-xs">
              <Plus className="size-3.5" />
              Novo Plano de Cultivo
            </Button>
            <Button variant="outline" size="sm" onClick={loadPlans} disabled={loading} className="h-8 gap-1.5 text-xs">
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Linha de Busca e Filtros Avançados */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5 pt-1">
          <div className="relative sm:col-span-1">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar cultura, pivô, talhão..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="h-8 pl-8 text-xs"
            />
          </div>

          <select
            className="h-8 rounded-md border border-input bg-background px-2.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={safraFilter}
            onChange={(e) => {
              setSafraFilter(e.target.value);
              setPage(1);
            }}
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
            value={fazendaFilter}
            onChange={(e) => {
              setFazendaFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Todas as Fazendas</option>
            {farms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>

          <select
            className="h-8 rounded-md border border-input bg-background px-2.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={culturaFilter}
            onChange={(e) => {
              setCulturaFilter(e.target.value);
              setPage(1);
            }}
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
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
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

      {/* Tabela de Planos */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-xs text-muted-foreground">
            Carregando planos de cultivo...
          </div>
        ) : plans.length === 0 ? (
          <div className="py-20 text-center text-xs text-muted-foreground space-y-2">
            <p className="font-semibold text-foreground">Nenhum plano de plantio encontrado com os filtros atuais.</p>
            <p>Clique no botão abaixo para planejar um novo cultivo.</p>
            <Button size="sm" onClick={handleOpenCreate} className="gap-1.5 text-xs">
              <Plus className="size-3.5" />
              Novo Plano de Cultivo
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b border-border text-[11px] font-semibold text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Cultura / Safra</th>
                  <th className="px-4 py-3">Alocação & Área</th>
                  <th className="px-4 py-3">Cronograma (Plantio · Colheita)</th>
                  <th className="px-4 py-3">Meta Hídrica</th>
                  <th className="px-4 py-3">Situação</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {plans.map((p) => {
                  const alvoStr = p.pivo_codigo
                    ? `${p.pivo_codigo} · ${p.pivo_nome || ""}`
                    : p.talhao_codigo
                    ? `Talhão ${p.talhao_codigo}`
                    : p.fazenda_nome || "Área Livre";

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-muted/30 transition-colors group cursor-pointer"
                      onClick={() => handleOpenDetail(p)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="grid size-7 place-items-center rounded-lg bg-primary/10 text-primary shrink-0">
                            <Sprout className="size-3.5" />
                          </div>
                          <div>
                            <div className="font-bold text-foreground group-hover:text-primary transition-colors">
                              {p.cultura_nome}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {p.safra_nome}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-semibold text-foreground flex items-center gap-1.5">
                          {p.pivo_codigo ? <CircleDot className="size-3 text-primary shrink-0" /> : <Layers className="size-3 text-muted-foreground shrink-0" />}
                          {alvoStr}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {Number(p.area_planejada_ha).toLocaleString("pt-BR", { minimumFractionDigits: 1 })} ha
                          {p.fazenda_nome && ` · ${p.fazenda_nome}`}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="text-foreground font-medium flex items-center gap-1">
                          <Calendar className="size-3 text-primary shrink-0" />
                          {p.data_plantio ? new Date(p.data_plantio + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
                          <ArrowRight className="size-2.5 text-muted-foreground mx-0.5" />
                          {p.data_colheita_prevista ? new Date(p.data_colheita_prevista + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-semibold text-foreground">
                          {p.lamina_total_planejada_mm || 0} mm
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          Aplicado: {p.lamina_acumulada_realizada_mm || 0} mm
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <StatusBadge status={p.status} />
                      </td>

                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {/* Transição rápida */}
                          {p.status === "RASCUNHO" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Aprovar Plano"
                              onClick={() => handleOpenTransition(p, "PLANEJADO")}
                              className="h-7 px-2 text-xs text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                            >
                              <ArrowRight className="size-3.5 mr-1" />
                              Aprovar
                            </Button>
                          )}

                          {p.status === "PLANEJADO" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Iniciar Plantio"
                              onClick={() => handleOpenTransition(p, "EM_ANDAMENTO")}
                              className="h-7 px-2 text-xs text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                            >
                              <CheckCircle2 className="size-3.5 mr-1" />
                              Iniciar
                            </Button>
                          )}

                          {p.status === "EM_ANDAMENTO" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Concluir Ciclo"
                              onClick={() => handleOpenTransition(p, "CONCLUIDO")}
                              className="h-7 px-2 text-xs text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/40"
                            >
                              <CheckCircle2 className="size-3.5 mr-1" />
                              Concluir
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            size="icon"
                            title="Visualizar detalhes"
                            onClick={() => handleOpenDetail(p)}
                            className="size-7"
                          >
                            <Eye className="size-3.5 text-muted-foreground" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            title="Editar plano"
                            onClick={() => handleOpenEdit(p)}
                            className="size-7"
                          >
                            <Edit className="size-3.5 text-muted-foreground" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginação */}
        {totalCount > 25 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
            <span>
              Mostrando {plans.length} de {totalCount} planos
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-7 px-2 text-xs"
              >
                <ChevronLeft className="size-3.5" />
                Anterior
              </Button>
              <span className="font-semibold text-foreground px-2">Página {page}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={plans.length < 25}
                onClick={() => setPage((p) => p + 1)}
                className="h-7 px-2 text-xs"
              >
                Próxima
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Modais */}
      <PlanFormModal
        isOpen={formOpen}
        planToEdit={selectedPlanForEdit}
        onClose={() => setFormOpen(false)}
        onSuccess={loadPlans}
      />

      <PlanDetailModal
        isOpen={detailOpen}
        plan={selectedPlanForDetail}
        onClose={() => setDetailOpen(false)}
        onEdit={(plan) => handleOpenEdit(plan)}
        onTransitionStatus={(plan, target) => handleOpenTransition(plan, target)}
      />

      <StatusTransitionModal
        isOpen={transitionOpen}
        plan={planToTransition}
        targetStatus={targetTransitionStatus}
        onClose={() => setTransitionOpen(false)}
        onSuccess={loadPlans}
      />
    </div>
  );
}
