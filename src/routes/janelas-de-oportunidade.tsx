import React, { useState, useEffect, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  api,
  type Opportunity,
  type OpportunityIndicators,
  type OpportunityStatus,
  type OpportunityPriority,
  type OpportunityType,
  type Farm,
} from "@/services/api";
import {
  OpportunityStatusBadge,
  OpportunityPriorityBadge,
  OpportunityTypeBadge,
  OpportunityOriginBadge,
} from "@/components/oportunidades/OpportunityBadges";
import { OpportunityDetailModal } from "@/components/oportunidades/OpportunityDetailModal";
import { OpportunityFormModal } from "@/components/oportunidades/OpportunityFormModal";
import { OpportunityDiscardModal } from "@/components/oportunidades/OpportunityDiscardModal";
import { OpportunityResolveModal } from "@/components/oportunidades/OpportunityResolveModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Plus,
  Search,
  RefreshCw,
  Filter,
  Eye,
  CheckCircle2,
  CheckCircle,
  XCircle,
  Edit,
  Clock,
  Calendar,
  AlertTriangle,
  PlayCircle,
  Layers,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Info,
  Check,
} from "lucide-react";

export const Route = createFileRoute("/janelas-de-oportunidade")({
  head: () => ({
    meta: [
      { title: "Janelas de Oportunidade — Cockpit de Pivôs" },
      { name: "description", content: "Acompanhamento, priorização e execução de janelas operacionais agrícolas." },
      { property: "og:title", content: "Janelas de Oportunidade — Cockpit de Pivôs" },
      { property: "og:description", content: "Acompanhamento, priorização e execução de janelas operacionais agrícolas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: JanelasOportunidadePage,
});

export function JanelasOportunidadePage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [indicators, setIndicators] = useState<OpportunityIndicators | null>(null);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [evaluatingRules, setEvaluatingRules] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);

  // Filtros
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [priorityFilter, setPriorityFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [farmFilter, setFarmFilter] = useState<string>("");
  const [vencidasFilter, setVencidasFilter] = useState<string>("");
  const [page, setPage] = useState(1);

  // Modais
  const [formOpen, setFormOpen] = useState(false);
  const [selectedOpportunityForEdit, setSelectedOpportunityForEdit] = useState<Opportunity | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedOpportunityForDetail, setSelectedOpportunityForDetail] = useState<Opportunity | null>(null);

  const [discardOpen, setDiscardOpen] = useState(false);
  const [selectedOpportunityForDiscard, setSelectedOpportunityForDiscard] = useState<Opportunity | null>(null);

  const [resolveOpen, setResolveOpen] = useState(false);
  const [selectedOpportunityForResolve, setSelectedOpportunityForResolve] = useState<Opportunity | null>(null);

  // Carrega lista de fazendas
  useEffect(() => {
    api.getFarms().then(setFarms).catch(() => setFarms([]));
  }, []);

  // Carrega dados principais e indicadores
  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const [oppsRes, indRes] = await Promise.all([
        api.getOpportunities({
          search: search || undefined,
          status: statusFilter || undefined,
          prioridade: priorityFilter || undefined,
          tipo: typeFilter || undefined,
          fazenda: farmFilter || undefined,
          vencidas: vencidasFilter === "true" ? true : vencidasFilter === "false" ? false : undefined,
          page: page,
        }),
        api.getOpportunityIndicators({
          fazenda: farmFilter || undefined,
        }).catch(() => null),
      ]);

      setOpportunities(oppsRes.results || []);
      setTotalCount(oppsRes.count || (oppsRes.results ? oppsRes.results.length : 0));
      if (indRes) setIndicators(indRes);
    } catch (err: any) {
      setErrorMessage(err?.message || "Não foi possível carregar as janelas de oportunidade.");
      setOpportunities([]);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, priorityFilter, typeFilter, farmFilter, vencidasFilter, page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Executa o motor de regras configurado
  const handleEvaluateRules = async () => {
    setEvaluatingRules(true);
    setBannerNotice(null);
    try {
      const res = await api.evaluateOpportunityRules(farmFilter || undefined);
      setBannerNotice(
        `Regras agrícolas avaliadas! ${res.novas_oportunidades_count} nova(s) oportunidade(s) detectada(s).`
      );
      loadData();
    } catch (err: any) {
      setErrorMessage(err?.message || "Erro ao executar avaliação de regras agrícolas.");
    } finally {
      setEvaluatingRules(false);
    }
  };

  // Reconhecimento direto
  const handleRecognize = async (opp: Opportunity) => {
    try {
      await api.recognizeOpportunity(opp.id);
      loadData();
      if (selectedOpportunityForDetail?.id === opp.id) {
        setDetailOpen(false);
      }
    } catch (err: any) {
      alert(err?.message || "Erro ao reconhecer oportunidade.");
    }
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Banner Superior */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary uppercase tracking-wider">
                Fase 4.2
              </span>
              <span className="text-xs text-muted-foreground">· Janelas de Oportunidade Agrícola</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Janelas de Oportunidade Agrícola
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Identifique, priorize e aproveite janelas temporais de tarifa noturna, plantio ideal e
              compensação hídrica integradas ao planejamento das safras e pivôs.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleEvaluateRules}
              disabled={evaluatingRules}
              className="gap-1.5 text-xs font-semibold"
            >
              <PlayCircle className={`size-3.5 text-primary ${evaluatingRules ? "animate-spin" : ""}`} />
              {evaluatingRules ? "Avaliando Regras..." : "Avaliar Regras do Sistema"}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setSelectedOpportunityForEdit(null);
                setFormOpen(true);
              }}
              className="gap-1.5 text-xs font-semibold"
            >
              <Plus className="size-3.5" />
              Nova Oportunidade
            </Button>
          </div>
        </div>

        {/* Notificação Banner */}
        {bannerNotice && (
          <div className="mt-4 flex items-center justify-between rounded-lg border border-primary/20 bg-primary/10 p-3 text-xs text-primary">
            <div className="flex items-center gap-2">
              <Check className="size-4 shrink-0" />
              <span>{bannerNotice}</span>
            </div>
            <button
              onClick={() => setBannerNotice(null)}
              className="text-xs font-semibold hover:underline"
            >
              Fechar
            </button>
          </div>
        )}

        {/* Contadores e Indicadores Consolidados */}
        {indicators && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-6 border-t border-border">
            <div className="rounded-xl border border-border bg-background p-3">
              <div className="text-[11px] font-medium text-muted-foreground">Total de Janelas</div>
              <div className="text-xl font-bold text-foreground mt-0.5">{indicators.total}</div>
            </div>
            <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-3">
              <div className="text-[11px] font-medium text-sky-600 dark:text-sky-400">Detectadas</div>
              <div className="text-xl font-bold text-sky-600 dark:text-sky-400 mt-0.5">
                {indicators.por_status?.DETECTADA ?? 0}
              </div>
            </div>
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
              <div className="text-[11px] font-medium text-amber-600 dark:text-amber-400">Reconhecidas</div>
              <div className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                {indicators.por_status?.RECONHECIDA ?? 0}
              </div>
            </div>
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
              <div className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">Resolvidas</div>
              <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                {indicators.por_status?.RESOLVIDA ?? 0}
              </div>
            </div>
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3">
              <div className="text-[11px] font-medium text-red-600 dark:text-red-400">Críticas & Altas</div>
              <div className="text-xl font-bold text-red-600 dark:text-red-400 mt-0.5">
                {(indicators.por_prioridade?.CRITICA ?? 0) + (indicators.por_prioridade?.ALTA ?? 0)}
              </div>
            </div>
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-3">
              <div className="text-[11px] font-medium text-rose-600 dark:text-rose-400">Janelas Vencidas</div>
              <div className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-0.5">
                {indicators.vencidas ?? 0}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
          {/* Busca textual */}
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar por título ou motivo..."
              className="pl-8 text-xs h-9"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {/* Fazenda */}
          <div>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={farmFilter}
              onChange={(e) => {
                setFarmFilter(e.target.value);
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
          </div>

          {/* Situação */}
          <div>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todas as Situações</option>
              <option value="DETECTADA">Detectada</option>
              <option value="RECONHECIDA">Reconhecida</option>
              <option value="RESOLVIDA">Resolvida</option>
              <option value="DESCARTADA">Descartada</option>
            </select>
          </div>

          {/* Prioridade */}
          <div>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todas as Prioridades</option>
              <option value="CRITICA">Crítica</option>
              <option value="ALTA">Alta</option>
              <option value="MEDIA">Média</option>
              <option value="BAIXA">Baixa</option>
            </select>
          </div>

          {/* Vencimento */}
          <div>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={vencidasFilter}
              onChange={(e) => {
                setVencidasFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todas as Validades</option>
              <option value="false">Janelas Vigentes</option>
              <option value="true">Janelas Vencidas</option>
            </select>
          </div>
        </div>

        {/* Segunda Linha de Filtros: Tipo e Botão Reset */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/50">
          <div className="flex items-center gap-2">
            <Filter className="size-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-medium">Tipo:</span>
            <select
              className="flex h-8 rounded-md border border-input bg-background px-2 py-0.5 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todos os Tipos</option>
              <option value="TARIFA_NOTURNA">Tarifa Noturna</option>
              <option value="JANELA_PLANTIO">Janela de Plantio</option>
              <option value="JANELA_COLHEITA">Janela de Colheita</option>
              <option value="APORTE_HIDRICO">Aporte Hídrico</option>
              <option value="MANUTENCAO_PREVENTIVA">Manutenção</option>
              <option value="TRATAMENTO_FITOSSANITARIO">Fitossanitário</option>
              <option value="OUTRO">Outro</option>
            </select>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              setStatusFilter("");
              setPriorityFilter("");
              setTypeFilter("");
              setFarmFilter("");
              setVencidasFilter("");
              setPage(1);
            }}
            className="text-xs text-muted-foreground hover:text-foreground h-8"
          >
            Limpar Filtros
          </Button>
        </div>
      </div>

      {/* Alerta de Erro */}
      {errorMessage && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-xs text-destructive">
          <AlertTriangle className="size-4 shrink-0" />
          <span>{errorMessage}</span>
          <Button variant="ghost" size="sm" onClick={loadData} className="ml-auto text-xs h-7">
            Tentar novamente
          </Button>
        </div>
      )}

      {/* Listagem de Oportunidades */}
      {loading ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center shadow-sm">
          <RefreshCw className="size-6 animate-spin mx-auto text-primary mb-3" />
          <p className="text-xs text-muted-foreground">Carregando janelas de oportunidade agrícolas...</p>
        </div>
      ) : opportunities.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center shadow-sm space-y-3">
          <Sparkles className="size-8 mx-auto text-muted-foreground/60" />
          <h3 className="text-sm font-semibold text-foreground">Nenhuma oportunidade encontrada</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Não há oportunidades registradas para os filtros aplicados. Você pode criar uma
            oportunidade manual ou rodar o motor de regras.
          </p>
          <div className="flex items-center justify-center gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleEvaluateRules}
              disabled={evaluatingRules}
              className="text-xs gap-1.5"
            >
              <PlayCircle className="size-3.5 text-primary" />
              Avaliar Regras
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setSelectedOpportunityForEdit(null);
                setFormOpen(true);
              }}
              className="text-xs gap-1.5"
            >
              <Plus className="size-3.5" />
              Cadastrar Oportunidade
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {opportunities.map((opp) => {
              const isEditable = opp.status === "DETECTADA" || opp.status === "RECONHECIDA";
              return (
                <div
                  key={opp.id}
                  className="rounded-xl border border-border bg-card p-4 shadow-sm hover:shadow transition-all flex flex-col justify-between space-y-3"
                >
                  {/* Topo do Card */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-1.5">
                      <OpportunityPriorityBadge priority={opp.prioridade} />
                      <div className="flex items-center gap-1">
                        <OpportunityStatusBadge status={opp.status} />
                        {opp.is_vencida && opp.status !== "RESOLVIDA" && opp.status !== "DESCARTADA" && (
                          <Badge variant="outline" className="border-red-500/40 text-red-600 dark:text-red-400 text-[10px]">
                            Vencida
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold text-foreground text-sm line-clamp-1">
                        {opp.titulo}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <OpportunityTypeBadge type={opp.tipo} />
                        <span className="text-[11px] text-muted-foreground">·</span>
                        <OpportunityOriginBadge origin={opp.origem} />
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {opp.descricao || "Sem descrição operacional informada."}
                    </p>

                    {/* Período da Janela */}
                    <div className="rounded-lg border border-border bg-muted/30 p-2.5 text-[11px] space-y-1">
                      <div className="flex items-center gap-1.5 font-medium text-foreground">
                        <Clock className="size-3 text-primary" />
                        <span>Janela Operacional:</span>
                      </div>
                      <div className="text-muted-foreground pl-4">
                        {formatDate(opp.inicio_janela)} até {formatDate(opp.fim_janela)}
                      </div>
                    </div>

                    {/* Vínculos (Fazenda, Pivô, Talhão, Safra) */}
                    <div className="flex flex-wrap gap-1 text-[10px] text-muted-foreground pt-1">
                      <span className="inline-flex items-center gap-1 bg-muted/60 px-2 py-0.5 rounded">
                        <MapPin className="size-2.5" />
                        {opp.fazenda_nome || "Fazenda"}
                      </span>
                      {opp.pivo_nome && (
                        <span className="inline-flex items-center gap-1 bg-muted/60 px-2 py-0.5 rounded">
                          {opp.pivo_nome}
                        </span>
                      )}
                      {opp.talhao_nome && (
                        <span className="inline-flex items-center gap-1 bg-muted/60 px-2 py-0.5 rounded">
                          {opp.talhao_nome}
                        </span>
                      )}
                      {opp.safra_nome && (
                        <span className="inline-flex items-center gap-1 bg-muted/60 px-2 py-0.5 rounded">
                          {opp.safra_nome}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Rodapé e Ações do Card */}
                  <div className="pt-2 border-t border-border flex items-center justify-between gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-8 px-2 gap-1 text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setSelectedOpportunityForDetail(opp);
                        setDetailOpen(true);
                      }}
                    >
                      <Eye className="size-3.5" />
                      Detalhes
                    </Button>

                    <div className="flex items-center gap-1">
                      {opp.status === "DETECTADA" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-8 px-2 text-amber-600 hover:text-amber-700 hover:bg-amber-500/10"
                          onClick={() => handleRecognize(opp)}
                          title="Reconhecer oportunidade"
                        >
                          <CheckCircle2 className="size-3.5" />
                        </Button>
                      )}

                      {isEditable && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-8 px-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                            onClick={() => {
                              setSelectedOpportunityForResolve(opp);
                              setResolveOpen(true);
                            }}
                            title="Resolver/Aproveitar oportunidade"
                          >
                            <CheckCircle className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-8 px-2 text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              setSelectedOpportunityForDiscard(opp);
                              setDiscardOpen(true);
                            }}
                            title="Descartar oportunidade"
                          >
                            <XCircle className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-8 px-2 text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              setSelectedOpportunityForEdit(opp);
                              setFormOpen(true);
                            }}
                            title="Editar oportunidade"
                          >
                            <Edit className="size-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Paginação */}
          {totalCount > 10 && (
            <div className="flex items-center justify-between rounded-xl border border-border bg-card p-3 shadow-sm text-xs">
              <span className="text-muted-foreground">
                Total de <strong>{totalCount}</strong> oportunidades registradas
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="h-8 gap-1 text-xs"
                >
                  <ChevronLeft className="size-3.5" />
                  Anterior
                </Button>
                <span className="text-muted-foreground font-medium px-2">Página {page}</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page * 10 >= totalCount}
                  onClick={() => setPage((p) => p + 1)}
                  className="h-8 gap-1 text-xs"
                >
                  Próxima
                  <ChevronRight className="size-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modais do Módulo */}
      <OpportunityDetailModal
        opportunity={selectedOpportunityForDetail}
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        onEdit={(opp) => {
          setDetailOpen(false);
          setSelectedOpportunityForEdit(opp);
          setFormOpen(true);
        }}
        onRecognize={(opp) => handleRecognize(opp)}
        onResolve={(opp) => {
          setDetailOpen(false);
          setSelectedOpportunityForResolve(opp);
          setResolveOpen(true);
        }}
        onDiscard={(opp) => {
          setDetailOpen(false);
          setSelectedOpportunityForDiscard(opp);
          setDiscardOpen(true);
        }}
      />

      <OpportunityFormModal
        opportunityToEdit={selectedOpportunityForEdit}
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        onSuccess={loadData}
      />

      <OpportunityDiscardModal
        opportunity={selectedOpportunityForDiscard}
        isOpen={discardOpen}
        onClose={() => setDiscardOpen(false)}
        onSuccess={loadData}
      />

      <OpportunityResolveModal
        opportunity={selectedOpportunityForResolve}
        isOpen={resolveOpen}
        onClose={() => setResolveOpen(false)}
        onSuccess={loadData}
      />
    </div>
  );
}