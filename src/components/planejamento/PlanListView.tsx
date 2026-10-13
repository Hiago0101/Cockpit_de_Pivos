import React, { useState, useEffect } from "react";
import {
  api,
  type CropPlan,
  type CropPlanStatus,
  type Season,
  type Farm,
  type Crop,
  type Pivot,
} from "@/services/api";
import { StatusBadge } from "./StatusBadge";
import { PlanFormModal } from "./PlanFormModal";
import { PlanDetailModal } from "./PlanDetailModal";
import { StatusTransitionModal } from "./StatusTransitionModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CalendarDays,
  Plus,
  Search,
  RefreshCw,
  Eye,
  Edit,
  XCircle,
  Sprout,
  Calendar,
  CircleDot,
  Layers,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Building2,
} from "lucide-react";

export function PlanListView() {
  const [plans, setPlans] = useState<CropPlan[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [search, setSearch] = useState("");
  const [safraFilter, setSafraFilter] = useState("");
  const [fazendaFilter, setFazendaFilter] = useState("");
  const [pivoFilter, setPivoFilter] = useState("");
  const [culturaFilter, setCulturaFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [ordering, setOrdering] = useState("-data_plantio");

  // Catálogos
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [pivots, setPivots] = useState<Pivot[]>([]);

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
      api.getPivots().catch(() => []),
    ]).then(([sData, fData, cData, pData]) => {
      setSeasons(sData);
      setFarms(fData);
      setCrops(cData);
      setPivots(pData);
    });
  }, []);

  const loadPlans = async () => {
    setLoading(true);
    try {
      const res = await api.getPlans({
        safra: safraFilter || undefined,
        fazenda: fazendaFilter || undefined,
        pivo: pivoFilter || undefined,
        cultura: culturaFilter || undefined,
        status: statusFilter || undefined,
        search: search || undefined,
        ordering: ordering,
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
  }, [safraFilter, fazendaFilter, pivoFilter, culturaFilter, statusFilter, search, ordering, page]);

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

  const handleCancelPlan = (plan: CropPlan) => {
    if (plan.status === "CANCELADO") return;
    setPlanToTransition(plan);
    setTargetTransitionStatus("CANCELADO");
    setTransitionOpen(true);
  };

  const toggleSort = (field: string) => {
    setOrdering((prev) => (prev === field ? `-${field}` : field));
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr + "T00:00:00").toLocaleDateString("pt-BR");
    } catch {
      return dateStr;
    }
  };

  const filteredPivotsForFilter = fazendaFilter
    ? pivots.filter((p) => p.fazenda === fazendaFilter)
    : pivots;

  return (
    <div className="space-y-4 w-full">
      {/* Topo do Módulo conforme especificação da tela */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary shrink-0">
              <CalendarDays className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground sm:text-lg">
                Planejamento de Plantio
              </h2>
              <p className="text-xs text-muted-foreground">
                Gerencie o calendário de culturas, plantios, colheitas e disponibilidade dos pivôs
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleOpenCreate} className="h-8 gap-1.5 text-xs font-semibold">
              <Plus className="size-3.5" />
              Novo Planejamento
            </Button>
            <Button variant="outline" size="sm" onClick={loadPlans} disabled={loading} className="h-8 gap-1.5 text-xs">
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Linha de Busca e Filtros */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-2 pt-1">
          {/* Busca textual */}
          <div className="relative md:col-span-1">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Pesquisar..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="h-8 pl-8 text-xs"
            />
          </div>

          {/* Filtro Safra */}
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

          {/* Filtro Fazenda */}
          <select
            className="h-8 rounded-md border border-input bg-background px-2.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={fazendaFilter}
            onChange={(e) => {
              setFazendaFilter(e.target.value);
              setPivoFilter("");
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

          {/* Filtro Pivô / Talhão */}
          <select
            className="h-8 rounded-md border border-input bg-background px-2.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={pivoFilter}
            onChange={(e) => {
              setPivoFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos os Pivôs</option>
            {filteredPivotsForFilter.map((p) => (
              <option key={p.id} value={p.id}>
                {p.codigo} - {p.nome}
              </option>
            ))}
          </select>

          {/* Filtro Cultura */}
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
                {c.descricao}
              </option>
            ))}
          </select>

          {/* Filtro Situação */}
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

      {/* Tabela de 10 colunas estritas conforme especificação */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
            <RefreshCw className="size-5 animate-spin text-primary" />
            <span>Carregando planejamento de plantio...</span>
          </div>
        ) : plans.length === 0 ? (
          <div className="py-20 text-center text-xs text-muted-foreground space-y-2">
            <p className="font-semibold text-foreground text-sm">Nenhum planejamento encontrado com os filtros atuais.</p>
            <p>Clique no botão abaixo para registrar o plantio de uma safra.</p>
            <Button size="sm" onClick={handleOpenCreate} className="gap-1.5 text-xs font-semibold mt-2">
              <Plus className="size-3.5" />
              Novo Planejamento
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b border-border text-[11px] font-semibold text-muted-foreground select-none">
                <tr>
                  <th className="px-3.5 py-3 cursor-pointer hover:text-foreground" onClick={() => toggleSort("safra__nome")}>
                    <div className="flex items-center gap-1">
                      <span>Safra</span>
                      <ArrowUpDown className="size-3 text-muted-foreground/60" />
                    </div>
                  </th>
                  <th className="px-3.5 py-3 cursor-pointer hover:text-foreground" onClick={() => toggleSort("fazenda__nome")}>
                    <div className="flex items-center gap-1">
                      <span>Fazenda</span>
                      <ArrowUpDown className="size-3 text-muted-foreground/60" />
                    </div>
                  </th>
                  <th className="px-3.5 py-3 cursor-pointer hover:text-foreground" onClick={() => toggleSort("pivo__codigo")}>
                    <div className="flex items-center gap-1">
                      <span>Pivô/Talhão</span>
                      <ArrowUpDown className="size-3 text-muted-foreground/60" />
                    </div>
                  </th>
                  <th className="px-3.5 py-3 cursor-pointer hover:text-foreground" onClick={() => toggleSort("cultura__descricao")}>
                    <div className="flex items-center gap-1">
                      <span>Cultura</span>
                      <ArrowUpDown className="size-3 text-muted-foreground/60" />
                    </div>
                  </th>
                  <th className="px-3 py-3 cursor-pointer hover:text-foreground" onClick={() => toggleSort("data_plantio")}>
                    <div className="flex items-center gap-1">
                      <span>Previsão de plantio</span>
                      <ArrowUpDown className="size-3 text-muted-foreground/60" />
                    </div>
                  </th>
                  <th className="px-3 py-3">Plantio realizado</th>
                  <th className="px-3 py-3 cursor-pointer hover:text-foreground" onClick={() => toggleSort("data_colheita_prevista")}>
                    <div className="flex items-center gap-1">
                      <span>Previsão de colheita</span>
                      <ArrowUpDown className="size-3 text-muted-foreground/60" />
                    </div>
                  </th>
                  <th className="px-3 py-3">Colheita realizada</th>
                  <th className="px-3.5 py-3">Status</th>
                  <th className="px-3.5 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {plans.map((p) => {
                  const alvoStr = p.pivo_codigo
                    ? p.pivo_codigo
                    : p.talhao_codigo
                    ? `Talhão ${p.talhao_codigo}`
                    : "Área Livre";

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-muted/30 transition-colors group cursor-pointer"
                      onClick={() => handleOpenDetail(p)}
                    >
                      {/* 1. Safra */}
                      <td className="px-3.5 py-3 font-medium text-foreground">
                        {p.safra_nome}
                      </td>

                      {/* 2. Fazenda */}
                      <td className="px-3.5 py-3 text-muted-foreground">
                        {p.fazenda_nome || "—"}
                      </td>

                      {/* 3. Pivô/Talhão */}
                      <td className="px-3.5 py-3">
                        <div className="font-semibold text-foreground flex items-center gap-1">
                          {p.pivo_codigo ? (
                            <CircleDot className="size-3 text-primary shrink-0" />
                          ) : (
                            <Layers className="size-3 text-muted-foreground shrink-0" />
                          )}
                          <span>{alvoStr}</span>
                        </div>
                        {p.pivo_nome && (
                          <span className="text-[10px] text-muted-foreground block truncate max-w-[120px]">
                            {p.pivo_nome}
                          </span>
                        )}
                      </td>

                      {/* 4. Cultura */}
                      <td className="px-3.5 py-3">
                        <div className="font-bold text-foreground flex items-center gap-1.5">
                          <Sprout className="size-3.5 text-primary shrink-0" />
                          <span>{p.cultura_nome}</span>
                        </div>
                      </td>

                      {/* 5. Previsão de plantio */}
                      <td className="px-3 py-3 text-foreground font-medium">
                        {formatDate(p.data_plantio)}
                      </td>

                      {/* 6. Plantio realizado */}
                      <td className="px-3 py-3">
                        {p.data_plantio_real ? (
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {formatDate(p.data_plantio_real)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/60">—</span>
                        )}
                      </td>

                      {/* 7. Previsão de colheita */}
                      <td className="px-3 py-3 text-foreground font-medium">
                        {formatDate(p.data_colheita_prevista)}
                      </td>

                      {/* 8. Colheita realizada */}
                      <td className="px-3 py-3">
                        {p.data_colheita_real ? (
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {formatDate(p.data_colheita_real)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/60">—</span>
                        )}
                      </td>

                      {/* 9. Status */}
                      <td className="px-3.5 py-3">
                        <StatusBadge status={p.status} />
                      </td>

                      {/* 10. Ações: Visualizar, editar e cancelar */}
                      <td className="px-3.5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Visualizar Detalhes"
                            onClick={() => handleOpenDetail(p)}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                          >
                            <Eye className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Editar Planejamento"
                            onClick={() => handleOpenEdit(p)}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                          >
                            <Edit className="size-3.5" />
                          </Button>
                          {p.status !== "CANCELADO" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Cancelar Planejamento"
                              onClick={() => handleCancelPlan(p)}
                              className="h-7 w-7 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                            >
                              <XCircle className="size-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Rodapé de Paginação */}
        <div className="flex items-center justify-between border-t border-border px-4 py-2.5 bg-muted/20 text-xs text-muted-foreground">
          <span>
            Total: <strong>{totalCount}</strong> planejamento(s) cadastrado(s)
          </span>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="h-7 px-2 text-xs"
            >
              <ChevronLeft className="size-3.5 mr-0.5" /> Anterior
            </Button>
            <span className="text-xs font-semibold px-1">Página {page}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={plans.length < 20}
              className="h-7 px-2 text-xs"
            >
              Próxima <ChevronRight className="size-3.5 ml-0.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Modais */}
      {formOpen && (
        <PlanFormModal
          isOpen={formOpen}
          planToEdit={selectedPlanForEdit}
          onClose={() => setFormOpen(false)}
          onSuccess={() => {
            loadPlans();
          }}
        />
      )}

      {detailOpen && selectedPlanForDetail && (
        <PlanDetailModal
          isOpen={detailOpen}
          plan={selectedPlanForDetail}
          onClose={() => setDetailOpen(false)}
          onEdit={(plan) => {
            setDetailOpen(false);
            handleOpenEdit(plan);
          }}
          onTransitionStatus={(plan, nextStatus) => {
            setDetailOpen(false);
            setPlanToTransition(plan);
            setTargetTransitionStatus(nextStatus);
            setTransitionOpen(true);
          }}
        />
      )}

      {transitionOpen && planToTransition && targetTransitionStatus && (
        <StatusTransitionModal
          isOpen={transitionOpen}
          plan={planToTransition}
          targetStatus={targetTransitionStatus}
          onClose={() => setTransitionOpen(false)}
          onSuccess={() => {
            loadPlans();
          }}
        />
      )}
    </div>
  );
}
