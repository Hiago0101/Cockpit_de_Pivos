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
import { CheckCircle2, AlertCircle } from "lucide-react";

interface OpportunityResolveModalProps {
  opportunity: Opportunity | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function OpportunityResolveModal({
  opportunity,
  isOpen,
  onClose,
  onSuccess,
}: OpportunityResolveModalProps) {
  const [justificativa, setJustificativa] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!opportunity) return;

    setLoading(true);
    setError(null);
    try {
      await api.resolveOpportunity(opportunity.id, justificativa.trim() || undefined);
      setJustificativa("");
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Erro ao resolver oportunidade.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-5" />
            <DialogTitle>Concluir / Resolver Oportunidade</DialogTitle>
          </div>
          <DialogDescription>
            Confirme que as ações agrícolas ou operacionais foram aproveitadas com sucesso.
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
            <Label htmlFor="justificativa-resolucao" className="text-xs font-semibold">
              Observações de Resolução (Opcional)
            </Label>
            <Textarea
              id="justificativa-resolucao"
              rows={3}
              className="text-xs"
              placeholder="Ex: Irrigação noturna executada conforme planejado; lâmina de 8mm aplicada."
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              size="sm"
              disabled={loading}
            >
              {loading ? "Gravando..." : "Confirmar Resolução"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
