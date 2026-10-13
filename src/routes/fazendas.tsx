import { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Building2,
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

export const Route = createFileRoute("/fazendas")({
  head: () => ({
    meta: [
      { title: "Cadastro de Fazendas — Cockpit de Pivôs" },
      { name: "description", content: "Cadastro, edição e manutenção de fazendas e filiais operacionais." },
      { property: "og:title", content: "Cadastro de Fazendas — Cockpit de Pivôs" },
      { property: "og:description", content: "Cadastro, edição e manutenção de fazendas e filiais operacionais." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FazendasPage,
});

function FazendasPage() {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Modal de Criação / Edição
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFarm, setEditingFarm] = useState<Farm | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Campos do formulário
  const [formNome, setFormNome] = useState("");
  const [formFilial, setFormFilial] = useState("");
  const [formIdPims, setFormIdPims] = useState("");

  // Modal de Exclusão
  const [farmToDelete, setFarmToDelete] = useState<Farm | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCheckingRelations, setIsCheckingRelations] = useState(false);
  const [linkedFields, setLinkedFields] = useState<Field[]>([]);

  const handleOpenDelete = async (farm: Farm) => {
    setFarmToDelete(farm);
    setIsCheckingRelations(true);
    setLinkedFields([]);
    try {
      const fields = await api.getFields({ fazenda: farm.id });
      setLinkedFields(fields);
    } catch {
      // Backend garantirá a validação caso a consulta falhe
    } finally {
      setIsCheckingRelations(false);
    }
  };

  // Copiado ID feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadFarms = async () => {
    setIsLoading(true);
    try {
      const data = await api.getFarms();
      setFarms(data);
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível carregar as fazendas.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFarms();
  }, []);

  const handleOpenCreate = () => {
    setEditingFarm(null);
    setFormNome("");
    setFormFilial("");
    setFormIdPims("");
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (farm: Farm) => {
    setEditingFarm(farm);
    setFormNome((farm.nome || "").toUpperCase());
    setFormFilial(farm.filial || farm.codigo || "");
    setFormIdPims(farm.id_pims || "");
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleSaveFarm = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    const cleanNome = formNome.trim().toUpperCase();
    const cleanFilial = formFilial.trim();
    const cleanIdPims = formIdPims.trim();

    // 1. Validação de Nome
    if (!cleanNome) {
      setModalError("O Nome da Fazenda é obrigatório.");
      return;
    }

    // 2. Validação de Filial (exatamente 6 dígitos numéricos)
    if (!cleanFilial) {
      setModalError("O campo Filial é obrigatório.");
      return;
    }

    if (cleanFilial.length !== 6 || !/^\d{6}$/.test(cleanFilial)) {
      setModalError("A Filial deve conter exatamente 6 dígitos numéricos.");
      return;
    }

    // 3. Validação de duplicidade da Filial
    const filialDuplicada = farms.find(
      (f) => f.filial === cleanFilial && (!editingFarm || f.id !== editingFarm.id)
    );
    if (filialDuplicada) {
      setModalError(`A Filial "${cleanFilial}" já está cadastrada na fazenda "${filialDuplicada.nome}".`);
      return;
    }

    // 4. Validação de ID PIMS
    if (cleanIdPims && cleanIdPims.length > 50) {
      setModalError("O ID PIMS pode conter no máximo 50 caracteres.");
      return;
    }

    // 5. Validação de duplicidade do ID PIMS
    if (cleanIdPims) {
      const pimsDuplicado = farms.find(
        (f) =>
          f.id_pims?.trim().toLowerCase() === cleanIdPims.toLowerCase() &&
          (!editingFarm || f.id !== editingFarm.id)
      );
      if (pimsDuplicado) {
        setModalError(`O ID PIMS "${cleanIdPims}" já está cadastrado na fazenda "${pimsDuplicado.nome}".`);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const payload: Partial<Farm> = {
        nome: cleanNome,
        filial: cleanFilial,
        id_pims: cleanIdPims,
        codigo: cleanFilial,
      };

      if (editingFarm) {
        await api.updateFarm(editingFarm.id, payload);
        toast.success(`Fazenda "${cleanNome}" atualizada com sucesso!`);
      } else {
        await api.createFarm(payload);
        toast.success(`Fazenda "${cleanNome}" cadastrada com sucesso!`);
      }

      setIsModalOpen(false);
      await loadFarms();
    } catch (err: any) {
      setModalError(err?.message || "Erro ao salvar fazenda no servidor.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!farmToDelete) return;
    const target = farmToDelete;
    setIsDeleting(true);

    try {
      await api.deleteFarm(target.id);
      setFarmToDelete(null);
      toast.success(`Fazenda "${target.nome}" excluída com sucesso!`);
      await loadFarms();
    } catch (err: any) {
      toast.error(err?.message || `Não foi possível excluir a fazenda "${target.nome}".`);
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

  const filteredFarms = farms.filter((f) => {
    const term = searchTerm.toLowerCase();
    const matchesNome = f.nome?.toLowerCase().includes(term);
    const matchesFilial = (f.filial || f.codigo || "").toLowerCase().includes(term);
    const matchesId = f.id?.toLowerCase().includes(term);
    const matchesPims = f.id_pims?.toLowerCase().includes(term);
    return matchesNome || matchesFilial || matchesId || matchesPims;
  });

  return (
    <div className="flex-1 space-y-6 p-6 sm:p-8">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
              <Building2 className="size-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Cadastro de Fazendas
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie as unidades agrícolas, filiais operacionais e identificadores integrados ao sistema.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={loadFarms}
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
            Nova Fazenda
          </Button>
        </div>
      </div>

      {/* Barra de Busca e Filtros */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Buscar por Nome da Fazenda, Filial ou ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-10 text-sm bg-background"
          />
        </div>
        <div className="text-xs text-muted-foreground">
          Total de {filteredFarms.length} fazenda(s) listada(s)
        </div>
      </div>

      {/* Tabela de Fazendas */}
      <Card className="border-border">
        <CardHeader className="pb-3 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Registros de Fazendas</CardTitle>
              <CardDescription className="text-xs">
                Listagem detalhada de ID, Filial e Nome da Fazenda.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
              <Loader2 className="size-5 animate-spin text-primary" />
              <span className="text-sm">Carregando fazendas...</span>
            </div>
          ) : filteredFarms.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground space-y-2">
              <Building2 className="size-10 mx-auto text-muted-foreground/40 mb-2" />
              <p className="font-medium text-foreground">Nenhuma fazenda encontrada</p>
              <p className="text-xs text-muted-foreground">
                {searchTerm ? "Tente ajustar os termos de busca." : "Clique em 'Nova Fazenda' para cadastrar a primeira unidade."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                  <tr>
                    <th className="px-6 py-3.5">ID (Sistema)</th>
                    <th className="px-6 py-3.5">Filial</th>
                    <th className="px-6 py-3.5">Nome Fazenda</th>
                    <th className="px-6 py-3.5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredFarms.map((farm) => {
                    const filialDisplay = farm.filial || farm.codigo || "—";
                    return (
                      <tr key={farm.id} className="hover:bg-muted/30 transition-colors">
                        {/* Coluna ID */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                            <span className="truncate max-w-[150px] sm:max-w-[200px]" title={farm.id}>
                              {farm.id}
                            </span>
                            <button
                              onClick={() => handleCopyId(farm.id)}
                              className="p-1 rounded hover:bg-muted text-muted-foreground/70 hover:text-foreground transition-colors cursor-pointer"
                              title="Copiar ID completo"
                            >
                              {copiedId === farm.id ? (
                                <Check className="size-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="size-3.5" />
                              )}
                            </button>
                          </div>
                        </td>

                        {/* Coluna Filial */}
                        <td className="px-6 py-4">
                          <Badge variant="outline" className="font-mono font-semibold bg-primary/5 text-primary border-primary/20 text-xs">
                            {filialDisplay}
                          </Badge>
                        </td>

                        {/* Coluna Nome Fazenda */}
                        <td className="px-6 py-4">
                          <div className="font-semibold text-foreground text-sm flex items-center gap-2">
                            <span>{farm.nome}</span>
                            {farm.id_pims && (
                              <span className="text-[11px] text-muted-foreground font-normal bg-muted/60 px-1.5 py-0.5 rounded" title="ID PIMS">
                                PIMS: {farm.id_pims}
                              </span>
                            )}
                          </div>
                          {(farm.municipio || farm.uf) && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {farm.municipio} {farm.uf ? `— ${farm.uf}` : ""}
                            </div>
                          )}
                        </td>

                        {/* Coluna Ações */}
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEdit(farm)}
                              className="h-8 px-2.5 text-xs cursor-pointer hover:bg-muted"
                              title="Editar Fazenda"
                            >
                              <Edit2 className="size-3.5 mr-1" />
                              Editar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenDelete(farm)}
                              className="h-8 px-2.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                              title="Excluir Fazenda"
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

      {/* Modal / Dialog de Cadastro e Edição */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingFarm ? `Editar Fazenda: ${editingFarm.nome}` : "Cadastrar Nova Fazenda"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Preencha os dados da unidade agrícola. O ID é gerado automaticamente pelo sistema.
            </DialogDescription>
          </DialogHeader>

          {modalError && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <AlertCircle className="size-3.5 shrink-0" />
              <span className="leading-normal">{modalError}</span>
            </div>
          )}

          <form onSubmit={handleSaveFarm} className="space-y-4">
            {/* Nome da Fazenda */}
            <div className="space-y-1.5">
              <Label htmlFor="form-nome" className="text-xs font-semibold">
                Nome Fazenda <span className="text-destructive">*</span>
              </Label>
              <Input
                id="form-nome"
                required
                value={formNome}
                onChange={(e) => setFormNome(e.target.value.toUpperCase())}
                placeholder="Ex: FAZENDA FARROUPILHA I"
                className="h-9 text-sm uppercase"
              />
            </div>

            {/* Filial */}
            <div className="space-y-1.5">
              <Label htmlFor="form-filial" className="text-xs font-semibold">
                Filial <span className="text-destructive">*</span>
              </Label>
              <Input
                id="form-filial"
                required
                maxLength={6}
                inputMode="numeric"
                pattern="[0-9]*"
                value={formFilial}
                onChange={(e) => setFormFilial(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                className="h-9 text-sm font-mono tracking-wider"
              />
            </div>

            {/* ID PIMS */}
            <div className="space-y-1.5">
              <Label htmlFor="form-id-pims" className="text-xs font-semibold">
                ID PIMS <span className="text-muted-foreground font-normal">(não obrigatório)</span>
              </Label>
              <Input
                id="form-id-pims"
                maxLength={50}
                value={formIdPims}
                onChange={(e) => setFormIdPims(e.target.value)}
                placeholder="Ex: PIMS-SG-01"
                className="h-9 text-sm"
              />
            </div>

            <DialogFooter className="gap-2 pt-2">
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
                className="cursor-pointer gap-1.5 font-semibold"
              >
                {isSubmitting && <Loader2 className="size-3.5 animate-spin" />}
                {editingFarm ? "Atualizar Fazenda" : "Salvar Fazenda"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação de Exclusão */}
      <AlertDialog open={!!farmToDelete} onOpenChange={(open) => !open && setFarmToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="size-5" />
              Confirmar Exclusão de Fazenda
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed">
              Tem certeza que deseja excluir a fazenda{" "}
              <strong className="text-foreground">{farmToDelete?.nome}</strong>{" "}
              {farmToDelete?.filial && (
                <>(Filial: <strong className="text-foreground">{farmToDelete.filial}</strong>)</>
              )}
              ?
            </AlertDialogDescription>
          </AlertDialogHeader>

          {isCheckingRelations ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
              <Loader2 className="size-3.5 animate-spin text-primary" />
              <span>Verificando vínculos da fazenda...</span>
            </div>
          ) : linkedFields.length > 0 ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive space-y-2">
              <div className="flex items-center gap-2 font-semibold text-destructive">
                <AlertCircle className="size-4 shrink-0" />
                <span>Exclusão Bloqueada: {linkedFields.length} talhão(ões) vinculado(s)</span>
              </div>
              <p className="text-[11px] leading-relaxed text-destructive/90">
                Esta fazenda possui {linkedFields.length} talhão(ões) registrado(s) ({linkedFields.map((f) => f.codigo).slice(0, 3).join(", ")}{linkedFields.length > 3 ? "..." : ""}). Para manter a integridade dos dados, você deve excluir ou desvincular todos os talhões antes de excluir a fazenda.
              </p>
              <div className="pt-1">
                <Button asChild size="sm" variant="outline" className="h-7 text-xs bg-background cursor-pointer text-foreground">
                  <Link to="/talhoes">Gerenciar Talhões</Link>
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Esta ação é irreversível e excluirá o registro da fazenda permanentemente.
            </p>
          )}

          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel disabled={isDeleting} className="cursor-pointer">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting || isCheckingRelations || linkedFields.length > 0}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer font-semibold gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeleting && <Loader2 className="size-3.5 animate-spin" />}
              {linkedFields.length > 0 ? "Exclusão Bloqueada" : "Excluir Definitivamente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
