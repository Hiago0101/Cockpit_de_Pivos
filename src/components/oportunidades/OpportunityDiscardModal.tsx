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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, type Opportunity } from "@/services/api";
import { XCircle, AlertCircle } from "lucide-react";

interface OpportunityDiscardModalProps {
  opportunity: Opportunity | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function OpportunityDiscardModal({
  opportunity,
  isOpen,
  onClose,
  onSuccess,
}: OpportunityDiscardModalProps) {
  const [motivo, setMotivo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!opportunity) return;
    if (!motivo.trim()) {
      setError("A justificativa de descarte é obrigatória.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await api.discardOpportunity(opportunity.id, motivo.trim());
      setMotivo("");
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Erro ao descartar oportunidade.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-destructive">
            <XCircle className="size-5" />
            <DialogTitle>Descartar Oportunidade</DialogTitle>
          </div>
          <DialogDescription>
            Informe a justificativa técnica ou operacional para arquivar esta oportunidade.
          </DialogDescription>
        </DialogHeader>

        {opportunity && (
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs space-y-1">
            <div className="font-semibold text-foreground">{opportunity.titulo}</div>
            <div className="text-muted-foreground">{opportunity.descricao}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="motivo-descarte" className="text-xs font-semibold">
              Motivo do Descarte *
            </Label>
            <Textarea
              id="motivo-descarte"
              rows={3}
              className="text-xs"
              placeholder="Ex: Condições operacionais impediram o uso do intervalo noturno; replanejado para o próximo ciclo."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              required
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="destructive"
              size="sm"
              disabled={loading || !motivo.trim()}
            >
              {loading ? "Descartando..." : "Confirmar Descarte"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
