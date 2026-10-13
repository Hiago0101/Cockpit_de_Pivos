import React, { useState, useEffect } from "react";
import {
  api,
  type Farm,
  type Field,
  type Company,
  type Pivot,
} from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Building2,
  MapPin,
  Layers,
  CircleDot,
  Plus,
  RefreshCw,
  AlertCircle,
} from "lucide-react";

export function AgriculturalStructureView() {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [pivots, setPivots] = useState<Pivot[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal para novo Talhão
  const [fieldModalOpen, setFieldModalOpen] = useState(false);
  const [fieldFormData, setFieldFormData] = useState({
    fazenda: "",
    codigo: "",
    nome: "",
    area_ha: "",
  });
  const [fieldSubmitting, setFieldSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  // Modal para nova Empresa
  const [companyModalOpen, setCompanyModalOpen] = useState(false);
  const [companyFormData, setCompanyFormData] = useState({
    nome: "",
    cnpj: "",
  });
  const [companySubmitting, setCompanySubmitting] = useState(false);
  const [companyError, setCompanyError] = useState<string | null>(null);

  const loadStructure = async () => {
    setLoading(true);
    try {
      const [fData, tData, cData, pData] = await Promise.all([
        api.getFarms(),
        api.getFields(),
        api.getCompanies().catch(() => []),
        api.getPivots().catch(() => []),
      ]);
      setFarms(fData);
      setFields(tData);
      setCompanies(cData);
      setPivots(pData);
    } catch {
      // tratado
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStructure();
  }, []);

  const handleSaveField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fieldFormData.fazenda || !fieldFormData.codigo || !fieldFormData.area_ha) {
      setFieldError("Preencha todos os campos obrigatórios (*).");
      return;
    }
    if (Number(fieldFormData.area_ha) <= 0) {
      setFieldError("A área do talhão deve ser maior que zero hectares.");
      return;
    }

    setFieldSubmitting(true);
    setFieldError(null);

    try {
      await api.createField({
        fazenda: fieldFormData.fazenda,
        codigo: fieldFormData.codigo.trim().toUpperCase(),
        nome: fieldFormData.nome.trim() || `Talhão ${fieldFormData.codigo.trim().toUpperCase()}`,
        area_ha: Number(fieldFormData.area_ha),
      });
      setFieldModalOpen(false);
      loadStructure();
    } catch (err: any) {
      setFieldError(err.message || "Erro ao cadastrar talhão.");
    } finally {
      setFieldSubmitting(false);
    }
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyFormData.nome.trim()) {
      setCompanyError("O nome da empresa ou organização é obrigatório.");
      return;
    }

    setCompanySubmitting(true);
    setCompanyError(null);

    try {
      await api.createCompany({
        nome: companyFormData.nome.trim(),
        cnpj: companyFormData.cnpj.trim(),
        ativo: true,
      });
      setCompanyModalOpen(false);
      loadStructure();
    } catch (err: any) {
      setCompanyError(err.message || "Erro ao cadastrar empresa.");
    } finally {
      setCompanySubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
            <Layers className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">
              Estrutura Agrícola & Áreas Produtivas
            </h3>
            <p className="text-xs text-muted-foreground">
              Hierarquia operacional: Organizações · Fazendas · Talhões · Pivôs Centrais
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setCompanyFormData({ nome: "", cnpj: "" });
              setCompanyError(null);
              setCompanyModalOpen(true);
            }}
            className="h-8 gap-1.5 text-xs"
          >
            <Building2 className="size-3.5" />
            Nova Empresa
          </Button>

          <Button
            size="sm"
            onClick={() => {
              setFieldFormData({ fazenda: farms[0]?.id || "", codigo: "", nome: "", area_ha: "" });
              setFieldError(null);
              setFieldModalOpen(true);
            }}
            className="h-8 gap-1.5 text-xs"
          >
            <Plus className="size-3.5" />
            Novo Talhão
          </Button>
        </div>
      </div>

      {/* Grid de Fazendas e seus Talhões / Pivôs */}
      {loading ? (
        <div className="py-16 text-center text-xs text-muted-foreground">
          Carregando estrutura agrícola...
        </div>
      ) : farms.length === 0 ? (
        <div className="py-16 text-center text-xs text-muted-foreground">
          Nenhuma fazenda cadastrada no sistema.
        </div>
      ) : (
        <div className="space-y-4">
          {farms.map((farm) => {
            const farmFields = fields.filter((f) => f.fazenda === farm.id);
            const farmPivots = pivots.filter((p) => p.fazenda === farm.id);
            const totalFieldArea = farmFields.reduce((sum, f) => sum + Number(f.area_ha || 0), 0);

            return (
              <div
                key={farm.id}
                className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3"
              >
                {/* Linha da Fazenda */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary font-bold text-xs">
                      {farm.codigo.slice(0, 3)}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                        {farm.nome}
                        <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0">
                          {farm.codigo}
                        </Badge>
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        {farm.municipio}/{farm.uf}
                        {farm.empresa_nome && ` · ${farm.empresa_nome}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    <div>
                      <span className="text-muted-foreground text-[11px] block">Área Total Cadastrada:</span>
                      <span className="font-bold text-foreground">
                        {Number(farm.area_total_ha).toLocaleString("pt-BR", { minimumFractionDigits: 1 })} ha
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[11px] block">Pivôs Operacionais:</span>
                      <span className="font-bold text-primary">{farmPivots.length} pivôs</span>
                    </div>
                  </div>
                </div>

                {/* Talhões da Fazenda */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                    <span className="uppercase tracking-wider text-[11px]">
                      Talhões Mapeados ({farmFields.length} · {totalFieldArea.toFixed(1)} ha)
                    </span>
                  </div>

                  {farmFields.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2 italic">
                      Nenhum talhão cadastrado nesta fazenda.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {farmFields.map((field) => (
                        <div
                          key={field.id}
                          className="rounded-lg border border-border bg-muted/20 p-2.5 text-xs flex items-center justify-between"
                        >
                          <div>
                            <span className="font-bold text-foreground">{field.codigo}</span>
                            <span className="text-muted-foreground ml-1">· {field.nome}</span>
                          </div>
                          <span className="font-semibold text-foreground text-xs">
                            {field.area_ha} ha
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Pivôs da Fazenda */}
                {farmPivots.length > 0 && (
                  <div className="pt-2 border-t border-border/40">
                    <span className="uppercase tracking-wider text-[11px] font-semibold text-muted-foreground block mb-2">
                      Pivôs Centrais Vinculados ({farmPivots.length})
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {farmPivots.map((p) => (
                        <div
                          key={p.id}
                          className="rounded-md border border-border bg-card px-2.5 py-1 text-xs flex items-center gap-1.5 shadow-sm"
                        >
                          <CircleDot className="size-3 text-primary" />
                          <span className="font-bold text-foreground">{p.codigo}</span>
                          <span className="text-[11px] text-muted-foreground">({p.area_irrigada_ha} ha)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal para Novo Talhão */}
      <Dialog open={fieldModalOpen} onOpenChange={setFieldModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-foreground">
              Cadastrar Novo Talhão
            </DialogTitle>
            <DialogDescription className="text-xs">
              Adicione uma área produtiva delimitada para planejamento de safras.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveField} className="space-y-3 py-1">
            {fieldError && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-2 text-xs text-destructive">
                {fieldError}
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="t-fazenda" className="text-xs font-semibold">
                Fazenda *
              </Label>
              <select
                id="t-fazenda"
                className="flex h-8 w-full rounded-md border border-input bg-background px-3 text-xs shadow-sm"
                value={fieldFormData.fazenda}
                onChange={(e) => setFieldFormData({ ...fieldFormData, fazenda: e.target.value })}
                required
              >
                <option value="">Selecione...</option>
                {farms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome} ({f.codigo})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="t-codigo" className="text-xs font-semibold">
                  Código *
                </Label>
                <Input
                  id="t-codigo"
                  placeholder="TAL-04"
                  value={fieldFormData.codigo}
                  onChange={(e) => setFieldFormData({ ...fieldFormData, codigo: e.target.value })}
                  className="h-8 text-xs uppercase"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="t-area" className="text-xs font-semibold">
                  Área (ha) *
                </Label>
                <Input
                  id="t-area"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="95.00"
                  value={fieldFormData.area_ha}
                  onChange={(e) => setFieldFormData({ ...fieldFormData, area_ha: e.target.value })}
                  className="h-8 text-xs"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="t-nome" className="text-xs font-semibold">
                Nome Descritivo
              </Label>
              <Input
                id="t-nome"
                placeholder="Ex: Talhão Sede Norte"
                value={fieldFormData.nome}
                onChange={(e) => setFieldFormData({ ...fieldFormData, nome: e.target.value })}
                className="h-8 text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button variant="outline" size="sm" type="button" onClick={() => setFieldModalOpen(false)}>
                Cancelar
              </Button>
              <Button size="sm" type="submit" disabled={fieldSubmitting}>
                {fieldSubmitting ? "Gravando..." : "Salvar Talhão"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal para Nova Empresa */}
      <Dialog open={companyModalOpen} onOpenChange={setCompanyModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-foreground">
              Nova Organização / Empresa
            </DialogTitle>
            <DialogDescription className="text-xs">
              Cadastre uma pessoa jurídica controladora das unidades agrícolas.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveCompany} className="space-y-3 py-1">
            {companyError && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-2 text-xs text-destructive">
                {companyError}
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="c-nome" className="text-xs font-semibold">
                Nome / Razão Social *
              </Label>
              <Input
                id="c-nome"
                placeholder="Ex: Agrícola Vale Verde S.A."
                value={companyFormData.nome}
                onChange={(e) => setCompanyFormData({ ...companyFormData, nome: e.target.value })}
                className="h-8 text-xs"
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="c-cnpj" className="text-xs font-semibold">
                CNPJ (Opcional)
              </Label>
              <Input
                id="c-cnpj"
                placeholder="00.000.000/0001-00"
                value={companyFormData.cnpj}
                onChange={(e) => setCompanyFormData({ ...companyFormData, cnpj: e.target.value })}
                className="h-8 text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button variant="outline" size="sm" type="button" onClick={() => setCompanyModalOpen(false)}>
                Cancelar
              </Button>
              <Button size="sm" type="submit" disabled={companySubmitting}>
                {companySubmitting ? "Gravando..." : "Salvar Empresa"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
