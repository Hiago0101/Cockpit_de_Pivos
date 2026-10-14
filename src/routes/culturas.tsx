import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Sprout,
  Plus,
  Search,
  Edit2,
  Trash2,
  RefreshCw,
  Loader2,
  AlertCircle,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { api, type Crop, type Farm } from "@/services/api";

export const Route = createFileRoute("/culturas")({
  head: () => ({
    meta: [
      { title: "Cadastro de Culturas — Cockpit de Pivôs" },
      { name: "description", content: "Cadastro, edição e manutenção de culturas agrícolas e identificadores PIMS vinculados a filiais." },
      { property: "og:title", content: "Cadastro de Culturas — Cockpit de Pivôs" },
      { property: "og:description", content: "Cadastro, edição e manutenção de culturas agrícolas e identificadores PIMS vinculados a filiais." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CulturasPage,
});

function CulturasPage() {
  const [crops, setCrops] = useState<Crop[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFarmFilter, setSelectedFarmFilter] = useState<string>("ALL");

  // Modal de Criação / Edição
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCrop, setEditingCrop] = useState<Crop | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Campos do formulário de Cultura
  const [formFazendaId, setFormFazendaId] = useState("");
  const [formDescricao, setFormDescricao] = useState("");
  const [formIdPims, setFormIdPims] = useState("");

  // Modal de Exclusão
  const [cropToDelete, setCropToDelete] = useState<Crop | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Feedback de cópia do ID
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [cropsData, farmsData] = await Promise.all([
        api.getCrops(),
        api.getFarms(),
      ]);
      setCrops(cropsData);
      setFarms(farmsData);
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível carregar as culturas cadastradas.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCreate = () => {
    setEditingCrop(null);
    setFormFazendaId(
      farms.length === 1 && farms[0] ? farms[0].id : selectedFarmFilter !== "ALL" ? selectedFarmFilter : ""
    );
    setFormDescricao("");
    setFormIdPims("");
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (crop: Crop) => {
    setEditingCrop(crop);
    setFormFazendaId(crop.fazenda || "");
    setFormDescricao(crop.descricao || "");
    setFormIdPims(crop.id_pims || "");
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleSaveCrop = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    const cleanDescricao = formDescricao.trim().toUpperCase();
    const cleanIdPims = formIdPims.trim();
    const cleanFazendaId = formFazendaId.trim();

    // 1. Validação da Fazenda / Filial
    if (!cleanFazendaId) {
      setModalError("Selecione a fazenda / filial vinculada à cultura.");
      return;
    }

    // 2. Validação da Descrição Completa
    if (!cleanDescricao) {
      setModalError("A descrição completa da cultura é obrigatória.");
      return;
    }

    // 3. Validação de duplicidade na listagem local
    const duplicada = crops.find(
      (c) =>
        c.descricao?.trim().toUpperCase() === cleanDescricao &&
        (!cleanFazendaId || !c.fazenda || c.fazenda === cleanFazendaId) &&
        (!editingCrop || c.id !== editingCrop.id)
    );

    if (duplicada) {
      setModalError(`Já existe uma cultura cadastrada com a descrição "${cleanDescricao}" nesta fazenda/filial.`);
      return;
    }

    // 4. Validação de duplicidade do ID PIMS na listagem local
    if (cleanIdPims) {
      const duplicadaPims = crops.find(
        (c) =>
          c.id_pims?.trim().toUpperCase() === cleanIdPims.toUpperCase() &&
          (!editingCrop || c.id !== editingCrop.id)
      );
      if (duplicadaPims) {
        setModalError(
          `Já existe uma cultura cadastrada com o ID PIMS "${cleanIdPims}" (${duplicadaPims.descricao}).`
        );
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const payload: Partial<Crop> = {
        descricao: cleanDescricao,
        fazenda: cleanFazendaId || null,
        id_pims: cleanIdPims || "",
      };

      if (editingCrop) {
        await api.updateCrop(editingCrop.id, payload);
        toast.success(`Cultura "${cleanDescricao}" atualizada com sucesso!`);
      } else {
        await api.createCrop(payload);
        toast.success(`Cultura "${cleanDescricao}" cadastrada com sucesso!`);
      }

      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      setModalError(err?.message || "Erro ao salvar cultura no servidor.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!cropToDelete) return;
    const target = cropToDelete;
    setIsDeleting(true);

    try {
      await api.deleteCrop(target.id);
      setCropToDelete(null);
      toast.success(`Cultura "${target.descricao}" excluída com sucesso!`);
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || `Não foi possível excluir a cultura.`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    toast.info("ID copiado para a área de transferência");
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filtragem
  const filteredCrops = crops.filter((crop) => {
    if (selectedFarmFilter !== "ALL" && crop.fazenda !== selectedFarmFilter) {
      return false;
    }

    const term = searchTerm.toLowerCase();
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
    <div className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8 w-full max-w-[1600px] mx-auto">
      {/* Cabeçalho Padronizado */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-xl bg-primary/10 border border-primary/20 text-primary shadow-xs">
            <Sprout className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Cadastro de Culturas
              </h1>
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground border border-border/40">
                {crops.length}
              </span>
            </div>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
              Gestão de culturas agrícolas e identificadores PIMS vinculados a filiais e talhões.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={isLoading}
            className="h-9 gap-1.5 text-xs font-medium cursor-pointer shadow-xs"
            title="Atualizar catálogo de culturas"
          >
            <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Atualizar</span>
          </Button>

          <Button
            size="sm"
            onClick={handleOpenCreate}
            className="h-9 gap-1.5 text-xs font-semibold cursor-pointer shadow-xs bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Plus className="size-4" />
            Nova Cultura
          </Button>
        </div>
      </div>

      {/* Barra de Busca e Filtros Padronizada */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-1">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Buscar por descrição, fazenda ou ID PIMS..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-xs bg-background border-border/80"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {farms.length > 0 && (
            <select
              aria-label="Filtrar por Fazenda / Filial"
              value={selectedFarmFilter}
              onChange={(e) => setSelectedFarmFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
            >
              <option value="ALL">Todas as Fazendas ({farms.length})</option>
              {farms.map((farm) => (
                <option key={farm.id} value={farm.id}>
                  {farm.nome} {farm.filial ? `(Filial ${farm.filial})` : ""}
                </option>
              ))}
            </select>
          )}

          <div className="text-xs font-medium text-muted-foreground ml-1">
            Total de {filteredCrops.length} cultura(s) listada(s)
          </div>
        </div>
      </div>

      {/* Tabela de Culturas Padronizada */}
      <Card className="shadow-xs border-border/80 overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Loader2 className="size-8 animate-spin text-primary mb-2" />
              <p className="text-sm font-medium text-muted-foreground">Carregando catálogo de culturas...</p>
            </div>
          ) : filteredCrops.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <div className="size-12 rounded-full bg-muted/60 flex items-center justify-center mb-3">
                <Sprout className="size-6 text-muted-foreground/60" />
              </div>
              <h3 className="text-base font-semibold text-foreground">Nenhuma cultura encontrada</h3>
              <p className="text-xs text-muted-foreground max-w-sm mt-1 mb-4">
                {searchTerm || selectedFarmFilter !== "ALL"
                  ? "Nenhum resultado corresponde aos filtros aplicados. Tente ajustar os termos."
                  : "Nenhuma cultura agronômica cadastrada. Cadastre a primeira cultura para o plantio."}
              </p>
              <Button size="sm" onClick={handleOpenCreate} className="gap-1.5 text-xs font-semibold cursor-pointer">
                <Plus className="size-3.5" />
                Cadastrar Primeira Cultura
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 border-b border-border/60 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider select-none">
                  <tr>
                    <th className="px-6 py-3.5">Código do Sistema</th>
                    <th className="px-6 py-3.5">Descrição Completa</th>
                    <th className="px-6 py-3.5">Fazenda / Filial</th>
                    <th className="px-6 py-3.5">ID PIMS</th>
                    <th className="px-6 py-3.5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredCrops.map((crop) => {
                    const descDisplay = crop.descricao || "—";
                    return (
                      <tr key={crop.id} className="hover:bg-muted/30 transition-colors">
                        {/* Código do Sistema */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                            <span className="truncate max-w-[140px] sm:max-w-[180px]" title={crop.id}>
                              {crop.id}
                            </span>
                            <button
                              onClick={() => handleCopyId(crop.id)}
                              className="p-1 rounded hover:bg-muted text-muted-foreground/70 hover:text-foreground transition-colors cursor-pointer"
                              title="Copiar ID completo"
                            >
                              {copiedId === crop.id ? (
                                <Check className="size-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="size-3.5" />
                              )}
                            </button>
                          </div>
                        </td>

                        {/* Descrição Completa */}
                        <td className="px-6 py-4">
                          <span className="text-foreground text-sm font-semibold uppercase">
                            {descDisplay}
                          </span>
                        </td>

                        {/* Fazenda / Filial */}
                        <td className="px-6 py-4">
                          {crop.fazenda_nome ? (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {crop.fazenda_filial && (
                                <Badge variant="secondary" className="font-mono text-[11px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20">
                                  Filial {crop.fazenda_filial}
                                </Badge>
                              )}
                              <span className="text-sm font-medium text-foreground">
                                {crop.fazenda_nome}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground/50 text-xs font-mono">—</span>
                          )}
                        </td>

                        {/* ID PIMS */}
                        <td className="px-6 py-4">
                          {crop.id_pims ? (
                            <Badge variant="outline" className="font-mono text-xs bg-muted/40 border-border">
                              {crop.id_pims}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground/50 text-xs">—</span>
                          )}
                        </td>

                        {/* Ações */}
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEdit(crop)}
                              className="h-8 px-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer gap-1"
                            >
                              <Edit2 className="size-3.5" />
                              <span className="hidden sm:inline">Editar</span>
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setCropToDelete(crop)}
                              className="h-8 px-2 text-xs font-semibold text-destructive/80 hover:text-destructive hover:bg-destructive/10 cursor-pointer gap-1"
                            >
                              <Trash2 className="size-3.5" />
                              <span className="hidden sm:inline">Excluir</span>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* MODAL: Criação / Edição de Cultura */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Sprout className="size-5 text-primary" />
              <span>{editingCrop ? "Editar Cultura" : "Nova Cultura"}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {editingCrop
                ? "Atualize as informações da cultura agrícola cadastrada."
                : "Preencha a descrição da cultura e os vínculos com fazenda/filial e PIMS."}
            </DialogDescription>
          </DialogHeader>

          {modalError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>{modalError}</span>
            </div>
          )}

          <form onSubmit={handleSaveCrop} className="space-y-4 py-2">
            {/* Vínculo de Fazenda / Filial */}
            <div className="space-y-1.5">
              <Label htmlFor="fazenda" className="text-xs font-semibold">
                Fazenda / Filial *
              </Label>
              <select
                id="fazenda"
                value={formFazendaId}
                onChange={(e) => setFormFazendaId(e.target.value)}
                required
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
              >
                <option value="">Selecione a fazenda...</option>
                {farms.map((farm) => (
                  <option key={farm.id} value={farm.id}>
                    {farm.nome} {farm.filial ? `(Filial ${farm.filial})` : ""}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground">
                Selecione a unidade operacional ou filial vinculada a esta cultura.
              </p>
            </div>

            {/* Descrição Completa da Cultura */}
            <div className="space-y-1.5">
              <Label htmlFor="descricao" className="text-xs font-semibold">
                Descrição Completa da Cultura *
              </Label>
              <Input
                id="descricao"
                placeholder="Ex: MILHO SAFRINHA, SOJA CONVENCIONAL, ALGODÃO"
                value={formDescricao}
                onChange={(e) => setFormDescricao(e.target.value.toUpperCase())}
                required
                className="uppercase font-medium"
              />
              <p className="text-[11px] text-muted-foreground">
                Nome ou descrição agronômica completa da cultura (sempre em maiúsculo).
              </p>
            </div>

            {/* ID do PIMS (Opcional) */}
            <div className="space-y-1.5">
              <Label htmlFor="id_pims" className="text-xs font-semibold">
                ID do PIMS (Opcional)
              </Label>
              <Input
                id="id_pims"
                placeholder="Ex: 1040, CULT-PIMS-01"
                value={formIdPims}
                onChange={(e) => setFormIdPims(e.target.value)}
                className="font-mono"
              />
              <p className="text-[11px] text-muted-foreground">
                Identificador exclusivo de integração no sistema PIMS (não permite duplicidade).
              </p>
            </div>

            <DialogFooter className="pt-3 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsModalOpen(false)}
                disabled={isSubmitting}
                className="cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin mr-1.5" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <span>{editingCrop ? "Atualizar Cultura" : "Cadastrar Cultura"}</span>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: Confirmação de Exclusão */}
      <AlertDialog open={!!cropToDelete} onOpenChange={(open) => !open && setCropToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <AlertCircle className="size-5" />
              <span>Confirmar Exclusão</span>
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Tem certeza que deseja excluir a cultura{" "}
              <strong>"{cropToDelete?.descricao}"</strong> (ID: {cropToDelete?.id})?
              <br /><br />
              <span className="text-xs text-muted-foreground">
                Esta ação só é permitida se a cultura não estiver associada a nenhum plano operacional ou apontamento existente.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting} className="cursor-pointer">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer"
            >
              {isDeleting ? "Excluindo..." : "Excluir Cultura"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}