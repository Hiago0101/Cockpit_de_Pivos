import { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Grid3x3,
  Plus,
  Search,
  Edit2,
  Trash2,
  RefreshCw,
  Loader2,
  AlertCircle,
  Copy,
  Check,
  Building2,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { api, type Farm, type Field } from "@/services/api";

export const Route = createFileRoute("/talhoes")({
  head: () => ({
    meta: [
      { title: "Cadastro de Talhões — Cockpit de Pivôs" },
      { name: "description", content: "Cadastro, edição e manutenção de talhões agrícolas vinculados às fazendas." },
      { property: "og:title", content: "Cadastro de Talhões — Cockpit de Pivôs" },
      { property: "og:description", content: "Cadastro, edição e manutenção de talhões agrícolas vinculados às fazendas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TalhoesPage,
});

function TalhoesPage() {
  const [fields, setFields] = useState<Field[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFarmFilter, setSelectedFarmFilter] = useState<string>("ALL");

  // Modal de Criação / Edição
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingField, setEditingField] = useState<Field | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Campos do formulário
  const [formFazendaId, setFormFazendaId] = useState("");
  const [formCodigo, setFormCodigo] = useState("");
  const [formDescricao, setFormDescricao] = useState("");
  const [formAreaHa, setFormAreaHa] = useState("");
  const [formIdPims, setFormIdPims] = useState("");

  // Modal de Exclusão
  const [fieldToDelete, setFieldToDelete] = useState<Field | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Copiado ID feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [farmsData, fieldsData] = await Promise.all([
        api.getFarms(),
        api.getFields(),
      ]);
      setFarms(farmsData);
      setFields(fieldsData);
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível carregar os dados de talhões.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCreate = () => {
    setEditingField(null);
    // Se houver apenas 1 fazenda, seleciona automaticamente; caso contrário, vazio
    setFormFazendaId(farms.length === 1 && farms[0] ? farms[0].id : selectedFarmFilter !== "ALL" ? selectedFarmFilter : "");
    setFormCodigo("");
    setFormDescricao("");
    setFormAreaHa("");
    setFormIdPims("");
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (field: Field) => {
    setEditingField(field);
    setFormFazendaId(field.fazenda);
    setFormCodigo(field.codigo || "");
    setFormDescricao(field.descricao || field.nome || "");
    setFormAreaHa(field.area_ha ? String(field.area_ha) : "");
    setFormIdPims(field.id_pims || "");
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleSaveField = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    const cleanFazendaId = formFazendaId.trim();
    const cleanCodigo = formCodigo.trim().toUpperCase();
    const cleanDescricao = formDescricao.trim();
    const cleanIdPims = formIdPims.trim();

    // 1. Validação de Fazenda
    if (!cleanFazendaId) {
      setModalError("Selecione a fazenda vinculada ao talhão.");
      return;
    }

    // 2. Validação de Código
    if (!cleanCodigo) {
      setModalError("O código do talhão é obrigatório (ex: TAL-01).");
      return;
    }

    // 3. Validação de Descrição
    if (!cleanDescricao) {
      setModalError("A descrição do talhão é obrigatória.");
      return;
    }

    // 4. Validação de duplicidade de código dentro da mesma fazenda
    const codigoDuplicado = fields.find(
      (f) =>
        f.fazenda === cleanFazendaId &&
        f.codigo?.trim().toUpperCase() === cleanCodigo &&
        (!editingField || f.id !== editingField.id)
    );

    if (codigoDuplicado) {
      const fazendaNome = farms.find((farm) => farm.id === cleanFazendaId)?.nome || "nesta fazenda";
      setModalError(`Já existe um talhão com o código "${cleanCodigo}" cadastrado na ${fazendaNome}.`);
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: Partial<Field> = {
        fazenda: cleanFazendaId,
        codigo: cleanCodigo,
        descricao: cleanDescricao,
        nome: cleanDescricao.slice(0, 100),
        area_ha: formAreaHa ? Number(formAreaHa) : 0,
      };
      if (cleanIdPims) {
        payload.id_pims = cleanIdPims;
      }

      if (editingField) {
        await api.updateField(editingField.id, payload);
        toast.success(`Talhão "${cleanCodigo}" atualizado com sucesso!`);
      } else {
        await api.createField(payload);
        toast.success(`Talhão "${cleanCodigo}" cadastrado com sucesso!`);
      }

      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      setModalError(err?.message || "Erro ao salvar talhão no servidor.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!fieldToDelete) return;
    const target = fieldToDelete;
    setIsDeleting(true);

    try {
      await api.deleteField(target.id);
      setFieldToDelete(null);
      toast.success(`Talhão "${target.codigo}" excluído com sucesso!`);
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || `Não foi possível excluir o talhão "${target.codigo}".`);
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

  // Filtragem por fazenda e por termo de busca
  const filteredFields = fields.filter((f) => {
    if (selectedFarmFilter !== "ALL" && f.fazenda !== selectedFarmFilter) {
      return false;
    }
    const term = searchTerm.toLowerCase();
    const matchesCodigo = f.codigo?.toLowerCase().includes(term);
    const matchesDescricao = (f.descricao || f.nome || "").toLowerCase().includes(term);
    const matchesFazendaNome = f.fazenda_nome?.toLowerCase().includes(term);
    const matchesId = f.id?.toLowerCase().includes(term);
    const matchesPims = f.id_pims?.toLowerCase().includes(term);
    return matchesCodigo || matchesDescricao || matchesFazendaNome || matchesId || matchesPims;
  });

  return (
    <div className="flex-1 space-y-6 p-6 sm:p-8">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
              <Grid3x3 className="size-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Cadastro de Talhões
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie os talhões agrícolas vinculados às suas fazendas, códigos e descrições operacionais.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={isLoading}
            className="cursor-pointer gap-1.5"
          >
            <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>

          <Button
            size="sm"
            onClick={handleOpenCreate}
            className="cursor-pointer gap-1.5 font-semibold shadow-sm"
          >
            <Plus className="size-4" />
            Novo Talhão
          </Button>
        </div>
      </div>

      {/* Alerta se não houver fazendas cadastradas */}
      {!isLoading && farms.length === 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-300 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="size-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="font-semibold">Nenhuma fazenda cadastrada</p>
              <p className="text-xs mt-0.5 text-amber-700 dark:text-amber-400">
                Para cadastrar talhões, você precisa vincular a uma fazenda existente. Cadastre primeiro uma fazenda no sistema.
              </p>
            </div>
          </div>
          <Button asChild size="sm" variant="outline" className="shrink-0 bg-background text-xs cursor-pointer">
            <Link to="/fazendas">Ir para Fazendas</Link>
          </Button>
        </div>
      )}

      {/* Barra de Busca e Filtros */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-1 flex-col sm:flex-row items-center gap-2.5 max-w-2xl">
          {/* Busca textual */}
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar por Código, Descrição, Fazenda ou ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-10 text-sm bg-background w-full"
            />
          </div>

          {/* Filtro por Fazenda */}
          {farms.length > 0 && (
            <div className="relative w-full sm:w-64 shrink-0">
              <select
                aria-label="Filtrar por Fazenda"
                value={selectedFarmFilter}
                onChange={(e) => setSelectedFarmFilter(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
              >
                <option value="ALL">Todas as Fazendas ({farms.length})</option>
                {farms.map((farm) => (
                  <option key={farm.id} value={farm.id}>
                    {farm.nome} {farm.filial ? `(Filial ${farm.filial})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="text-xs text-muted-foreground shrink-0 self-end sm:self-center">
          Total de {filteredFields.length} talhão(ões) listado(s)
        </div>
      </div>

      {/* Tabela de Talhões */}
      <Card className="border-border">
        <CardHeader className="pb-3 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Registros de Talhões</CardTitle>
              <CardDescription className="text-xs">
                Listagem detalhada com ID do sistema, fazenda vinculada, código e descrição.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
              <Loader2 className="size-5 animate-spin text-primary" />
              <span className="text-sm">Carregando talhões...</span>
            </div>
          ) : filteredFields.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground space-y-2">
              <Grid3x3 className="size-10 mx-auto text-muted-foreground/40 mb-2" />
              <p className="font-medium text-foreground">Nenhum talhão encontrado</p>
              <p className="text-xs text-muted-foreground">
                {searchTerm || selectedFarmFilter !== "ALL"
                  ? "Tente ajustar os filtros ou termos de busca."
                  : farms.length === 0
                  ? "Cadastre uma fazenda primeiro para poder registrar seus talhões."
                  : "Clique em 'Novo Talhão' para cadastrar o primeiro lote agrícola."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                  <tr>
                    <th className="px-6 py-3.5">ID (Sistema)</th>
                    <th className="px-6 py-3.5">Fazenda Vinculada</th>
                    <th className="px-6 py-3.5">Código</th>
                    <th className="px-6 py-3.5">Descrição</th>
                    <th className="px-6 py-3.5">Área (ha)</th>
                    <th className="px-6 py-3.5">ID PIMS</th>
                    <th className="px-6 py-3.5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredFields.map((field) => {
                    const farmObj = farms.find((f) => f.id === field.fazenda);
                    const farmNome = field.fazenda_nome || farmObj?.nome || "Fazenda Vinculada";
                    const farmFilial = field.fazenda_filial || farmObj?.filial || farmObj?.codigo || "";

                    return (
                      <tr key={field.id} className="hover:bg-muted/30 transition-colors">
                        {/* Coluna ID */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                            <span className="truncate max-w-[150px] sm:max-w-[200px]" title={field.id}>
                              {field.id}
                            </span>
                            <button
                              onClick={() => handleCopyId(field.id)}
                              className="p-1 rounded hover:bg-muted text-muted-foreground/70 hover:text-foreground transition-colors cursor-pointer"
                              title="Copiar ID completo"
                            >
                              {copiedId === field.id ? (
                                <Check className="size-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="size-3.5" />
                              )}
                            </button>
                          </div>
                        </td>

                        {/* Coluna Fazenda Vinculada */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Building2 className="size-3.5 text-muted-foreground shrink-0" />
                            <span className="font-semibold text-foreground text-sm">{farmNome}</span>
                            {farmFilial && (
                              <Badge variant="outline" className="font-mono text-[11px] bg-primary/5 text-primary border-primary/20">
                                Filial: {farmFilial}
                              </Badge>
                            )}
                          </div>
                        </td>

                        {/* Coluna Código */}
                        <td className="px-6 py-4">
                          <Badge variant="secondary" className="font-mono font-bold text-xs uppercase px-2.5 py-0.5">
                            {field.codigo}
                          </Badge>
                        </td>

                        {/* Coluna Descrição */}
                        <td className="px-6 py-4">
                          <span className="text-foreground text-sm font-medium">
                            {field.descricao || field.nome || "—"}
                          </span>
                        </td>

                        {/* Coluna Área (ha) */}
                        <td className="px-6 py-4">
                          <span className="font-semibold text-foreground text-sm">
                            {field.area_ha ? `${Number(field.area_ha).toFixed(2)} ha` : "—"}
                          </span>
                        </td>

                        {/* Coluna ID PIMS */}
                        <td className="px-6 py-4">
                          {field.id_pims ? (
                            <Badge variant="outline" className="font-mono text-xs bg-muted/40 border-border">
                              {field.id_pims}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground/50 text-xs">—</span>
                          )}
                        </td>

                        {/* Coluna Ações */}
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEdit(field)}
                              className="h-8 px-2.5 text-xs cursor-pointer hover:bg-muted"
                              title="Editar Talhão"
                            >
                              <Edit2 className="size-3.5 mr-1" />
                              Editar
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setFieldToDelete(field)}
                              className="h-8 px-2.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                              title="Excluir Talhão"
                            >
                              <Trash2 className="size-3.5 mr-1" />
                              Excluir
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

      {/* MODAL: Criação / Edição de Talhão */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              {editingField ? "Editar Talhão" : "Novo Talhão"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {editingField
                ? "Atualize as informações do talhão agrícola selecionado."
                : "Preencha os dados do talhão e vincule-o a uma fazenda."}
            </DialogDescription>
          </DialogHeader>

          {modalError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>{modalError}</span>
            </div>
          )}

          <form onSubmit={handleSaveField} className="space-y-4 py-2">
            {/* Vincular Fazenda */}
            <div className="space-y-1.5">
              <Label htmlFor="fazenda" className="text-xs font-semibold">
                Fazenda Vinculada *
              </Label>
              <select
                id="fazenda"
                value={formFazendaId}
                onChange={(e) => setFormFazendaId(e.target.value)}
                required
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
              >
                <option value="">Selecione uma fazenda...</option>
                {farms.map((farm) => (
                  <option key={farm.id} value={farm.id}>
                    {farm.nome} {farm.filial ? `(Filial: ${farm.filial})` : ""}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground">
                Selecione a unidade agrícola à qual este talhão pertence.
              </p>
            </div>

            {/* Código */}
            <div className="space-y-1.5">
              <Label htmlFor="codigo" className="text-xs font-semibold">
                Código *
              </Label>
              <Input
                id="codigo"
                placeholder="Ex: TAL-01, 102, T-A"
                value={formCodigo}
                onChange={(e) => setFormCodigo(e.target.value.toUpperCase())}
                required
                className="uppercase font-mono"
              />
              <p className="text-[11px] text-muted-foreground">
                Identificador operacional único deste talhão dentro da fazenda.
              </p>
            </div>

            {/* Descrição */}
            <div className="space-y-1.5">
              <Label htmlFor="descricao" className="text-xs font-semibold">
                Descrição *
              </Label>
              <Input
                id="descricao"
                placeholder="Ex: Talhão Pivô 01 Sede, Lote Norte Soja"
                value={formDescricao}
                onChange={(e) => setFormDescricao(e.target.value)}
                required
              />
              <p className="text-[11px] text-muted-foreground">
                Descrição ou nome identificador do talhão.
              </p>
            </div>

            {/* Área (ha) */}
            <div className="space-y-1.5">
              <Label htmlFor="area_ha" className="text-xs font-semibold">
                Área (ha)
              </Label>
              <Input
                id="area_ha"
                type="number"
                step="0.01"
                min="0"
                placeholder="Ex: 85.50"
                value={formAreaHa}
                onChange={(e) => setFormAreaHa(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Área cultivável do talhão em hectares.
              </p>
            </div>

            {/* ID PIMS (Opcional) */}
            <div className="space-y-1.5">
              <Label htmlFor="id_pims" className="text-xs font-semibold">
                ID do PIMS (Opcional)
              </Label>
              <Input
                id="id_pims"
                placeholder="Ex: 90210, TLH-PIMS-01"
                value={formIdPims}
                onChange={(e) => setFormIdPims(e.target.value)}
                className="font-mono"
              />
              <p className="text-[11px] text-muted-foreground">
                Identificador correspondente no sistema PIMS (não obrigatório).
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
                className="cursor-pointer font-semibold"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin mr-1.5" />
                    Salvando...
                  </>
                ) : editingField ? (
                  "Salvar Alterações"
                ) : (
                  "Cadastrar Talhão"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: Exclusão de Talhão */}
      <AlertDialog open={Boolean(fieldToDelete)} onOpenChange={(open) => !open && setFieldToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="size-5" />
              Excluir Talhão
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Tem certeza que deseja excluir o talhão{" "}
              <strong className="text-foreground font-mono font-bold">"{fieldToDelete?.codigo}"</strong> (
              {fieldToDelete?.descricao || fieldToDelete?.nome})?
              <br />
              <span className="block mt-2 text-xs text-muted-foreground">
                Esta ação não pode ser desfeita. Todos os vínculos com operações e pivôs associados podem ser impactados.
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
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer font-semibold"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  Excluindo...
                </>
              ) : (
                "Sim, Excluir Talhão"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
