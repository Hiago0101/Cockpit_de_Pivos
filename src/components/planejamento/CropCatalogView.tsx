import { useState, useEffect } from "react";
import { api, type Crop, type Farm } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sprout,
  Plus,
  Search,
  RefreshCw,
  Edit,
  AlertCircle,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";

export function CropCatalogView() {
  const [crops, setCrops] = useState<Crop[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedFarmFilter, setSelectedFarmFilter] = useState<string>("ALL");

  const [modalOpen, setModalOpen] = useState(false);
  const [cropToEdit, setCropToEdit] = useState<Crop | null>(null);
  const [formData, setFormData] = useState({
    fazenda: "",
    descricao: "",
    id_pims: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [cropsData, farmsData] = await Promise.all([
        api.getCrops(),
        api.getFarms(),
      ]);
      setCrops(cropsData);
      setFarms(farmsData);
    } catch {
      setCrops([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCreate = () => {
    setCropToEdit(null);
    setFormData({
      fazenda: selectedFarmFilter !== "ALL" ? selectedFarmFilter : "",
      descricao: "",
      id_pims: "",
    });
    setError(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (crop: Crop) => {
    setCropToEdit(crop);
    setFormData({
      fazenda: crop.fazenda || "",
      descricao: crop.descricao || "",
      id_pims: crop.id_pims || "",
    });
    setError(null);
    setModalOpen(true);
  };

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    toast.info("ID copiado");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanDescricao = formData.descricao.trim().toUpperCase();
    if (!cleanDescricao) {
      setError("A descrição completa da cultura é obrigatória.");
      return;
    }

    const cleanFazendaId = formData.fazenda.trim();
    const cleanIdPims = formData.id_pims.trim();

    if (!cleanFazendaId) {
      setError("Selecione a fazenda / filial vinculada à cultura.");
      return;
    }

    // Validação de duplicidade de descrição na listagem local
    const duplicadaDesc = crops.find(
      (c) =>
        c.descricao?.trim().toUpperCase() === cleanDescricao &&
        (!cleanFazendaId || !c.fazenda || c.fazenda === cleanFazendaId) &&
        (!cropToEdit || c.id !== cropToEdit.id)
    );
    if (duplicadaDesc) {
      setError(`Já existe uma cultura cadastrada com a descrição "${cleanDescricao}" nesta fazenda/filial.`);
      return;
    }

    // Validação de duplicidade do ID PIMS na listagem local
    if (cleanIdPims) {
      const duplicadaPims = crops.find(
        (c) =>
          c.id_pims?.trim().toUpperCase() === cleanIdPims.toUpperCase() &&
          (!cropToEdit || c.id !== cropToEdit.id)
      );
      if (duplicadaPims) {
        setError(
          `Já existe uma cultura cadastrada com o ID PIMS "${cleanIdPims}" (${duplicadaPims.descricao}).`
        );
        return;
      }
    }

    setSubmitting(true);
    setError(null);

    const payload: Partial<Crop> = {
      descricao: cleanDescricao,
      fazenda: cleanFazendaId || null,
      id_pims: cleanIdPims || "",
    };

    try {
      if (cropToEdit) {
        await api.updateCrop(cropToEdit.id, payload);
        toast.success(`Cultura "${cleanDescricao}" atualizada com sucesso!`);
      } else {
        await api.createCrop(payload);
        toast.success(`Cultura "${cleanDescricao}" cadastrada com sucesso!`);
      }
      setModalOpen(false);
      loadData();
    } catch (err: any) {
      setError(err?.message || "Erro ao salvar cultura.");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredCrops = crops.filter((crop) => {
    if (selectedFarmFilter !== "ALL" && crop.fazenda !== selectedFarmFilter) {
      return false;
    }
    const term = search.toLowerCase();
    const matchesDescricao = (crop.descricao || "").toLowerCase().includes(term);
    const matchesId = (crop.id || "").toLowerCase().includes(term);
    const matchesPims = (crop.id_pims || "").toLowerCase().includes(term);
    const matchesFazendaNome = (crop.fazenda_nome || "").toLowerCase().includes(term);
    const matchesFazendaFilial = (crop.fazenda_filial || "").toLowerCase().includes(term);

    return (
      matchesDescricao ||
      matchesId ||
      matchesPims ||
      matchesFazendaNome ||
      matchesFazendaFilial
    );
  });

  return (
    <div className="space-y-4">
      {/* Header com Busca e Filtros fora do card */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-1 flex-col sm:flex-row items-center gap-2.5 max-w-2xl">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por descrição, fazenda ou ID PIMS..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pl-8 text-xs bg-background"
            />
          </div>

          {farms.length > 0 && (
            <div className="relative w-full sm:w-60 shrink-0">
              <select
                aria-label="Filtrar por Fazenda / Filial"
                className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
                value={selectedFarmFilter}
                onChange={(e) => setSelectedFarmFilter(e.target.value)}
              >
                <option value="ALL">Todas as Fazendas ({farms.length})</option>
                {farms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome} {f.filial ? `(Filial ${f.filial})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="h-9 text-xs gap-1.5"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>

          <Button
            size="sm"
            onClick={handleOpenCreate}
            className="h-9 text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="size-3.5" />
            Nova Cultura
          </Button>
        </div>
      </div>

      {/* Lista de Culturas */}
      {loading && crops.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
          <RefreshCw className="size-4 animate-spin mr-2" />
          Carregando catálogo de culturas...
        </div>
      ) : filteredCrops.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center">
          <Sprout className="size-10 text-muted-foreground mx-auto mb-2 opacity-50" />
          <p className="text-sm font-semibold text-foreground">Nenhuma cultura encontrada</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Cadastre novas culturas ou ajuste os filtros de pesquisa.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredCrops.map((c) => (
            <div
              key={c.id}
              className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3 hover:border-primary/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5 uppercase">
                    {c.descricao}
                  </h4>
                  <div className="flex items-center gap-1.5 flex-wrap mt-1">
                    {c.fazenda_nome && (
                      <span className="text-xs text-muted-foreground">
                        {c.fazenda_nome} {c.fazenda_filial ? `(Filial ${c.fazenda_filial})` : ""}
                      </span>
                    )}
                    {c.id_pims && (
                      <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 bg-primary/5 text-primary border-primary/20">
                        PIMS: {c.id_pims}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border/50 text-[11px] text-muted-foreground">
                <button
                  type="button"
                  onClick={() => handleCopyId(c.id)}
                  className="flex items-center gap-1 hover:text-foreground font-mono truncate max-w-[160px] cursor-pointer"
                  title="Copiar ID do Sistema"
                >
                  {copiedId === c.id ? (
                    <Check className="size-3 text-emerald-500" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                  <span className="truncate">{c.id}</span>
                </button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleOpenEdit(c)}
                  className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground cursor-pointer"
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
              {cropToEdit ? "Editar Cultura" : "Cadastrar Nova Cultura"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Mantenha o cadastro com a descrição e vínculos de fazenda/filial e PIMS.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-3.5 py-2">
            {error && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive">
                <AlertCircle className="size-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Fazenda / Filial */}
            <div className="space-y-1">
              <Label htmlFor="crop-fazenda" className="text-xs font-semibold">
                Fazenda / Filial *
              </Label>
              <select
                id="crop-fazenda"
                value={formData.fazenda}
                onChange={(e) => setFormData({ ...formData, fazenda: e.target.value })}
                required
                className="w-full h-8 rounded-md border border-input bg-background px-2.5 text-xs text-foreground cursor-pointer"
              >
                <option value="">Selecione a fazenda...</option>
                {farms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome} {f.filial ? `(Filial ${f.filial})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Descrição Completa */}
            <div className="space-y-1">
              <Label htmlFor="crop-desc" className="text-xs font-semibold">
                Descrição Completa da Cultura *
              </Label>
              <Input
                id="crop-desc"
                placeholder="Ex: SOJA, MILHO SAFRINHA, ALGODÃO"
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value.toUpperCase() })}
                className="h-8 text-xs uppercase font-medium"
                required
              />
            </div>

            {/* ID do PIMS */}
            <div className="space-y-1">
              <Label htmlFor="crop-pims" className="text-xs font-semibold">
                ID do PIMS (Opcional)
              </Label>
              <Input
                id="crop-pims"
                placeholder="Ex: 1040, CULT-PIMS-01"
                value={formData.id_pims}
                onChange={(e) => setFormData({ ...formData, id_pims: e.target.value })}
                className="h-8 text-xs font-mono"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button variant="outline" size="sm" type="button" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button size="sm" type="submit" disabled={submitting} className="bg-primary text-primary-foreground hover:bg-primary/90">
                {submitting ? "Gravando..." : "Salvar Cultura"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
