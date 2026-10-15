import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Calendar,
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
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import { api, type Season, type Farm, type SeasonStatus } from "@/services/api";
import { usePermissions } from "@/hooks/usePermissions";

export const Route = createFileRoute("/safras")({
  head: () => ({
    meta: [
      { title: "Cadastro de Safras — Cockpit de Pivôs" },
      { name: "description", content: "Cadastro, edição e controle de safras e ciclos agrícolas para o planejamento de plantio." },
      { property: "og:title", content: "Cadastro de Safras — Cockpit de Pivôs" },
      { property: "og:description", content: "Cadastro, edição e controle de safras e ciclos agrícolas para o planejamento de plantio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SafrasPage,
});

function SafrasPage() {
  const { canAccess, canViewFull, canCreate, canEdit, canDelete } = usePermissions();
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFarmFilter, setSelectedFarmFilter] = useState<string>("ALL");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("ALL");

  // Modal de Criação / Edição
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSeason, setEditingSeason] = useState<Season | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Campos do formulário
  const [formNome, setFormNome] = useState("");
  const [formDataInicio, setFormDataInicio] = useState("");
  const [formDataFim, setFormDataFim] = useState("");
  const [formStatus, setFormStatus] = useState<SeasonStatus>("EM_ANDAMENTO");
  const [formFazendaId, setFormFazendaId] = useState("");
  const [formObservacoes, setFormObservacoes] = useState("");

  // Modal de Exclusão
  const [seasonToDelete, setSeasonToDelete] = useState<Season | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Copiado ID feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [seasonsData, farmsData] = await Promise.all([
        api.getSeasons(),
        api.getFarms(),
      ]);
      setSeasons(seasonsData);
      setFarms(farmsData);
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível carregar as safras.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCreate = () => {
    setEditingSeason(null);
    setFormNome("");
    setFormDataInicio("");
    setFormDataFim("");
    setFormStatus("EM_ANDAMENTO");
    setFormFazendaId(selectedFarmFilter !== "ALL" ? selectedFarmFilter : "");
    setFormObservacoes("");
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (season: Season) => {
    setEditingSeason(season);
    setFormNome(season.nome);
    setFormDataInicio(season.data_inicio || "");
    setFormDataFim(season.data_fim || "");
    setFormStatus(season.status);
    setFormFazendaId(season.fazenda || "");
    setFormObservacoes(season.observacoes || "");
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleSaveSeason = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    const cleanNome = formNome.trim();
    if (!cleanNome) {
      setModalError("O nome da safra é obrigatório (ex: Safra 2024/2025 - Verão).");
      return;
    }

    if (!formDataInicio || !formDataFim) {
      setModalError("Preencha as datas de início e término do ciclo da safra.");
      return;
    }

    if (formDataFim < formDataInicio) {
      setModalError("A data de término não pode ser anterior à data de início.");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: Partial<Season> = {
        nome: cleanNome,
        data_inicio: formDataInicio,
        data_fim: formDataFim,
        status: formStatus,
        fazenda: formFazendaId ? formFazendaId : null,
        observacoes: formObservacoes,
        ativa: formStatus === "EM_ANDAMENTO" || formStatus === "PLANEJADA",
      };

      if (editingSeason) {
        await api.updateSeason(editingSeason.id, payload);
        toast.success(`Safra "${cleanNome}" atualizada com sucesso!`);
      } else {
        await api.createSeason(payload);
        toast.success(`Safra "${cleanNome}" cadastrada com sucesso!`);
      }

      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      setModalError(err?.message || "Erro ao salvar safra no servidor.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!seasonToDelete) return;
    const target = seasonToDelete;
    setIsDeleting(true);

    try {
      await api.deleteSeason(target.id);
      setSeasonToDelete(null);
      toast.success(`Safra "${target.nome}" excluída com sucesso!`);
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || `Não foi possível excluir a safra "${target.nome}". Verifique se há planejamentos vinculados.`);
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

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr + "T00:00:00").toLocaleDateString("pt-BR");
    } catch {
      return dateStr;
    }
  };

  const calculateDays = (start?: string, end?: string) => {
    if (!start || !end) return null;
    const d1 = new Date(start + "T00:00:00");
    const d2 = new Date(end + "T00:00:00");
    const diff = Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : null;
  };

  const getStatusBadge = (status: SeasonStatus) => {
    switch (status) {
      case "EM_ANDAMENTO":
        return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">Em Andamento</Badge>;
      case "PLANEJADA":
        return <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30">Planejada</Badge>;
      case "CONCLUIDA":
        return <Badge className="bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30">Concluída</Badge>;
      case "CANCELADA":
        return <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30">Cancelada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Filtragem
  const filteredSeasons = seasons.filter((s) => {
    if (selectedFarmFilter !== "ALL" && s.fazenda !== selectedFarmFilter) {
      return false;
    }
    if (selectedStatusFilter !== "ALL" && s.status !== selectedStatusFilter) {
      return false;
    }
    const term = searchTerm.toLowerCase();
    const matchesNome = s.nome?.toLowerCase().includes(term);
    const matchesId = s.id?.toLowerCase().includes(term);
    const matchesFazenda = s.fazenda_nome?.toLowerCase().includes(term);
    return matchesNome || matchesId || matchesFazenda;
  });

  return (
    <div className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8 w-full max-w-[1600px] mx-auto">
      {/* Cabeçalho Padronizado */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-xl bg-primary/10 border border-primary/20 text-primary shadow-xs">
            <Calendar className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Cadastro de Safras
              </h1>
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground border border-border/40">
                {seasons.length}
              </span>
            </div>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
              Cadastre e acompanhe os ciclos e anos agrícolas para o planejamento de plantio.
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
            title="Atualizar lista de safras"
          >
            <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Atualizar</span>
          </Button>

          {canCreate("safras") && (
            <Button
              size="sm"
              onClick={handleOpenCreate}
              className="h-9 gap-1.5 text-xs font-semibold cursor-pointer shadow-xs bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Plus className="size-4" />
              Nova Safra
            </Button>
          )}
        </div>
      </div>

      {/* Linha de Busca e Filtros FORA do Card Branco (Padrão Consistente) */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between pt-1">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Pesquisar por nome da safra, código ou ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-xs bg-background"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Filtro por Fazenda */}
          <select
            value={selectedFarmFilter}
            onChange={(e) => setSelectedFarmFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
          >
            <option value="ALL">Todas as Fazendas</option>
            {farms.map((farm) => (
              <option key={farm.id} value={farm.id}>
                {farm.nome} {farm.filial ? `(${farm.filial})` : ""}
              </option>
            ))}
          </select>

          {/* Filtro por Status */}
          <select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
          >
            <option value="ALL">Todos os Status</option>
            <option value="EM_ANDAMENTO">Em Andamento</option>
            <option value="PLANEJADA">Planejada</option>
            <option value="CONCLUIDA">Concluída</option>
            <option value="CANCELADA">Cancelada</option>
          </select>
        </div>
      </div>

      {/* Tabela de Safras */}
      <Card className="shadow-xs border-border/80">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Loader2 className="size-8 animate-spin text-primary mb-2" />
              <p className="text-sm font-medium text-muted-foreground">Carregando safras...</p>
            </div>
          ) : filteredSeasons.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <Calendar className="size-10 text-muted-foreground/40 mb-3" />
              <h3 className="text-base font-semibold text-foreground">Nenhuma safra encontrada</h3>
              <p className="text-xs text-muted-foreground max-w-sm mt-1 mb-4">
                {searchTerm || selectedFarmFilter !== "ALL" || selectedStatusFilter !== "ALL"
                  ? "Nenhum resultado corresponde aos filtros aplicados. Tente ajustar os termos."
                  : "Nenhuma safra agrícola cadastrada. Cadastre a primeira safra para habilitar o planejamento."}
              </p>
              {canCreate("safras") && (
                <Button size="sm" onClick={handleOpenCreate} className="gap-1.5 text-xs font-semibold cursor-pointer">
                  <Plus className="size-3.5" />
                  Cadastrar Primeira Safra
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 border-b border-border/60 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider select-none">
                  <tr>
                    <th className="px-6 py-3.5">ID (Sistema)</th>
                    <th className="px-6 py-3.5">Nome da Safra</th>
                    <th className="px-6 py-3.5">Período (Início → Fim)</th>
                    <th className="px-6 py-3.5">Duração</th>
                    <th className="px-6 py-3.5">Fazenda Vinculada</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredSeasons.map((season) => {
                    const farmObj = farms.find((f) => f.id === season.fazenda);
                    const farmNome = season.fazenda_nome || farmObj?.nome || "Todas as Fazendas";
                    const days = calculateDays(season.data_inicio, season.data_fim);

                    return (
                      <tr key={season.id} className="hover:bg-muted/30 transition-colors">
                        {/* Coluna ID */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                            <span className="truncate max-w-[150px] sm:max-w-[200px]" title={season.id}>
                              {season.id}
                            </span>
                            <button
                              onClick={() => handleCopyId(season.id)}
                              className="p-1 rounded hover:bg-muted text-muted-foreground/70 hover:text-foreground transition-colors cursor-pointer"
                              title="Copiar ID completo"
                            >
                              {copiedId === season.id ? (
                                <Check className="size-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="size-3.5" />
                              )}
                            </button>
                          </div>
                        </td>

                        {/* Coluna Nome da Safra */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Calendar className="size-3.5 text-primary shrink-0" />
                            <span className="font-semibold text-foreground text-sm">
                              {season.nome}
                            </span>
                          </div>
                        </td>

                        {/* Coluna Período */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Clock className="size-3 shrink-0" />
                            <span className="font-medium text-foreground">
                              {formatDate(season.data_inicio)}
                            </span>
                            <span>→</span>
                            <span className="font-medium text-foreground">
                              {formatDate(season.data_fim)}
                            </span>
                          </div>
                        </td>

                        {/* Coluna Duração */}
                        <td className="px-6 py-4">
                          <span className="text-muted-foreground font-mono">
                            {days ? `${days} dias` : "—"}
                          </span>
                        </td>

                        {/* Coluna Fazenda Vinculada */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Building2 className="size-3.5 text-muted-foreground shrink-0" />
                            <span className="text-foreground text-xs font-medium">
                              {farmNome}
                            </span>
                          </div>
                        </td>

                        {/* Coluna Status */}
                        <td className="px-6 py-4">
                          {getStatusBadge(season.status)}
                        </td>

                        {/* Coluna Ações */}
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {canEdit("safras") && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenEdit(season)}
                                className="h-8 px-2.5 text-xs cursor-pointer hover:bg-muted"
                                title="Editar Safra"
                              >
                                <Edit2 className="size-3.5 mr-1" />
                                Editar
                              </Button>
                            )}

                            {canDelete("safras") && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSeasonToDelete(season)}
                                className="h-8 px-2.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                                title="Excluir Safra"
                              >
                                <Trash2 className="size-3.5 mr-1" />
                                Excluir
                              </Button>
                            )}
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

      {/* Modal de Criação / Edição */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Calendar className="size-4 text-primary" />
              {editingSeason ? "Editar Safra" : "Nova Safra Agrícola"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {editingSeason
                ? "Atualize as informações e datas do ciclo desta safra."
                : "Cadastre um novo ano ou ciclo agrícola para associar aos planos de plantio."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveSeason} className="space-y-4 pt-2">
            {modalError && (
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <span className="leading-tight">{modalError}</span>
              </div>
            )}

            {/* Nome da Safra */}
            <div className="space-y-1.5">
              <Label htmlFor="nome" className="text-xs font-semibold">
                Nome da Safra *
              </Label>
              <Input
                id="nome"
                placeholder="Ex: Safra 2024/2025 - Verão, Safrinha 2025"
                value={formNome}
                onChange={(e) => setFormNome(e.target.value)}
                required
              />
              <p className="text-[11px] text-muted-foreground">
                Denominação oficial do ano agrícola ou ciclo de cultivo.
              </p>
            </div>

            {/* Fazenda Vinculada */}
            <div className="space-y-1.5">
              <Label htmlFor="fazenda" className="text-xs font-semibold">
                Fazenda Vinculada (Opcional)
              </Label>
              <select
                id="fazenda"
                value={formFazendaId}
                onChange={(e) => setFormFazendaId(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
              >
                <option value="">Todas as Fazendas (Geral Corporativo)</option>
                {farms.map((farm) => (
                  <option key={farm.id} value={farm.id}>
                    {farm.nome} {farm.filial ? `(Filial: ${farm.filial})` : ""}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground">
                Deixe em branco se a safra se aplicar a todas as propriedades da empresa.
              </p>
            </div>

            {/* Datas de Início e Término */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="data_inicio" className="text-xs font-semibold">
                  Data de Início *
                </Label>
                <Input
                  id="data_inicio"
                  type="date"
                  value={formDataInicio}
                  onChange={(e) => setFormDataInicio(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="data_fim" className="text-xs font-semibold">
                  Data de Término *
                </Label>
                <Input
                  id="data_fim"
                  type="date"
                  value={formDataFim}
                  onChange={(e) => setFormDataFim(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <Label htmlFor="status" className="text-xs font-semibold">
                Status Operacional *
              </Label>
              <select
                id="status"
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value as SeasonStatus)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
              >
                <option value="EM_ANDAMENTO">Em Andamento</option>
                <option value="PLANEJADA">Planejada</option>
                <option value="CONCLUIDA">Concluída</option>
                <option value="CANCELADA">Cancelada</option>
              </select>
            </div>

            {/* Observações */}
            <div className="space-y-1.5">
              <Label htmlFor="observacoes" className="text-xs font-semibold">
                Observações
              </Label>
              <Textarea
                id="observacoes"
                placeholder="Detalhes adicionais sobre o ciclo agrícola..."
                value={formObservacoes}
                onChange={(e) => setFormObservacoes(e.target.value)}
                rows={2}
                className="resize-none text-xs"
              />
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
                ) : editingSeason ? (
                  "Salvar Alterações"
                ) : (
                  "Cadastrar Safra"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação de Exclusão */}
      <AlertDialog open={Boolean(seasonToDelete)} onOpenChange={(open) => !open && setSeasonToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base text-destructive flex items-center gap-2">
              <AlertCircle className="size-4" />
              Excluir Safra
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Tem certeza de que deseja excluir a safra{" "}
              <strong className="text-foreground">"{seasonToDelete?.nome}"</strong>?
              Esta ação removerá o registro se não houver planejamentos vinculados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel disabled={isDeleting} className="cursor-pointer">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer"
            >
              {isDeleting ? "Excluindo..." : "Confirmar Exclusão"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
