import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "./StatusBadge";
import { api, type CropPlan, type CropPlanStatus } from "@/services/api";
import { ArrowRight, AlertTriangle, CheckCircle2 } from "lucide-react";

interface StatusTransitionModalProps {
  plan: CropPlan | null;
  targetStatus: CropPlanStatus | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function StatusTransitionModal({
  plan,
  targetStatus,
  isOpen,
  onClose,
  onSuccess,
}: StatusTransitionModalProps) {
  const [motivo, setMotivo] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!plan || !targetStatus) return null;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await api.transitionPlanStatus(plan.id, targetStatus, motivo);
      setMotivo("");
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Erro ao atualizar status do planejamento.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTransitionTitle = () => {
    switch (targetStatus) {
      case "PLANEJADO":
        return "Aprovar e Marcar como Planejado";
      case "EM_ANDAMENTO":
        return "Iniciar Execução do Plantio";
      case "CONCLUIDO":
        return "Finalizar e Concluir Ciclo de Cultivo";
      case "CANCELADO":
        return "Cancelar Planejamento";
      case "RASCUNHO":
        return "Retornar para Rascunho";
      default:
        return "Alterar Situação";
    }
  };

  const isDestructive = targetStatus === "CANCELADO";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground text-lg">
            {isDestructive ? (
              <AlertTriangle className="size-5 text-rose-500" />
            ) : (
              <CheckCircle2 className="size-5 text-primary" />
            )}
            {getTransitionTitle()}
          </DialogTitle>
          <DialogDescription>
            Confirme a transição operacional para o plano de cultivo da cultura{" "}
            <strong>{plan.cultura_nome}</strong> na safra <strong>{plan.safra_nome}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-3">
          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 p-3">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] text-muted-foreground">Situação Atual</span>
              <StatusBadge status={plan.status} />
            </div>
            <ArrowRight className="size-5 text-muted-foreground" />
            <div className="flex flex-col gap-1 items-end">
              <span className="text-[11px] text-muted-foreground">Nova Situação</span>
              <StatusBadge status={targetStatus} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="motivo" className="text-xs">
              Motivo ou Observações da Mudança (Opcional)
            </Label>
            <Textarea
              id="motivo"
              placeholder="Ex: Plantio iniciado com chuvas regulares ou colheita concluída com sucesso."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              className="resize-none text-xs"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
            Voltar
          </Button>
          <Button
            variant={isDestructive ? "destructive" : "default"}
            size="sm"
            onClick={handleConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Gravando..." : "Confirmar Alteração"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
