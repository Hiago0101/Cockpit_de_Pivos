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
import {
  OpportunityStatusBadge,
  OpportunityPriorityBadge,
  OpportunityTypeBadge,
  OpportunityOriginBadge,
} from "./OpportunityBadges";
import {
  api,
  type Opportunity,
  type OpportunityAuditItem,
} from "@/services/api";
import {
  Calendar,
  Clock,
  MapPin,
  Sprout,
  CircleDot,
  Layers,
  History,
  FileText,
  AlertCircle,
  CheckCircle2,
  CheckCircle,
  XCircle,
  Edit,
  Eye,
  Info,
  CalendarDays,
} from "lucide-react";

interface OpportunityDetailModalProps {
  opportunity: Opportunity | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (opportunity: Opportunity) => void;
  onRecognize?: (opportunity: Opportunity) => void;
  onResolve?: (opportunity: Opportunity) => void;
  onDiscard?: (opportunity: Opportunity) => void;
}

export function OpportunityDetailModal({
  opportunity,
  isOpen,
  onClose,
  onEdit,
  onRecognize,
  onResolve,
  onDiscard,
}: OpportunityDetailModalProps) {
  const [activeTab, setActiveTab] = useState<"detalhes" | "vinculos" | "auditoria">("detalhes");
  const [auditLogs, setAuditLogs] = useState<OpportunityAuditItem[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  useEffect(() => {
    if (opportunity && isOpen && activeTab === "auditoria") {
      setLoadingAudit(true);
      api
        .getOpportunityAudit(opportunity.id)
        .then((res) => setAuditLogs(res.results || []))
        .catch(() => setAuditLogs([]))
        .finally(() => setLoadingAudit(false));
    }
  }, [opportunity, isOpen, activeTab]);

  if (!opportunity) return null;

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

  const isEditable = opportunity.status === "DETECTADA" || opportunity.status === "RECONHECIDA";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <OpportunityPriorityBadge priority={opportunity.prioridade} />
            <OpportunityStatusBadge status={opportunity.status} />
            <OpportunityOriginBadge origin={opportunity.origem} />
            {opportunity.is_vencida && opportunity.status !== "RESOLVIDA" && opportunity.status !== "DESCARTADA" && (
              <Badge variant="outline" className="border-red-500/50 bg-red-500/10 text-red-600 dark:text-red-400 text-xs">
                Vencida
              </Badge>
            )}
          </div>
          <DialogTitle className="text-lg font-bold flex items-center justify-between gap-2">
            <span>{opportunity.titulo}</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground flex items-center gap-2">
            <OpportunityTypeBadge type={opportunity.tipo} />
            <span>· Fazenda: <strong>{opportunity.fazenda_nome || "—"}</strong></span>
          </DialogDescription>
        </DialogHeader>

        {/* Abas */}
        <div className="flex border-b border-border my-2">
          <button
            onClick={() => setActiveTab("detalhes")}
            className={`px-3 py-1.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === "detalhes"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileText className="size-3.5" />
            Detalhes & Período
          </button>
          <button
            onClick={() => setActiveTab("vinculos")}
            className={`px-3 py-1.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === "vinculos"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Layers className="size-3.5" />
            Vínculos Agrícolas
          </button>
          <button
            onClick={() => setActiveTab("auditoria")}
            className={`px-3 py-1.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === "auditoria"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <History className="size-3.5" />
            Trilha de Auditoria
          </button>
        </div>

        {/* Tab Detalhes */}
        {activeTab === "detalhes" && (
          <div className="space-y-4 py-1 text-xs">
            {/* Box do Período */}
            <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-2">
              <div className="flex items-center gap-1.5 font-semibold text-foreground">
                <Clock className="size-4 text-primary" />
                Janela Temporal de Operação
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-muted-foreground">
                <div>
                  <span className="block text-[11px]">Início da Janela:</span>
                  <span className="font-semibold text-foreground">{formatDate(opportunity.inicio_janela)}</span>
                </div>
                <div>
                  <span className="block text-[11px]">Término da Janela:</span>
                  <span className="font-semibold text-foreground">{formatDate(opportunity.fim_janela)}</span>
                </div>
              </div>
            </div>

            {/* Descrição */}
            <div className="space-y-1">
              <span className="font-semibold text-foreground">Descrição Operacional</span>
              <p className="text-muted-foreground bg-card p-3 rounded-md border border-border leading-relaxed">
                {opportunity.descricao || "Nenhuma descrição detalhada informada."}
              </p>
            </div>

            {/* Justificativa / Evidência */}
            {opportunity.justificativa && (
              <div className="space-y-1">
                <span className="font-semibold text-foreground">Justificativa / Observações</span>
                <p className="text-muted-foreground bg-card p-3 rounded-md border border-border leading-relaxed">
                  {opportunity.justificativa}
                </p>
              </div>
            )}

            {/* Motivo de Descarte se houver */}
            {opportunity.motivo_descarte && (
              <div className="space-y-1 rounded-md border border-destructive/20 bg-destructive/10 p-3">
                <span className="font-semibold text-destructive flex items-center gap-1">
                  <XCircle className="size-3.5" />
                  Motivo do Descarte
                </span>
                <p className="text-destructive/90">{opportunity.motivo_descarte}</p>
                <div className="text-[10px] text-destructive/70 mt-1">
                  Descartado em: {formatDate(opportunity.descartado_em)}
                </div>
              </div>
            )}

            {/* Ciclo de vida */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-border text-[11px] text-muted-foreground">
              <div>
                <span>Criado por:</span>{" "}
                <strong className="text-foreground">{opportunity.autor_nome || "Sistema"}</strong>
              </div>
              <div>
                <span>Criado em:</span>{" "}
                <strong className="text-foreground">{formatDate(opportunity.criado_em)}</strong>
              </div>
              {opportunity.reconhecido_em && (
                <div>
                  <span>Reconhecido em:</span>{" "}
                  <strong className="text-foreground">{formatDate(opportunity.reconhecido_em)}</strong>
                </div>
              )}
              {opportunity.resolvido_em && (
                <div>
                  <span>Resolvido em:</span>{" "}
                  <strong className="text-foreground">{formatDate(opportunity.resolvido_em)}</strong>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab Vínculos Agrícolas */}
        {activeTab === "vinculos" && (
          <div className="space-y-3 py-1 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-lg border border-border p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <MapPin className="size-3.5 text-primary" />
                  Fazenda
                </div>
                <div className="font-semibold text-foreground text-sm">
                  {opportunity.fazenda_nome || "—"}
                </div>
              </div>

              <div className="rounded-lg border border-border p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <CircleDot className="size-3.5 text-primary" />
                  Pivô Central
                </div>
                <div className="font-semibold text-foreground text-sm">
                  {opportunity.pivo_nome || opportunity.pivo_codigo || "Nenhum pivô vinculado"}
                </div>
              </div>

              <div className="rounded-lg border border-border p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Layers className="size-3.5 text-primary" />
                  Talhão
                </div>
                <div className="font-semibold text-foreground text-sm">
                  {opportunity.talhao_nome || opportunity.talhao_codigo || "Nenhum talhão vinculado"}
                </div>
              </div>

              <div className="rounded-lg border border-border p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <CalendarDays className="size-3.5 text-primary" />
                  Safra / Ciclo
                </div>
                <div className="font-semibold text-foreground text-sm">
                  {opportunity.safra_nome || "Nenhuma safra vinculada"}
                </div>
              </div>

              <div className="rounded-lg border border-border p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Sprout className="size-3.5 text-primary" />
                  Cultura
                </div>
                <div className="font-semibold text-foreground text-sm">
                  {opportunity.cultura_nome || "Nenhuma cultura vinculada"}
                </div>
              </div>

              <div className="rounded-lg border border-border p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <FileText className="size-3.5 text-primary" />
                  Plano Operacional
                </div>
                <div className="font-semibold text-foreground text-sm">
                  {opportunity.plano_operacional_titulo || "Nenhum plano vinculado"}
                </div>
              </div>
            </div>

            {/* Evidências JSON */}
            {opportunity.evidencia_dados && Object.keys(opportunity.evidencia_dados).length > 0 && (
              <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3 space-y-1.5">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <Info className="size-3.5 text-primary" />
                  Parâmetros de Detecção e Evidência
                </span>
                <pre className="text-[11px] bg-background p-2 rounded border border-border overflow-x-auto">
                  {JSON.stringify(opportunity.evidencia_dados, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Tab Auditoria */}
        {activeTab === "auditoria" && (
          <div className="space-y-3 py-1">
            {loadingAudit ? (
              <div className="py-8 text-center text-xs text-muted-foreground">Carregando histórico...</div>
            ) : auditLogs.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                Nenhum evento registrado nesta oportunidade.
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-lg border border-border bg-card p-2.5 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-foreground uppercase tracking-wide">
                        {log.acao}
                      </span>
                      <span className="text-muted-foreground">{formatDate(log.criado_em)}</span>
                    </div>
                    <div className="text-muted-foreground">
                      Usuário: <span className="font-medium text-foreground">{log.usuario}</span>
                      {log.ip_address && <span className="ml-2 text-[10px]">({log.ip_address})</span>}
                    </div>
                    {log.detalhes && Object.keys(log.detalhes).length > 0 && (
                      <div className="text-[10px] bg-muted/40 p-1.5 rounded border border-border font-mono text-muted-foreground">
                        {JSON.stringify(log.detalhes)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border">
          <div className="flex items-center gap-1.5">
            {opportunity.status === "DETECTADA" && onRecognize && (
              <Button
                variant="outline"
                size="sm"
                className="text-amber-600 border-amber-500/40 hover:bg-amber-500/10 gap-1 text-xs"
                onClick={() => onRecognize(opportunity)}
              >
                <Eye className="size-3.5" />
                Reconhecer
              </Button>
            )}

            {isEditable && onResolve && (
              <Button
                variant="outline"
                size="sm"
                className="text-emerald-600 border-emerald-500/40 hover:bg-emerald-500/10 gap-1 text-xs"
                onClick={() => onResolve(opportunity)}
              >
                <CheckCircle className="size-3.5" />
                Resolver
              </Button>
            )}

            {isEditable && onDiscard && (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive border-destructive/40 hover:bg-destructive/10 gap-1 text-xs"
                onClick={() => onDiscard(opportunity)}
              >
                <XCircle className="size-3.5" />
                Descartar
              </Button>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {isEditable && onEdit && (
              <Button
                variant="secondary"
                size="sm"
                className="gap-1 text-xs"
                onClick={() => onEdit(opportunity)}
              >
                <Edit className="size-3.5" />
                Editar
              </Button>
            )}
            <Button variant="outline" size="sm" className="text-xs" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
