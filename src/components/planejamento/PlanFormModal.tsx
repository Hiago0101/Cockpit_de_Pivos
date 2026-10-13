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
  type CropPlan,
  type Crop,
  type Season,
  type Farm,
  type Field,
  type Pivot,
  type CropPlanStatus,
} from "@/services/api";
import { Calendar, Sprout, MapPin, AlertCircle, Info, Sparkles } from "lucide-react";

interface PlanFormModalProps {
  planToEdit?: CropPlan | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function PlanFormModal({
  planToEdit,
  isOpen,
  onClose,
  onSuccess,
}: PlanFormModalProps) {
  const isEditing = Boolean(planToEdit);

  const [crops, setCrops] = useState<Crop[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [pivots, setPivots] = useState<Pivot[]>([]);

  const [formData, setFormData] = useState({
    safra: "",
    cultura: "",
    fazenda: "",
    talhao: "",
    pivo: "",
    data_plantio: "",
    data_colheita_prevista: "",
    area_planejada_ha: "",
    lamina_total_planejada_mm: "450.00",
    status: "RASCUNHO" as CropPlanStatus,
    observacoes: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Carrega catálogos de apoio
  useEffect(() => {
    if (isOpen) {
      Promise.all([
        api.getCrops({ ativo: true }).catch(() => []),
        api.getSeasons({ ativa: true }).catch(() => []),
        api.getFarms().catch(() => []),
        api.getFields().catch(() => []),
        api.getPivots().catch(() => []),
      ]).then(([cData, sData, fData, tData, pData]) => {
        setCrops(cData);
        setSeasons(sData);
        setFarms(fData);
        setFields(tData);
        setPivots(pData);
      });
    }
  }, [isOpen]);

  // Inicializa dados para criação ou edição
  useEffect(() => {
    if (planToEdit) {
      setFormData({
        safra: planToEdit.safra,
        cultura: planToEdit.cultura,
        fazenda: planToEdit.fazenda || "",
        talhao: planToEdit.talhao || "",
        pivo: planToEdit.pivo || "",
        data_plantio: planToEdit.data_plantio,
        data_colheita_prevista: planToEdit.data_colheita_prevista,
        area_planejada_ha: String(planToEdit.area_planejada_ha),
        lamina_total_planejada_mm: String(planToEdit.lamina_total_planejada_mm || "450.00"),
        status: planToEdit.status,
        observacoes: planToEdit.observacoes || "",
      });
    } else {
      setFormData({
        safra: "",
        cultura: "",
        fazenda: "",
        talhao: "",
        pivo: "",
        data_plantio: "",
        data_colheita_prevista: "",
        area_planejada_ha: "",
        lamina_total_planejada_mm: "450.00",
        status: "RASCUNHO",
        observacoes: "",
      });
    }
    setError(null);
  }, [planToEdit, isOpen]);

  // Seletor de pivô / talhão ajusta fazenda e área automaticamente
  const handlePivotChange = (pivoId: string) => {
    const selected = pivots.find((p) => p.id === pivoId);
    if (selected) {
      setFormData((prev) => ({
        ...prev,
        pivo: pivoId,
        fazenda: selected.fazenda,
        talhao: prev.talhao || "",
        area_planejada_ha: prev.area_planejada_ha || String(selected.area_irrigada_ha),
      }));
    } else {
      setFormData((prev) => ({ ...prev, pivo: "" }));
    }
  };

  const handleFieldChange = (talhaoId: string) => {
    const selected = fields.find((f) => f.id === talhaoId);
    if (selected) {
      setFormData((prev) => ({
        ...prev,
        talhao: talhaoId,
        fazenda: selected.fazenda,
        area_planejada_ha: prev.area_planejada_ha || String(selected.area_ha),
      }));
    } else {
      setFormData((prev) => ({ ...prev, talhao: "" }));
    }
  };

  const handleCropChange = (cropId: string) => {
    const crop = crops.find((c) => c.id === cropId);
    setFormData((prev) => {
      const next = { ...prev, cultura: cropId };
      // Se plantio já preenchido, calcula automaticamente colheita prevista pelo ciclo estimado
      if (crop && prev.data_plantio && !prev.data_colheita_prevista) {
        try {
          const d = new Date(prev.data_plantio);
          const parts = d.toISOString().split("T");
          if (parts[0]) {
            next.data_colheita_prevista = parts[0];
          }
        } catch {
          // ignora
        }
      }
      return next;
    });
  };

  const filteredFields = formData.fazenda
    ? fields.filter((f) => f.fazenda === formData.fazenda)
    : fields;

  const filteredPivots = formData.fazenda
    ? pivots.filter((p) => p.fazenda === formData.fazenda)
    : pivots;

  const selectedSeason = seasons.find((s) => s.id === formData.safra);
  const selectedCrop = crops.find((c) => c.id === formData.cultura);
  const selectedField = fields.find((f) => f.id === formData.talhao);
  const selectedPivot = pivots.find((p) => p.id === formData.pivo);

  // Alertas dinâmicos de validação visual
  const validationWarnings: string[] = [];
  if (formData.data_plantio && formData.data_colheita_prevista && formData.data_colheita_prevista < formData.data_plantio) {
    validationWarnings.push("A data de colheita não pode ser anterior à data de plantio.");
  }
  if (selectedSeason && formData.data_plantio && selectedSeason.data_inicio && formData.data_plantio < selectedSeason.data_inicio) {
    validationWarnings.push(`Plantio (${formData.data_plantio}) anterior ao início da safra (${selectedSeason.data_inicio}).`);
  }
  if (selectedSeason && formData.data_colheita_prevista && selectedSeason.data_fim && formData.data_colheita_prevista > selectedSeason.data_fim) {
    validationWarnings.push(`Colheita (${formData.data_colheita_prevista}) posterior ao término da safra (${selectedSeason.data_fim}).`);
  }
  if (formData.area_planejada_ha && Number(formData.area_planejada_ha) <= 0) {
    validationWarnings.push("A área planejada deve ser maior que 0 ha.");
  }
  if (selectedField && formData.area_planejada_ha && Number(formData.area_planejada_ha) > selectedField.area_ha) {
    validationWarnings.push(`Área excede a capacidade do talhão selecionado (${selectedField.area_ha} ha).`);
  } else if (selectedPivot && !selectedField && formData.area_planejada_ha && Number(formData.area_planejada_ha) > selectedPivot.area_irrigada_ha) {
    validationWarnings.push(`Área excede a área irrigada de projeto do pivô (${selectedPivot.area_irrigada_ha} ha).`);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.safra || !formData.cultura || !formData.data_plantio || !formData.data_colheita_prevista) {
      setError("Preencha todos os campos obrigatórios marcados com asterisco (*).");
      return;
    }
    if (!formData.area_planejada_ha || Number(formData.area_planejada_ha) <= 0) {
      setError("Informe uma área planejada em hectares válida maior que zero.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const payload: Partial<CropPlan> = {
      safra: formData.safra,
      cultura: formData.cultura,
      fazenda: formData.fazenda || null,
      talhao: formData.talhao || null,
      pivo: formData.pivo || null,
      data_plantio: formData.data_plantio,
      data_colheita_prevista: formData.data_colheita_prevista,
      area_planejada_ha: Number(formData.area_planejada_ha),
      lamina_total_planejada_mm: Number(formData.lamina_total_planejada_mm || "0"),
      status: formData.status,
      observacoes: formData.observacoes,
    };

    try {
      if (isEditing && planToEdit) {
        await api.updatePlan(planToEdit.id, payload);
      } else {
        await api.createPlan(payload);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Erro ao salvar plano de cultivo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground text-lg">
            <Sprout className="size-5 text-primary" />
            {isEditing ? "Editar Planejamento Agrícola" : "Novo Planejamento de Cultivo"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Atualize as informações do plano de safra, datas e metas de área."
              : "Defina a safra, cultura, área produtiva e o cronograma previsto de plantio e colheita."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {validationWarnings.length > 0 && (
            <div className="space-y-1 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
              <div className="flex items-center gap-1.5 font-semibold">
                <AlertCircle className="size-4" />
                Avisos de Validação:
              </div>
              <ul className="list-disc pl-5 space-y-0.5">
                {validationWarnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Safra */}
            <div className="space-y-1.5">
              <Label htmlFor="safra" className="text-xs font-semibold">
                Safra / Ciclo Agrícola *
              </Label>
              <select
                id="safra"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={formData.safra}
                onChange={(e) => setFormData({ ...formData, safra: e.target.value })}
                required
              >
                <option value="">Selecione uma safra...</option>
                {seasons.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome} ({s.data_inicio} a {s.data_fim})
                  </option>
                ))}
              </select>
            </div>

            {/* Cultura */}
            <div className="space-y-1.5">
              <Label htmlFor="cultura" className="text-xs font-semibold">
                Cultura Agrícola *
              </Label>
              <select
                id="cultura"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={formData.cultura}
                onChange={(e) => handleCropChange(e.target.value)}
                required
              >
                <option value="">Selecione a cultura...</option>
                {crops.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome} {c.variedade ? `(${c.variedade})` : ""} · {c.dias_ciclo_estimado}d
                  </option>
                ))}
              </select>
            </div>

            {/* Fazenda */}
            <div className="space-y-1.5">
              <Label htmlFor="fazenda" className="text-xs font-semibold">
                Fazenda / Unidade
              </Label>
              <select
                id="fazenda"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={formData.fazenda}
                onChange={(e) => setFormData({ ...formData, fazenda: e.target.value, talhao: "", pivo: "" })}
              >
                <option value="">Selecione uma fazenda...</option>
                {farms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome} ({f.codigo}) - {f.municipio}/{f.uf}
                  </option>
                ))}
              </select>
            </div>

            {/* Talhão */}
            <div className="space-y-1.5">
              <Label htmlFor="talhao" className="text-xs font-semibold">
                Talhão / Área Produtiva
              </Label>
              <select
                id="talhao"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={formData.talhao}
                onChange={(e) => handleFieldChange(e.target.value)}
              >
                <option value="">Nenhum talhão específico selecionado</option>
                {filteredFields.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.codigo} - {t.nome} ({t.area_ha} ha)
                  </option>
                ))}
              </select>
            </div>

            {/* Pivô */}
            <div className="space-y-1.5">
              <Label htmlFor="pivo" className="text-xs font-semibold">
                Pivô Central Associado (Quando aplicável)
              </Label>
              <select
                id="pivo"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={formData.pivo}
                onChange={(e) => handlePivotChange(e.target.value)}
              >
                <option value="">Nenhum pivô associado (Área de Sequeiro / Manejo Geral)</option>
                {filteredPivots.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.codigo} - {p.nome} ({p.area_irrigada_ha} ha)
                  </option>
                ))}
              </select>
            </div>

            {/* Área planejada em hectares */}
            <div className="space-y-1.5">
              <Label htmlFor="area_planejada_ha" className="text-xs font-semibold">
                Área Planejada (Hectares) *
              </Label>
              <Input
                id="area_planejada_ha"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="Ex: 85.50"
                value={formData.area_planejada_ha}
                onChange={(e) => setFormData({ ...formData, area_planejada_ha: e.target.value })}
                className="text-xs h-9"
                required
              />
            </div>

            {/* Data de Plantio */}
            <div className="space-y-1.5">
              <Label htmlFor="data_plantio" className="text-xs font-semibold">
                Data Planejada de Plantio *
              </Label>
              <Input
                id="data_plantio"
                type="date"
                value={formData.data_plantio}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormData((prev) => {
                    const next = { ...prev, data_plantio: val };
                    if (selectedCrop && val && !prev.data_colheita_prevista) {
                      const d = new Date(val);
                      const parts = d.toISOString().split("T");
                      if (parts[0]) {
                        next.data_colheita_prevista = parts[0];
                      }
                    }
                    return next;
                  });
                }}
                className="text-xs h-9"
                required
              />
            </div>

            {/* Data de Colheita Prevista */}
            <div className="space-y-1.5">
              <Label htmlFor="data_colheita_prevista" className="text-xs font-semibold">
                Data Prevista de Colheita *
              </Label>
              <Input
                id="data_colheita_prevista"
                type="date"
                value={formData.data_colheita_prevista}
                onChange={(e) => setFormData({ ...formData, data_colheita_prevista: e.target.value })}
                className="text-xs h-9"
                required
              />
            </div>

            {/* Lâmina Total Planejada */}
            <div className="space-y-1.5">
              <Label htmlFor="lamina_total_planejada_mm" className="text-xs font-semibold">
                Meta de Lâmina Total (mm)
              </Label>
              <Input
                id="lamina_total_planejada_mm"
                type="number"
                step="1"
                placeholder="Ex: 450"
                value={formData.lamina_total_planejada_mm}
                onChange={(e) => setFormData({ ...formData, lamina_total_planejada_mm: e.target.value })}
                className="text-xs h-9"
              />
            </div>

            {/* Situação inicial */}
            <div className="space-y-1.5">
              <Label htmlFor="status" className="text-xs font-semibold">
                Situação do Planejamento
              </Label>
              <select
                id="status"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as CropPlanStatus })}
              >
                <option value="RASCUNHO">Rascunho</option>
                <option value="PLANEJADO">Planejado</option>
                <option value="EM_ANDAMENTO">Em Andamento</option>
                <option value="CONCLUIDO">Concluído</option>
                <option value="CANCELADO">Cancelado</option>
              </select>
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-1.5 pt-1">
            <Label htmlFor="observacoes" className="text-xs font-semibold">
              Observações e Instruções Agronômicas
            </Label>
            <Textarea
              id="observacoes"
              placeholder="Instruções de manejo de solo, cultivares específicas ou metas de irrigação..."
              value={formData.observacoes}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              rows={3}
              className="resize-none text-xs"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button variant="outline" size="sm" type="button" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button variant="default" size="sm" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Gravando..." : isEditing ? "Salvar Alterações" : "Criar Plano de Cultivo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
