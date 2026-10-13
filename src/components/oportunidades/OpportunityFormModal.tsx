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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  api,
  type Opportunity,
  type OpportunityType,
  type OpportunityPriority,
  type Farm,
  type Field,
  type Pivot,
  type Season,
  type Crop,
  type CropPlan,
} from "@/services/api";
import { Sparkles, AlertCircle, Calendar } from "lucide-react";

interface OpportunityFormModalProps {
  opportunityToEdit?: Opportunity | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function OpportunityFormModal({
  opportunityToEdit,
  isOpen,
  onClose,
  onSuccess,
}: OpportunityFormModalProps) {
  const isEditing = Boolean(opportunityToEdit);

  const [farms, setFarms] = useState<Farm[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [pivots, setPivots] = useState<Pivot[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [plans, setPlans] = useState<CropPlan[]>([]);

  const [formData, setFormData] = useState({
    titulo: "",
    descricao: "",
    tipo: "TARIFA_NOTURNA" as OpportunityType,
    prioridade: "MEDIA" as OpportunityPriority,
    inicio_janela: "",
    fim_janela: "",
    fazenda: "",
    talhao: "",
    pivo: "",
    cultura: "",
    safra: "",
    plano_operacional: "",
    justificativa: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Carrega catálogos base
  useEffect(() => {
    if (isOpen) {
      Promise.all([
        api.getFarms().catch(() => []),
        api.getSeasons().catch(() => []),
        api.getCrops().catch(() => []),
      ]).then(([fData, sData, cData]) => {
        setFarms(fData);
        setSeasons(sData);
        setCrops(cData);
      });
    }
  }, [isOpen]);

  // Carrega talhões, pivôs e planos quando uma fazenda estiver selecionada
  useEffect(() => {
    if (formData.fazenda) {
      Promise.all([
        api.getFields({ fazenda: formData.fazenda }).catch(() => []),
        api.getPivots().catch(() => []),
        api.getPlans({ fazenda: formData.fazenda }).catch(() => ({ results: [] })),
      ]).then(([fieldsData, pivotsData, plansData]) => {
        setFields(fieldsData);
        setPivots(pivotsData.filter((p) => p.fazenda === formData.fazenda));
        setPlans(plansData.results || []);
      });
    } else {
      setFields([]);
      setPivots([]);
      setPlans([]);
    }
  }, [formData.fazenda]);

  // Preenche dados quando estiver editando ou abre o modal
  useEffect(() => {
    if (opportunityToEdit) {
      setFormData({
        titulo: opportunityToEdit.titulo || "",
        descricao: opportunityToEdit.descricao || "",
        tipo: opportunityToEdit.tipo || "TARIFA_NOTURNA",
        prioridade: opportunityToEdit.prioridade || "MEDIA",
        inicio_janela: opportunityToEdit.inicio_janela ? opportunityToEdit.inicio_janela.slice(0, 16) : "",
        fim_janela: opportunityToEdit.fim_janela ? opportunityToEdit.fim_janela.slice(0, 16) : "",
        fazenda: opportunityToEdit.fazenda || "",
        talhao: opportunityToEdit.talhao || "",
        pivo: opportunityToEdit.pivo || "",
        cultura: opportunityToEdit.cultura || "",
        safra: opportunityToEdit.safra || "",
        plano_operacional: opportunityToEdit.plano_operacional || "",
        justificativa: opportunityToEdit.justificativa || "",
      });
    } else {
      // Valores padrão para nova oportunidade
      const now = new Date();
      const inTwoHours = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      const toISOInput = (d: Date) => d.toISOString().slice(0, 16);

      setFormData({
        titulo: "",
        descricao: "",
        tipo: "TARIFA_NOTURNA",
        prioridade: "MEDIA",
        inicio_janela: toISOInput(now),
        fim_janela: toISOInput(inTwoHours),
        fazenda: farms[0]?.id || "",
        talhao: "",
        pivo: "",
        cultura: "",
        safra: "",
        plano_operacional: "",
        justificativa: "",
      });
    }
    setError(null);
  }, [opportunityToEdit, isOpen, farms]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validações básicas de UI
    if (!formData.fazenda) {
      setError("Selecione uma fazenda obrigatória.");
      return;
    }
    if (!formData.inicio_janela || !formData.fim_janela) {
      setError("Defina o período de início e término da janela.");
      return;
    }
    if (new Date(formData.inicio_janela) > new Date(formData.fim_janela)) {
      setError("O início da janela deve ser anterior ou igual ao término.");
      return;
    }

    const payload: Partial<Opportunity> = {
      titulo: formData.titulo.trim(),
      descricao: formData.descricao.trim(),
      tipo: formData.tipo,
      prioridade: formData.prioridade,
      inicio_janela: new Date(formData.inicio_janela).toISOString(),
      fim_janela: new Date(formData.fim_janela).toISOString(),
      fazenda: formData.fazenda,
      talhao: formData.talhao || null,
      pivo: formData.pivo || null,
      cultura: formData.cultura || null,
      safra: formData.safra || null,
      plano_operacional: formData.plano_operacional || null,
      justificativa: formData.justificativa.trim() || null,
    };

    setLoading(true);
    try {
      if (isEditing && opportunityToEdit) {
        await api.updateOpportunity(opportunityToEdit.id, payload);
      } else {
        await api.createOpportunity(payload);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Ocorreu um erro ao salvar a oportunidade agrícola.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="size-5" />
            <DialogTitle>
              {isEditing ? "Editar Janela de Oportunidade" : "Registrar Nova Oportunidade Agrícola"}
            </DialogTitle>
          </div>
          <DialogDescription>
            {isEditing
              ? "Atualize os detalhes, prioridade ou vínculos da oportunidade selecionada."
              : "Cadastre um período operacional favorável vinculado à infraestrutura agrícola."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs">
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Título & Tipo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="opp-titulo" className="text-xs font-semibold">
                Título da Oportunidade *
              </Label>
              <Input
                id="opp-titulo"
                className="text-xs"
                placeholder="Ex: Tarifa Super Reduzida Madrugada Pivô 01"
                value={formData.titulo}
                onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="opp-tipo" className="text-xs font-semibold">
                Tipo de Oportunidade *
              </Label>
              <select
                id="opp-tipo"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={formData.tipo}
                onChange={(e) => setFormData({ ...formData, tipo: e.target.value as OpportunityType })}
                required
              >
                <option value="TARIFA_NOTURNA">Tarifa Noturna Econômica</option>
                <option value="JANELA_PLANTIO">Janela de Plantio Recomendada</option>
                <option value="JANELA_COLHEITA">Janela de Colheita Operacional</option>
                <option value="APORTE_HIDRICO">Aporte Hídrico / Compensação</option>
                <option value="MANUTENCAO_PREVENTIVA">Manutenção Preventiva de Equipamento</option>
                <option value="TRATAMENTO_FITOSSANITARIO">Tratamento Fitossanitário</option>
                <option value="OUTRO">Outra Janela Operacional</option>
              </select>
            </div>
          </div>

          {/* Prioridade & Fazenda */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="opp-prioridade" className="text-xs font-semibold">
                Nível de Prioridade *
              </Label>
              <select
                id="opp-prioridade"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={formData.prioridade}
                onChange={(e) => setFormData({ ...formData, prioridade: e.target.value as OpportunityPriority })}
                required
              >
                <option value="BAIXA">Baixa</option>
                <option value="MEDIA">Média</option>
                <option value="ALTA">Alta</option>
                <option value="CRITICA">Crítica</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="opp-fazenda" className="text-xs font-semibold">
                Fazenda Operacional *
              </Label>
              <select
                id="opp-fazenda"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={formData.fazenda}
                onChange={(e) => {
                  setFormData({
                    ...formData,
                    fazenda: e.target.value,
                    talhao: "",
                    pivo: "",
                    safra: "",
                    plano_operacional: "",
                  });
                }}
                required
              >
                <option value="">Selecione a fazenda...</option>
                {farms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome} ({f.municipio} - {f.uf})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Início e Fim da Janela */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="opp-inicio" className="text-xs font-semibold">
                Início da Janela *
              </Label>
              <Input
                id="opp-inicio"
                type="datetime-local"
                className="text-xs"
                value={formData.inicio_janela}
                onChange={(e) => setFormData({ ...formData, inicio_janela: e.target.value })}
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="opp-fim" className="text-xs font-semibold">
                Término da Janela *
              </Label>
              <Input
                id="opp-fim"
                type="datetime-local"
                className="text-xs"
                value={formData.fim_janela}
                onChange={(e) => setFormData({ ...formData, fim_janela: e.target.value })}
                required
              />
            </div>
          </div>

          {/* Vínculos Opcionais: Pivô & Talhão */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="opp-pivo" className="text-xs font-semibold">
                Pivô Central (Opcional)
              </Label>
              <select
                id="opp-pivo"
                disabled={!formData.fazenda}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                value={formData.pivo}
                onChange={(e) => setFormData({ ...formData, pivo: e.target.value })}
              >
                <option value="">Nenhum pivô específico</option>
                {pivots.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome} ({p.codigo})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="opp-talhao" className="text-xs font-semibold">
                Talhão (Opcional)
              </Label>
              <select
                id="opp-talhao"
                disabled={!formData.fazenda}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                value={formData.talhao}
                onChange={(e) => setFormData({ ...formData, talhao: e.target.value })}
              >
                <option value="">Nenhum talhão específico</option>
                {fields.map((fld) => (
                  <option key={fld.id} value={fld.id}>
                    {fld.nome} ({fld.codigo}) - {fld.area_ha} ha
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Vínculos Opcionais: Safra, Cultura, Plano */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="opp-safra" className="text-xs font-semibold">
                Safra (Opcional)
              </Label>
              <select
                id="opp-safra"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={formData.safra}
                onChange={(e) => setFormData({ ...formData, safra: e.target.value })}
              >
                <option value="">Nenhuma safra específica</option>
                {seasons
                  .filter((s) => !s.fazenda || s.fazenda === formData.fazenda)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome}
                    </option>
                  ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="opp-cultura" className="text-xs font-semibold">
                Cultura (Opcional)
              </Label>
              <select
                id="opp-cultura"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={formData.cultura}
                onChange={(e) => setFormData({ ...formData, cultura: e.target.value })}
              >
                <option value="">Nenhuma cultura</option>
                {crops.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.descricao}{c.id_pims ? ` · PIMS: ${c.id_pims}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="opp-plano" className="text-xs font-semibold">
                Plano de Cultivo (Opcional)
              </Label>
              <select
                id="opp-plano"
                disabled={!formData.fazenda}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                value={formData.plano_operacional}
                onChange={(e) => setFormData({ ...formData, plano_operacional: e.target.value })}
              >
                <option value="">Nenhum plano vinculado</option>
                {plans.map((pl) => (
                  <option key={pl.id} value={pl.id}>
                    {pl.cultura_nome} ({pl.safra_nome})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Descrição & Justificativa */}
          <div className="space-y-1">
            <Label htmlFor="opp-desc" className="text-xs font-semibold">
              Descrição Operacional
            </Label>
            <Textarea
              id="opp-desc"
              rows={2}
              className="text-xs"
              placeholder="Descreva as condições operacionais ou metas esperadas..."
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="opp-justificativa" className="text-xs font-semibold">
              Justificativa / Motivo
            </Label>
            <Textarea
              id="opp-justificativa"
              rows={2}
              className="text-xs"
              placeholder="Ex: Janela validada com base na tarifa horária e plano de rotação vigente."
              value={formData.justificativa}
              onChange={(e) => setFormData({ ...formData, justificativa: e.target.value })}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? "Salvando..." : isEditing ? "Salvar Alterações" : "Criar Oportunidade"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
