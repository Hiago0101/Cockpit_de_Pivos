import React, { useState, useEffect } from "react";
import {
  api,
  type Crop,
} from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sprout,
  Plus,
  Search,
  RefreshCw,
  Edit,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";

export function CropCatalogView() {
  const [crops, setCrops] = useState<Crop[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterAtivo, setFilterAtivo] = useState<string>("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [cropToEdit, setCropToEdit] = useState<Crop | null>(null);
  const [formData, setFormData] = useState({
    nome: "",
    codigo: "",
    variedade: "",
    descricao: "",
    dias_ciclo_estimado: 120,
    coeficiente_kc_padrao: "1.15",
    ativo: true,
    observacoes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCrops = async () => {
    setLoading(true);
    try {
      const data = await api.getCrops({
        search: search || undefined,
        ativo: filterAtivo === "all" ? undefined : filterAtivo === "true",
      });
      setCrops(data);
    } catch {
      setCrops([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCrops();
  }, [search, filterAtivo]);

  const handleOpenCreate = () => {
    setCropToEdit(null);
    setFormData({
      nome: "",
      codigo: "",
      variedade: "",
      descricao: "",
      dias_ciclo_estimado: 120,
      coeficiente_kc_padrao: "1.15",
      ativo: true,
      observacoes: "",
    });
    setError(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (crop: Crop) => {
    setCropToEdit(crop);
    setFormData({
      nome: crop.nome,
      codigo: crop.codigo || "",
      variedade: crop.variedade || "",
      descricao: crop.descricao || "",
      dias_ciclo_estimado: crop.dias_ciclo_estimado || 120,
      coeficiente_kc_padrao: String(crop.coeficiente_kc_padrao || "1.15"),
      ativo: crop.ativo,
      observacoes: crop.observacoes || "",
    });
    setError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome.trim()) {
      setError("O nome da cultura é obrigatório.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const payload: Partial<Crop> = {
      nome: formData.nome.trim(),
      codigo: formData.codigo.trim().toUpperCase(),
      variedade: formData.variedade.trim(),
      descricao: formData.descricao.trim(),
      dias_ciclo_estimado: Number(formData.dias_ciclo_estimado),
      coeficiente_kc_padrao: Number(formData.coeficiente_kc_padrao),
      ativo: formData.ativo,
      observacoes: formData.observacoes.trim(),
    };

    try {
      if (cropToEdit) {
        await api.updateCrop(cropToEdit.id, payload);
      } else {
        await api.createCrop(payload);
      }
      setModalOpen(false);
      loadCrops();
    } catch (err: any) {
      setError(err.message || "Erro ao salvar cultura.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header com Busca e Ação */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
            <Sprout className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">
              Catálogo de Culturas Agrícolas
            </h3>
            <p className="text-xs text-muted-foreground">
              Cadastro e parâmetros agronômicos de cultivares, ciclo e coeficiente Kc
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar cultura, código ou variedade..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 text-xs w-[220px]"
            />
          </div>

          <select
            className="h-8 rounded-md border border-input bg-background px-2.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={filterAtivo}
            onChange={(e) => setFilterAtivo(e.target.value)}
          >
            <option value="all">Todas</option>
            <option value="true">Apenas Ativas</option>
            <option value="false">Inativas</option>
          </select>

          <Button size="sm" onClick={handleOpenCreate} className="h-8 gap-1.5 text-xs">
            <Plus className="size-3.5" />
            Nova Cultura
          </Button>
        </div>
      </div>

      {/* Grid de Cards de Culturas */}
      {loading ? (
        <div className="py-16 text-center text-xs text-muted-foreground">
          Carregando catálogo de culturas...
        </div>
      ) : crops.length === 0 ? (
        <div className="rounded-xl border border-border bg-card py-16 text-center text-xs text-muted-foreground space-y-2">
          <p className="font-semibold text-foreground">Nenhuma cultura agrícola encontrada.</p>
          <Button size="sm" variant="outline" onClick={handleOpenCreate} className="gap-1.5 text-xs">
            <Plus className="size-3.5" />
            Cadastrar Primeira Cultura
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {crops.map((c) => (
            <div
              key={c.id}
              className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3 hover:border-primary/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    {c.nome}
                    {c.codigo && (
                      <Badge variant="secondary" className="text-[10px] uppercase font-mono px-1.5 py-0">
                        {c.codigo}
                      </Badge>
                    )}
                  </h4>
                  {c.variedade && (
                    <p className="text-xs text-muted-foreground">Variedade: {c.variedade}</p>
                  )}
                </div>

                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 ${
                    c.ativo
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : "border-slate-500/30 bg-slate-500/10 text-slate-500"
                  }`}
                >
                  {c.ativo ? "Ativa" : "Inativa"}
                </Badge>
              </div>

              {c.descricao && (
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                  {c.descricao}
                </p>
              )}

              <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/40 p-2 text-xs">
                <div>
                  <span className="text-[10px] text-muted-foreground block">Ciclo Estimado:</span>
                  <span className="font-semibold text-foreground">{c.dias_ciclo_estimado} dias</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">Kc Padrão:</span>
                  <span className="font-semibold text-foreground">{c.coeficiente_kc_padrao}</span>
                </div>
              </div>

              <div className="flex items-center justify-end pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleOpenEdit(c)}
                  className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                >
                  <Edit className="size-3" />
                  Editar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Criação / Edição de Cultura */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground text-base">
              <Sprout className="size-4 text-primary" />
              {cropToEdit ? "Editar Cultura Agrícola" : "Cadastrar Nova Cultura"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Informe os dados agronômicos básicos para planejamento temporal e irrigação.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-3.5 py-2">
            {error && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive">
                <AlertCircle className="size-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="crop-nome" className="text-xs font-semibold">
                  Nome da Cultura *
                </Label>
                <Input
                  id="crop-nome"
                  placeholder="Ex: Soja, Milho, Feijão"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  className="h-8 text-xs"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="crop-codigo" className="text-xs font-semibold">
                  Código Interno
                </Label>
                <Input
                  id="crop-codigo"
                  placeholder="Ex: SOJ-01, MIL-02"
                  value={formData.codigo}
                  onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                  className="h-8 text-xs uppercase"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="crop-variedade" className="text-xs font-semibold">
                Variedade / Cultivar
              </Label>
              <Input
                id="crop-variedade"
                placeholder="Ex: TMG 7062 IPRO, P3707 VYHR"
                value={formData.variedade}
                onChange={(e) => setFormData({ ...formData, variedade: e.target.value })}
                className="h-8 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="crop-ciclo" className="text-xs font-semibold">
                  Ciclo Médio (Dias)
                </Label>
                <Input
                  id="crop-ciclo"
                  type="number"
                  min="1"
                  value={formData.dias_ciclo_estimado}
                  onChange={(e) => setFormData({ ...formData, dias_ciclo_estimado: Number(e.target.value) })}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="crop-kc" className="text-xs font-semibold">
                  Kc Padrão (Evapotranspiração)
                </Label>
                <Input
                  id="crop-kc"
                  type="number"
                  step="0.01"
                  min="0.1"
                  value={formData.coeficiente_kc_padrao}
                  onChange={(e) => setFormData({ ...formData, coeficiente_kc_padrao: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="crop-desc" className="text-xs font-semibold">
                Descrição
              </Label>
              <Textarea
                id="crop-desc"
                placeholder="Características fenológicas e exigências hídricas..."
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                rows={2}
                className="text-xs resize-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                id="crop-ativo"
                type="checkbox"
                checked={formData.ativo}
                onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                className="size-3.5 rounded border-input"
              />
              <Label htmlFor="crop-ativo" className="text-xs font-medium cursor-pointer">
                Cultura ativa para novos planejamentos
              </Label>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button variant="outline" size="sm" type="button" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button size="sm" type="submit" disabled={submitting}>
                {submitting ? "Gravando..." : "Salvar Cultura"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
