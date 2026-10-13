import React, { useState, useEffect } from "react";
import {
  api,
  type Season,
  type Farm,
  type Company,
  type SeasonStatus,
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
  Calendar,
  Plus,
  Search,
  RefreshCw,
  Edit,
  AlertCircle,
  Building2,
  MapPin,
} from "lucide-react";

export function SeasonManagementView() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [seasonToEdit, setSeasonToEdit] = useState<Season | null>(null);
  const [formData, setFormData] = useState({
    nome: "",
    data_inicio: "",
    data_fim: "",
    status: "EM_ANDAMENTO" as SeasonStatus,
    ativa: true,
    fazenda: "",
    empresa: "",
    observacoes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSeasons = async () => {
    setLoading(true);
    try {
      const [sData, fData, cData] = await Promise.all([
        api.getSeasons({ search: search || undefined }),
        api.getFarms().catch(() => []),
        api.getCompanies().catch(() => []),
      ]);
      setSeasons(sData);
      setFarms(fData);
      setCompanies(cData);
    } catch {
      setSeasons([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSeasons();
  }, [search]);

  const handleOpenCreate = () => {
    setSeasonToEdit(null);
    setFormData({
      nome: "",
      data_inicio: "",
      data_fim: "",
      status: "EM_ANDAMENTO",
      ativa: true,
      fazenda: "",
      empresa: companies[0]?.id || "",
      observacoes: "",
    });
    setError(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (season: Season) => {
    setSeasonToEdit(season);
    setFormData({
      nome: season.nome,
      data_inicio: season.data_inicio,
      data_fim: season.data_fim,
      status: season.status,
      ativa: season.ativa,
      fazenda: season.fazenda || "",
      empresa: season.empresa || "",
      observacoes: season.observacoes || "",
    });
    setError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome.trim() || !formData.data_inicio || !formData.data_fim) {
      setError("Preencha todos os campos obrigatórios (*).");
      return;
    }

    if (formData.data_fim < formData.data_inicio) {
      setError("A data de término prevista não pode anteceder a data de início.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const payload: Partial<Season> = {
      nome: formData.nome.trim(),
      data_inicio: formData.data_inicio,
      data_fim: formData.data_fim,
      status: formData.status,
      ativa: formData.ativa,
      fazenda: formData.fazenda || null,
      empresa: formData.empresa || null,
      observacoes: formData.observacoes.trim(),
    };

    try {
      if (seasonToEdit) {
        await api.updateSeason(seasonToEdit.id, payload);
      } else {
        await api.createSeason(payload);
      }
      setModalOpen(false);
      loadSeasons();
    } catch (err: any) {
      setError(err.message || "Erro ao salvar safra.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
            <Calendar className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">
              Gestão de Safras e Ciclos Agrícolas
            </h3>
            <p className="text-xs text-muted-foreground">
              Períodos globais de safra e safrinha vinculados às unidades operacionais
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar safra por nome..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 text-xs w-[220px]"
            />
          </div>

          <Button size="sm" onClick={handleOpenCreate} className="h-8 gap-1.5 text-xs">
            <Plus className="size-3.5" />
            Nova Safra
          </Button>
        </div>
      </div>

      {/* Grid de Cards de Safras */}
      {loading ? (
        <div className="py-16 text-center text-xs text-muted-foreground">
          Carregando catálogo de safras...
        </div>
      ) : seasons.length === 0 ? (
        <div className="rounded-xl border border-border bg-card py-16 text-center text-xs text-muted-foreground space-y-2">
          <p className="font-semibold text-foreground">Nenhuma safra encontrada.</p>
          <Button size="sm" variant="outline" onClick={handleOpenCreate} className="gap-1.5 text-xs">
            <Plus className="size-3.5" />
            Cadastrar Primeira Safra
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {seasons.map((s) => (
            <div
              key={s.id}
              className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3 hover:border-primary/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-foreground">{s.nome}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {s.data_inicio} até {s.data_fim}
                  </p>
                </div>

                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 ${
                    s.status === "EM_ANDAMENTO"
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : s.status === "PLANEJADA"
                      ? "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300"
                      : "border-slate-500/30 bg-slate-500/10 text-slate-500"
                  }`}
                >
                  {s.status === "EM_ANDAMENTO"
                    ? "Em Andamento"
                    : s.status === "PLANEJADA"
                    ? "Planejada"
                    : s.status === "CONCLUIDA"
                    ? "Concluída"
                    : s.status}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/40 p-2 text-xs">
                <div>
                  <span className="text-[10px] text-muted-foreground block">Planos Ativos:</span>
                  <span className="font-semibold text-foreground">{s.planos_count || 0} planos</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">Área Total:</span>
                  <span className="font-semibold text-foreground">
                    {Number(s.area_total_planejada_ha || 0).toLocaleString("pt-BR", { minimumFractionDigits: 1 })} ha
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                <span>{s.fazenda_nome || s.empresa_nome || "Organização Geral"}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleOpenEdit(s)}
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

      {/* Modal de Criação / Edição de Safra */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground text-base">
              <Calendar className="size-4 text-primary" />
              {seasonToEdit ? "Editar Safra" : "Nova Safra Agrícola"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Defina o ciclo agrícola de produção e as datas de início e encerramento previsto.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-3.5 py-2">
            {error && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive">
                <AlertCircle className="size-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="safra-nome" className="text-xs font-semibold">
                Nome da Safra *
              </Label>
              <Input
                id="safra-nome"
                placeholder="Ex: Safra 2024/2025 - Verão, Safrinha 2025"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                className="h-8 text-xs"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="safra-inicio" className="text-xs font-semibold">
                  Data de Início *
                </Label>
                <Input
                  id="safra-inicio"
                  type="date"
                  value={formData.data_inicio}
                  onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
                  className="h-8 text-xs"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="safra-fim" className="text-xs font-semibold">
                  Término Previsto *
                </Label>
                <Input
                  id="safra-fim"
                  type="date"
                  value={formData.data_fim}
                  onChange={(e) => setFormData({ ...formData, data_fim: e.target.value })}
                  className="h-8 text-xs"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="safra-status" className="text-xs font-semibold">
                  Situação
                </Label>
                <select
                  id="safra-status"
                  className="flex h-8 w-full rounded-md border border-input bg-background px-3 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as SeasonStatus })}
                >
                  <option value="PLANEJADA">Planejada</option>
                  <option value="EM_ANDAMENTO">Em Andamento</option>
                  <option value="CONCLUIDA">Concluída</option>
                  <option value="CANCELADA">Cancelada</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="safra-fazenda" className="text-xs font-semibold">
                  Fazenda Vinculada
                </Label>
                <select
                  id="safra-fazenda"
                  className="flex h-8 w-full rounded-md border border-input bg-background px-3 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={formData.fazenda}
                  onChange={(e) => setFormData({ ...formData, fazenda: e.target.value })}
                >
                  <option value="">Todas as Fazendas (Geral)</option>
                  {farms.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="safra-obs" className="text-xs font-semibold">
                Observações
              </Label>
              <Textarea
                id="safra-obs"
                placeholder="Metas de produtividade e direcionamentos operacionais..."
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                rows={2}
                className="text-xs resize-none"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button variant="outline" size="sm" type="button" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button size="sm" type="submit" disabled={submitting}>
                {submitting ? "Gravando..." : "Salvar Safra"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
