import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "./StatusBadge";
import {
  api,
  type CropPlan,
  type PlanAuditItem,
  type CropPlanStatus,
} from "@/services/api";
import {
  Calendar,
  Sprout,
  Droplets,
  Layers,
  History,
  FileText,
  Clock,
  ArrowRight,
  Shield,
  Edit,
  CheckCircle,
  XCircle,
} from "lucide-react";

interface PlanDetailModalProps {
  plan: CropPlan | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (plan: CropPlan) => void;
  onTransitionStatus: (plan: CropPlan, targetStatus: CropPlanStatus) => void;
}

export function PlanDetailModal({
  plan,
  isOpen,
  onClose,
  onEdit,
  onTransitionStatus,
}: PlanDetailModalProps) {
  const [activeTab, setActiveTab] = useState<"detalhes" | "auditoria">("detalhes");
  const [auditLogs, setAuditLogs] = useState<PlanAuditItem[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  useEffect(() => {
    if (plan && isOpen && activeTab === "auditoria") {
      setLoadingAudit(true);
      api
        .getPlanAudit(plan.id)
        .then((res) => setAuditLogs(res.results || []))
        .catch(() => setAuditLogs([]))
        .finally(() => setLoadingAudit(false));
    }
  }, [plan, isOpen, activeTab]);

  if (!plan) return null;

  // Cálculo de progresso de ciclo em dias
  const plantDate = new Date(plan.data_plantio);
  const harvestDate = new Date(plan.data_colheita_prevista);
  const today = new Date();
  const totalDays = Math.max(1, Math.round((harvestDate.getTime() - plantDate.getTime()) / (1000 * 60 * 60 * 24)));
  const daysPassed = Math.max(0, Math.round((today.getTime() - plantDate.getTime()) / (1000 * 60 * 60 * 24)));
  const cyclePercent = Math.min(100, Math.max(0, Math.round((daysPassed / totalDays) * 100)));

  // Lâmina acumulada
  const laminaPlanejada = plan.lamina_total_planejada_mm || 0;
  const laminaRealizada = plan.lamina_acumulada_realizada_mm || 0;
  const waterPercent = laminaPlanejada > 0 ? Math.min(100, Math.round((laminaRealizada / laminaPlanejada) * 100)) : 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b border-border pb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <Sprout className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-foreground">
                  {plan.cultura_nome}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Safra {plan.safra_nome} · {plan.fazenda_nome || "Fazenda Geral"}
                </DialogDescription>
              </div>
            </div>
            <StatusBadge status={plan.status} className="text-xs px-2.5 py-1" />
          </div>

          <div className="flex items-center gap-2 mt-3 pt-2">
            <button
              onClick={() => setActiveTab("detalhes")}
              className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${
                activeTab === "detalhes"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              Ficha Técnica do Cultivo
            </button>
            <button
              onClick={() => setActiveTab("auditoria")}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${
                activeTab === "auditoria"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <History className="size-3.5" />
              Trilha de Auditoria
            </button>
          </div>
        </DialogHeader>

        {activeTab === "detalhes" ? (
          <div className="space-y-4 py-2">
            {/* Grid de Métricas Principais */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Área Planejada
                </span>
                <p className="mt-1 text-lg font-bold text-foreground">
                  {Number(plan.area_planejada_ha).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  <span className="text-xs font-normal text-muted-foreground ml-1">ha</span>
                </p>
              </div>

              <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Plantio (Prev. · Real)
                </span>
                <p className="mt-1 text-xs font-semibold text-foreground flex items-center gap-1">
                  <Calendar className="size-3.5 text-primary shrink-0" />
                  <span>Prev: {plan.data_plantio ? new Date(plan.data_plantio + "T00:00:00").toLocaleDateString("pt-BR") : "—"}</span>
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Real: {plan.data_plantio_real ? (
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {new Date(plan.data_plantio_real + "T00:00:00").toLocaleDateString("pt-BR")}
                    </span>
                  ) : "Não realizado"}
                </p>
              </div>

              <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Colheita (Prev. · Real)
                </span>
                <p className="mt-1 text-xs font-semibold text-foreground flex items-center gap-1">
                  <Calendar className="size-3.5 text-amber-500 shrink-0" />
                  <span>Prev: {plan.data_colheita_prevista ? new Date(plan.data_colheita_prevista + "T00:00:00").toLocaleDateString("pt-BR") : "—"}</span>
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Real: {plan.data_colheita_real ? (
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {new Date(plan.data_colheita_real + "T00:00:00").toLocaleDateString("pt-BR")}
                    </span>
                  ) : "Não realizada"}
                </p>
              </div>

              <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Ciclo Total
                </span>
                <p className="mt-1 text-sm font-semibold text-foreground flex items-center gap-1">
                  <Clock className="size-3.5 text-blue-500 shrink-0" />
                  {totalDays} dias
                </p>
              </div>
            </div>

            {/* Aviso de Sobreposição Autorizada */}
            {plan.permite_sobreposicao && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/50 p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-400">
                  <Shield className="size-3.5" />
                  Sobreposição de Datas Autorizada
                </div>
                {plan.autorizado_por_nome && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-300">
                    Autorizado por: <span className="font-semibold">{plan.autorizado_por_nome}</span>
                  </p>
                )}
                {plan.justificativa_sobreposicao && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 italic">
                    "{plan.justificativa_sobreposicao}"
                  </p>
                )}
              </div>
            )}

            {/* Alocação Física e Equipamentos */}
            <div className="rounded-xl border border-border bg-muted/30 p-3.5 space-y-2.5">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="size-3.5 text-primary" />
                Estrutura Agrícola & Associação
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Unidade / Fazenda:</span>
                  <span className="font-semibold text-foreground">{plan.fazenda_nome || "Não especificada"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Talhão de Cultivo:</span>
                  <span className="font-semibold text-foreground">
                    {plan.talhao_codigo ? `${plan.talhao_codigo} (${plan.talhao_nome || ""})` : "Área contínua"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Pivô Central:</span>
                  <span className="font-semibold text-foreground">
                    {plan.pivo_codigo ? `${plan.pivo_codigo} · ${plan.pivo_nome || ""}` : "Sem pivô fixo (Área não irrigada)"}
                  </span>
                </div>
              </div>
            </div>

            {/* Barra de Progresso do Ciclo Agrícola */}
            <div className="rounded-xl border border-border bg-card p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-foreground">Evolução do Ciclo Vegetativo</span>
                <span className="text-primary">{cyclePercent}% decorrido</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${cyclePercent}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Plantio: {plan.data_plantio}</span>
                <span>{daysPassed} de {totalDays} dias</span>
                <span>Colheita: {plan.data_colheita_prevista}</span>
              </div>
            </div>

            {/* Metas Hídricas e Irrigação */}
            <div className="rounded-xl border border-border bg-card p-3.5 space-y-2.5">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Droplets className="size-3.5 text-blue-500" />
                Manejo de Irrigação & Lâmina
              </h4>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg bg-blue-500/5 border border-blue-500/20 p-2.5">
                  <span className="text-muted-foreground text-[11px] block">Lâmina Planejada</span>
                  <span className="text-base font-bold text-foreground">{laminaPlanejada} mm</span>
                </div>
                <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-2.5">
                  <span className="text-muted-foreground text-[11px] block">Lâmina Realizada Acumulada</span>
                  <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                    {laminaRealizada} mm ({waterPercent}%)
                  </span>
                </div>
              </div>
            </div>

            {/* Observações Agronômicas */}
            {plan.observacoes && (
              <div className="rounded-xl border border-border bg-card p-3.5 space-y-1.5">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="size-3.5 text-muted-foreground" />
                  Observações & Prescrições
                </h4>
                <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {plan.observacoes}
                </p>
              </div>
            )}
          </div>
        ) : (
          /* Trilha de Auditoria e Rastreabilidade */
          <div className="py-2 space-y-3">
            {loadingAudit ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                Carregando registros de auditoria corporativa...
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                Nenhuma alteração registrada ainda para este planejamento.
              </div>
            ) : (
              <div className="space-y-2.5">
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-lg border border-border bg-card p-3 text-xs space-y-1 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground flex items-center gap-1.5">
                        <Shield className="size-3.5 text-primary" />
                        Operação: <Badge variant="outline" className="text-[10px] uppercase font-bold">{log.acao}</Badge>
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(log.criado_em).toLocaleString("pt-BR")}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Usuário: <span className="font-medium text-foreground">@{log.usuario}</span>
                      {log.ip_address && ` · IP: ${log.ip_address}`}
                    </div>
                    {log.detalhes && Object.keys(log.detalhes).length > 0 && (
                      <pre className="mt-1.5 rounded bg-muted/60 p-2 text-[10px] text-foreground font-mono overflow-x-auto">
                        {JSON.stringify(log.detalhes, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0 border-t border-border pt-3">
          <div className="flex flex-wrap items-center justify-between w-full gap-2">
            <div className="flex items-center gap-1.5">
              {/* Ações de Transição Rápida conforme estado */}
              {plan.status === "RASCUNHO" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1 border-blue-500/40 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                  onClick={() => onTransitionStatus(plan, "PLANEJADO")}
                >
                  <ArrowRight className="size-3.5" />
                  Aprovar Plano
                </Button>
              )}

              {plan.status === "PLANEJADO" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1 border-emerald-500/40 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                  onClick={() => onTransitionStatus(plan, "EM_ANDAMENTO")}
                >
                  <CheckCircle className="size-3.5" />
                  Iniciar Plantio
                </Button>
              )}

              {plan.status === "EM_ANDAMENTO" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1 border-purple-500/40 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/40"
                  onClick={() => onTransitionStatus(plan, "CONCLUIDO")}
                >
                  <CheckCircle className="size-3.5" />
                  Concluir Ciclo
                </Button>
              )}

              {plan.status !== "CANCELADO" && plan.status !== "CONCLUIDO" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs gap-1 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                  onClick={() => onTransitionStatus(plan, "CANCELADO")}
                >
                  <XCircle className="size-3.5" />
                  Cancelar
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1"
                onClick={() => {
                  onClose();
                  onEdit(plan);
                }}
              >
                <Edit className="size-3.5" />
                Editar
              </Button>
              <Button variant="default" size="sm" onClick={onClose}>
                Fechar
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
