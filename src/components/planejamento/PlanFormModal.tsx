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
import {
  Calendar,
  Sprout,
  MapPin,
  AlertCircle,
  ShieldAlert,
  Info,
  Layers,
  CircleDot,
  CheckCircle2,
} from "lucide-react";

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
    data_plantio_real: "",
    data_colheita_real: "",
    area_planejada_ha: "",
    lamina_total_planejada_mm: "450.00",
    status: "RASCUNHO" as CropPlanStatus,
    permite_sobreposicao: false,
    justificativa_sobreposicao: "",
    observacoes: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);

  // Carrega catálogos de apoio
  useEffect(() => {
    if (isOpen) {
      Promise.all([
        api.getCrops().catch(() => []),
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
        data_plantio: planToEdit.data_plantio || "",
        data_colheita_prevista: planToEdit.data_colheita_prevista || "",
        data_plantio_real: planToEdit.data_plantio_real || "",
        data_colheita_real: planToEdit.data_colheita_real || "",
        area_planejada_ha: String(planToEdit.area_planejada_ha || ""),
        lamina_total_planejada_mm: String(planToEdit.lamina_total_planejada_mm || "450.00"),
        status: planToEdit.status,
        permite_sobreposicao: Boolean(planToEdit.permite_sobreposicao),
        justificativa_sobreposicao: planToEdit.justificativa_sobreposicao || "",
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
        data_plantio_real: "",
        data_colheita_real: "",
        area_planejada_ha: "",
        lamina_total_planejada_mm: "450.00",
        status: "RASCUNHO",
        permite_sobreposicao: false,
        justificativa_sobreposicao: "",
        observacoes: "",
      });
    }
    setError(null);
    setConflictWarning(null);
  }, [planToEdit, isOpen]);

  const handleFieldChange = (talhaoId: string) => {
    const selected = fields.find((f) => f.id === talhaoId);
    if (selected) {
      // Procura pivô associado a esse talhão (se houver)
      const associatedPivot = pivots.find((p: any) => p.talhao === talhaoId || p.talhao_id === talhaoId);
      setFormData((prev) => ({
        ...prev,
        talhao: talhaoId,
        fazenda: selected.fazenda || prev.fazenda,
        pivo: associatedPivot ? associatedPivot.id : "",
        area_planejada_ha: selected.area_ha ? String(selected.area_ha) : prev.area_planejada_ha,
      }));
    } else {
      setFormData((prev) => ({ ...prev, talhao: "", pivo: "" }));
    }
  };

  const filteredFields = formData.fazenda
    ? fields.filter((f) => f.fazenda === formData.fazenda)
    : fields;

  const filteredPivots = formData.fazenda
    ? pivots.filter((p) => p.fazenda === formData.fazenda)
    : pivots;

  const selectedSeason = seasons.find((s) => s.id === formData.safra);
  const selectedField = fields.find((f) => f.id === formData.talhao);
  const selectedPivot = pivots.find((p) => p.id === formData.pivo);

  // Alertas dinâmicos de validação visual
  const validationWarnings: string[] = [];
  if (formData.data_plantio && formData.data_colheita_prevista && formData.data_colheita_prevista < formData.data_plantio) {
    validationWarnings.push("A data prevista de colheita não pode ser anterior à data de plantio.");
  }
  if (formData.data_plantio_real && formData.data_colheita_real && formData.data_colheita_real < formData.data_plantio_real) {
    validationWarnings.push("A data real de colheita não pode ser anterior à data real de plantio.");
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
  if (selectedField && formData.area_planejada_ha && selectedField.area_ha && Number(formData.area_planejada_ha) > selectedField.area_ha) {
    validationWarnings.push(`Área excede a capacidade cadastrada do talhão (${selectedField.area_ha} ha).`);
  } else if (selectedPivot && !selectedField && formData.area_planejada_ha && selectedPivot.area_irrigada_ha && Number(formData.area_planejada_ha) > selectedPivot.area_irrigada_ha) {
    validationWarnings.push(`Área excede a área irrigada de projeto do pivô (${selectedPivot.area_irrigada_ha} ha).`);
  }

  const executeSave = async (andCreateAnother = false) => {
    if (!formData.safra || !formData.cultura || !formData.data_plantio || !formData.data_colheita_prevista) {
      setError("Preencha todos os campos obrigatórios marcados com asterisco (*).");
      return;
    }
    if (!formData.talhao) {
      setError("Selecione o Talhão de Cultivo como unidade de planejamento.");
      return;
    }
    if (!formData.area_planejada_ha || Number(formData.area_planejada_ha) <= 0) {
      setError("Informe uma área planejada em hectares válida maior que zero.");
      return;
    }

    if (formData.permite_sobreposicao && !formData.justificativa_sobreposicao.trim()) {
      setError("Para autorizar sobreposição de ciclo, é obrigatório preencher a justificativa auditável.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setConflictWarning(null);

    const payload: Partial<CropPlan> = {
      safra: formData.safra,
      cultura: formData.cultura,
      fazenda: formData.fazenda || null,
      talhao: formData.talhao || null,
      pivo: formData.pivo || null,
      data_plantio: formData.data_plantio,
      data_colheita_prevista: formData.data_colheita_prevista,
      data_plantio_real: formData.data_plantio_real || null,
      data_colheita_real: formData.data_colheita_real || null,
      area_planejada_ha: Number(formData.area_planejada_ha),
      lamina_total_planejada_mm: Number(formData.lamina_total_planejada_mm || "0"),
      status: formData.status,
      permite_sobreposicao: formData.permite_sobreposicao,
      justificativa_sobreposicao: formData.justificativa_sobreposicao,
      observacoes: formData.observacoes,
    };

    try {
      if (isEditing && planToEdit) {
        await api.updatePlan(planToEdit.id, payload);
      } else {
        await api.createPlan(payload);
      }

      onSuccess();

      if (andCreateAnother) {
        // Limpa datas e cultura, mantendo safra e fazenda
        setFormData((prev) => ({
          ...prev,
          cultura: "",
          data_plantio: "",
          data_colheita_prevista: "",
          data_plantio_real: "",
          data_colheita_real: "",
          area_planejada_ha: "",
          permite_sobreposicao: false,
          justificativa_sobreposicao: "",
          observacoes: "",
        }));
        setError(null);
        setConflictWarning(null);
      } else {
        onClose();
      }
    } catch (err: any) {
      // Se for erro de sobreposição retornado pelo backend
      const responseData = err.data || {};
      if (responseData.conflito_sobreposicao) {
        setConflictWarning(responseData.conflito_sobreposicao);
      } else {
        setError(err.message || "Erro ao salvar plano de planejamento.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeSave(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b border-border pb-3">
          <DialogTitle className="flex items-center gap-2 text-foreground text-lg">
            <Sprout className="size-5 text-primary" />
            {isEditing ? "Editar Planejamento de Plantio" : "Novo Planejamento de Plantio"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {isEditing
              ? "Atualize o cronograma, datas previstas e reais, área e status deste planejamento."
              : "Defina a cultura, safra, unidade de plantio (pivô ou talhão) e os marcos cronológicos."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 py-2">
          {/* Alerta de erro geral */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Alerta de conflito de sobreposição com autorização auditável */}
          {conflictWarning && (
            <div className="rounded-xl border border-amber-400 bg-amber-50 dark:bg-amber-950/30 p-4 space-y-3">
              <div className="flex items-start gap-2 text-xs text-amber-900 dark:text-amber-200">
                <ShieldAlert className="size-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm text-amber-900 dark:text-amber-100">
                    Conflito de Sobreposição Detectado
                  </h4>
                  <p className="mt-1 leading-relaxed">{conflictWarning}</p>
                </div>
              </div>

              <div className="border-t border-amber-200 dark:border-amber-900/40 pt-2 space-y-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-amber-950 dark:text-amber-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.permite_sobreposicao}
                    onChange={(e) => setFormData({ ...formData, permite_sobreposicao: e.target.checked })}
                    className="rounded border-amber-400 text-primary focus:ring-primary size-4"
                  />
                  <span>Autorizar sobreposição de planejamento com justificativa técnica</span>
                </label>

                {formData.permite_sobreposicao && (
                  <div className="space-y-1">
                    <Label htmlFor="justificativa_sobreposicao" className="text-xs font-medium text-amber-900 dark:text-amber-300">
                      Justificativa Auditável para Conflito *
                    </Label>
                    <Input
                      id="justificativa_sobreposicao"
                      placeholder="Ex: Autorizado pelo agrônomo responsável para transição escalonada."
                      value={formData.justificativa_sobreposicao}
                      onChange={(e) => setFormData({ ...formData, justificativa_sobreposicao: e.target.value })}
                      className="text-xs h-8 bg-white dark:bg-card"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Avisos de Validação Local */}
          {validationWarnings.length > 0 && (
            <div className="space-y-1 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
              <div className="flex items-center gap-1.5 font-semibold">
                <AlertCircle className="size-4" />
                Avisos Agronômicos:
              </div>
              <ul className="list-disc pl-5 space-y-0.5">
                {validationWarnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* SEÇÃO 1: IDENTIFICAÇÃO */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-1 border-b border-border">
              <Layers className="size-4 text-primary" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                1. Identificação da Unidade e Cultura
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Safra */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="safra" className="text-xs font-semibold">
                    Safra / Ciclo Agrícola *
                  </Label>
                  <a
                    href="/safras"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-primary hover:underline font-semibold"
                    title="Cadastrar nova safra em outra aba"
                  >
                    + Nova Safra
                  </a>
                </div>
                <select
                  id="safra"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={formData.safra}
                  onChange={(e) => setFormData({ ...formData, safra: e.target.value })}
                  required
                >
                  <option value="">Selecione a safra...</option>
                  {seasons.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome} ({s.data_inicio} a {s.data_fim})
                    </option>
                  ))}
                </select>
                {seasons.length === 0 && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400">
                    Nenhuma safra cadastrada. Clique em "+ Nova Safra" para cadastrar.
                  </p>
                )}
              </div>

              {/* Cultura */}
              <div className="space-y-1">
                <Label htmlFor="cultura" className="text-xs font-semibold">
                  Cultura Agrícola *
                </Label>
                <select
                  id="cultura"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={formData.cultura}
                  onChange={(e) => setFormData({ ...formData, cultura: e.target.value })}
                  required
                >
                  <option value="">Selecione a cultura...</option>
                  {crops.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.descricao}{c.id_pims ? ` · PIMS: ${c.id_pims}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Fazenda */}
              <div className="space-y-1">
                <Label htmlFor="fazenda" className="text-xs font-semibold">
                  Fazenda / Filial *
                </Label>
                <select
                  id="fazenda"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={formData.fazenda}
                  onChange={(e) => setFormData({ ...formData, fazenda: e.target.value, talhao: "", pivo: "" })}
                  required
                >
                  <option value="">Selecione uma fazenda...</option>
                  {farms.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nome} ({f.filial || f.codigo})
                    </option>
                  ))}
                </select>
              </div>

              {/* Talhão de Cultivo */}
              <div className="space-y-1">
                <Label htmlFor="talhao" className="text-xs font-semibold">
                  Talhão de Cultivo *
                </Label>
                <select
                  id="talhao"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={formData.talhao}
                  onChange={(e) => handleFieldChange(e.target.value)}
                  required
                >
                  <option value="">Selecione o talhão...</option>
                  {filteredFields.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.codigo} - {t.nome || t.descricao} {t.area_ha ? `(${t.area_ha} ha)` : ""}
                    </option>
                  ))}
                </select>
                {filteredFields.length === 0 && formData.fazenda && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400">
                    Nenhum talhão cadastrado nesta fazenda. Acesse a aba Talhões para cadastrar.
                  </p>
                )}
              </div>

              {/* Área planejada */}
              <div className="space-y-1">
                <Label htmlFor="area_planejada_ha" className="text-xs font-semibold">
                  Área Planejada (ha) *
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
            </div>
          </div>

          {/* SEÇÃO 2: DATAS */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-1 border-b border-border">
              <Calendar className="size-4 text-primary" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                2. Cronograma de Plantio e Colheita
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Data Prevista de Plantio */}
              <div className="space-y-1">
                <Label htmlFor="data_plantio" className="text-xs font-semibold">
                  Previsão de Plantio *
                </Label>
                <Input
                  id="data_plantio"
                  type="date"
                  value={formData.data_plantio}
                  onChange={(e) => setFormData({ ...formData, data_plantio: e.target.value })}
                  className="text-xs h-9"
                  required
                />
              </div>

              {/* Data Real de Plantio */}
              <div className="space-y-1">
                <Label htmlFor="data_plantio_real" className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                  <span>Plantio Realizado</span>
                  <span className="text-[10px] font-normal">Opcional</span>
                </Label>
                <Input
                  id="data_plantio_real"
                  type="date"
                  value={formData.data_plantio_real}
                  onChange={(e) => setFormData({ ...formData, data_plantio_real: e.target.value })}
                  className="text-xs h-9"
                />
              </div>

              {/* Data Prevista de Colheita */}
              <div className="space-y-1">
                <Label htmlFor="data_colheita_prevista" className="text-xs font-semibold">
                  Previsão de Colheita *
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

              {/* Data Real de Colheita */}
              <div className="space-y-1">
                <Label htmlFor="data_colheita_real" className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                  <span>Colheita Realizada</span>
                  <span className="text-[10px] font-normal">Opcional</span>
                </Label>
                <Input
                  id="data_colheita_real"
                  type="date"
                  value={formData.data_colheita_real}
                  onChange={(e) => setFormData({ ...formData, data_colheita_real: e.target.value })}
                  className="text-xs h-9"
                />
              </div>
            </div>
          </div>

          {/* SEÇÃO 3: INFORMAÇÕES COMPLEMENTARES */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-1 border-b border-border">
              <CircleDot className="size-4 text-primary" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                3. Informações Complementares
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Situação */}
              <div className="space-y-1">
                <Label htmlFor="status" className="text-xs font-semibold">
                  Status do Planejamento
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

              {/* Meta Hídrica */}
              <div className="space-y-1">
                <Label htmlFor="lamina_total_planejada_mm" className="text-xs font-semibold">
                  Meta Hídrica Planejada (mm)
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
            </div>

            {/* Observações */}
            <div className="space-y-1 pt-1">
              <Label htmlFor="observacoes" className="text-xs font-semibold">
                Observações Operacionais
              </Label>
              <Textarea
                id="observacoes"
                placeholder="Observações agronômicas, variedade de semente, manejo de solo..."
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                rows={2}
                className="resize-none text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2 pt-3 border-t border-border">
            <Button variant="outline" size="sm" type="button" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            {!isEditing && (
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={() => executeSave(true)}
                disabled={isSubmitting}
                className="text-xs"
              >
                Salvar e cadastrar outro
              </Button>
            )}
            <Button variant="default" size="sm" type="submit" disabled={isSubmitting} className="text-xs">
              {isSubmitting ? "Gravando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
