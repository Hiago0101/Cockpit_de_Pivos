import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Droplets, Plus, Play, Square, RefreshCw, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  api,
  type Pivot,
  type Farm,
  type IrrigationRecord,
} from "@/services/api";

export const Route = createFileRoute("/irrigacao")({
  head: () => ({
    meta: [
      { title: "Irrigação — Cockpit de Pivôs" },
      { name: "description", content: "Cadastro de pivôs, apontamentos de lâmina e histórico operacional de irrigação." },
      { property: "og:title", content: "Irrigação — Cockpit de Pivôs" },
      { property: "og:description", content: "Cadastro de pivôs, apontamentos de lâmina e histórico operacional de irrigação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: IrrigacaoPage,
});

function IrrigacaoPage() {
  const [pivots, setPivots] = useState<Pivot[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [irrigations, setIrrigations] = useState<IrrigationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados dos formulários
  const [isPivotModalOpen, setIsPivotModalOpen] = useState(false);
  const [isIrrigationModalOpen, setIsIrrigationModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form novo pivô
  const [novoCodigo, setNovoCodigo] = useState("");
  const [novoNome, setNovoNome] = useState("");
  const [novaFazenda, setNovaFazenda] = useState("");
  const [novoRaio, setNovoRaio] = useState("450");
  const [novaArea, setNovaArea] = useState("63.6");
  const [novaVazao, setNovaVazao] = useState("280");
  const [novaPressao, setNovaPressao] = useState("3.5");

  // Form novo registro
  const [regPivo, setRegPivo] = useState("");
  const [regPercentimetro, setRegPercentimetro] = useState("80");
  const [regLamina, setRegLamina] = useState("7.5");
  const [regSentido, setRegSentido] = useState("HORARIO");
  const [regObs, setRegObs] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const [pData, fData, iData] = await Promise.all([
        api.getPivots().catch(() => []),
        api.getFarms().catch(() => []),
        api.getIrrigations().catch(() => []),
      ]);
      setPivots(pData);
      setFarms(fData);
      setIrrigations(iData);
      if (fData.length > 0 && fData[0] && !novaFazenda) setNovaFazenda(fData[0].id);
      if (pData.length > 0 && pData[0] && !regPivo) setRegPivo(pData[0].id);
    } catch {
      // Erro tratado pela camada de serviço
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreatePivot = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.createPivot({
        fazenda: novaFazenda,
        codigo: novoCodigo.trim(),
        nome: novoNome.trim(),
        raio_metros: parseFloat(novoRaio) || 400,
        area_irrigada_ha: parseFloat(novaArea) || 50,
        vazao_nominal_m3h: parseFloat(novaVazao) || 200,
        pressao_nominal_bar: parseFloat(novaPressao) || 3.5,
        percentimetro_atual: 100,
        status_operacional: "PARADO",
      });
      setIsPivotModalOpen(false);
      setNovoCodigo("");
      setNovoNome("");
      await loadData();
    } catch (err: any) {
      alert(`Erro ao cadastrar pivô: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateIrrigation = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.createIrrigation({
        pivo: regPivo,
        percentimetro: parseInt(regPercentimetro, 10) || 80,
        lamina_aplicada_mm: parseFloat(regLamina) || 5.0,
        sentido: regSentido,
        observacoes: regObs.trim(),
        inicio_em: new Date().toISOString(),
      });
      setIsIrrigationModalOpen(false);
      setRegObs("");
      await loadData();
    } catch (err: any) {
      alert(`Erro ao registrar irrigação: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="flex min-h-[calc(100svh-4rem)] flex-col px-5 py-7 sm:px-8 sm:py-9 lg:px-10">
      <div className="mx-auto w-full max-w-[1600px] space-y-8">
        {/* Cabeçalho */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Operação & Lâmina de Água</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Gestão de Irrigação</h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" size="sm" onClick={loadData} disabled={loading} className="gap-2">
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>

            {/* Modal Novo Pivô */}
            <Dialog open={isPivotModalOpen} onOpenChange={setIsPivotModalOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Plus className="size-4" />
                  Novo Pivô Central
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <form onSubmit={handleCreatePivot}>
                  <DialogHeader>
                    <DialogTitle>Cadastrar Novo Pivô Central</DialogTitle>
                    <DialogDescription>
                      Insira as especificações técnicas e vincule à fazenda corporativa.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 py-4 text-sm">
                    <div>
                      <Label htmlFor="fazenda">Fazenda</Label>
                      <select
                        id="fazenda"
                        className="mt-1.5 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                        value={novaFazenda}
                        onChange={(e) => setNovaFazenda(e.target.value)}
                        required
                      >
                        {farms.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.nome} ({f.municipio}/{f.uf})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="codigo">Código</Label>
                        <Input
                          id="codigo"
                          placeholder="Ex: PIV-05"
                          value={novoCodigo}
                          onChange={(e) => setNovoCodigo(e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="nome">Nome Descritivo</Label>
                        <Input
                          id="nome"
                          placeholder="Ex: Pivô Cristalina Leste"
                          value={novoNome}
                          onChange={(e) => setNovoNome(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="raio">Raio (metros)</Label>
                        <Input
                          id="raio"
                          type="number"
                          step="0.1"
                          value={novoRaio}
                          onChange={(e) => setNovoRaio(e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="area">Área Irrigada (ha)</Label>
                        <Input
                          id="area"
                          type="number"
                          step="0.1"
                          value={novaArea}
                          onChange={(e) => setNovaArea(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="vazao">Vazão Nominal (m³/h)</Label>
                        <Input
                          id="vazao"
                          type="number"
                          step="0.1"
                          value={novaVazao}
                          onChange={(e) => setNovaVazao(e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="pressao">Pressão de Projeto (bar)</Label>
                        <Input
                          id="pressao"
                          type="number"
                          step="0.1"
                          value={novaPressao}
                          onChange={(e) => setNovaPressao(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsPivotModalOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={submitting}>
                      {submitting ? "Cadastrando..." : "Salvar Pivô"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            {/* Modal Novo Registro de Irrigação */}
            <Dialog open={isIrrigationModalOpen} onOpenChange={setIsIrrigationModalOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Droplets className="size-4" />
                  Apontar Irrigação
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <form onSubmit={handleCreateIrrigation}>
                  <DialogHeader>
                    <DialogTitle>Registrar Evento de Irrigação</DialogTitle>
                    <DialogDescription>
                      Apontamento operacional de lâmina e giro do pivô central.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 py-4 text-sm">
                    <div>
                      <Label htmlFor="pivo-sel">Pivô Central</Label>
                      <select
                        id="pivo-sel"
                        className="mt-1.5 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                        value={regPivo}
                        onChange={(e) => setRegPivo(e.target.value)}
                        required
                      >
                        {pivots.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.codigo} — {p.nome}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="reg-percent">Percentímetro (%)</Label>
                        <Input
                          id="reg-percent"
                          type="number"
                          min="1"
                          max="100"
                          value={regPercentimetro}
                          onChange={(e) => setRegPercentimetro(e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="reg-lamina">Lâmina Aplicada (mm)</Label>
                        <Input
                          id="reg-lamina"
                          type="number"
                          step="0.1"
                          value={regLamina}
                          onChange={(e) => setRegLamina(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="reg-sentido">Sentido de Rotação</Label>
                      <select
                        id="reg-sentido"
                        className="mt-1.5 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                        value={regSentido}
                        onChange={(e) => setRegSentido(e.target.value)}
                      >
                        <option value="HORARIO">Sentido Horário</option>
                        <option value="ANTI_HORARIO">Sentido Anti-Horário</option>
                      </select>
                    </div>

                    <div>
                      <Label htmlFor="reg-obs">Observações</Label>
                      <Input
                        id="reg-obs"
                        placeholder="Ex: Turno noturno, pressão verificada na base."
                        value={regObs}
                        onChange={(e) => setRegObs(e.target.value)}
                      />
                    </div>
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsIrrigationModalOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={submitting}>
                      {submitting ? "Gravando..." : "Registrar Irrigação"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Tabela de Pivôs e Parâmetros */}
        <Card>
          <CardHeader>
            <CardTitle>Pivôs Centrais Cadastrados</CardTitle>
            <CardDescription>
              Lista de equipamentos ativos e parâmetros hidráulicos integrados com o SQL Server.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="pb-3 font-semibold">Código</th>
                    <th className="pb-3 font-semibold">Nome</th>
                    <th className="pb-3 font-semibold">Fazenda</th>
                    <th className="pb-3 font-semibold">Status</th>
                    <th className="pb-3 font-semibold text-right">Velocidade</th>
                    <th className="pb-3 font-semibold text-right">Lâmina (mm)</th>
                    <th className="pb-3 font-semibold text-right">Área (ha)</th>
                    <th className="pb-3 font-semibold text-right">Vazão (m³/h)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pivots.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/30">
                      <td className="py-3 font-mono font-bold text-primary">{p.codigo}</td>
                      <td className="py-3 font-medium text-foreground">{p.nome}</td>
                      <td className="py-3 text-muted-foreground">{p.fazenda_nome || "Fazenda Principal"}</td>
                      <td className="py-3">
                        <Badge variant={p.status_operacional === "IRRIGANDO" ? "default" : "outline"}>
                          {p.status_display || p.status_operacional}
                        </Badge>
                      </td>
                      <td className="py-3 text-right font-medium">{p.percentimetro_atual}%</td>
                      <td className="py-3 text-right font-medium text-chart-2">{p.lamina_atual_mm} mm</td>
                      <td className="py-3 text-right text-muted-foreground">{p.area_irrigada_ha}</td>
                      <td className="py-3 text-right text-muted-foreground">{p.vazao_nominal_m3h}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Histórico Recente de Irrigações */}
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Eventos de Irrigação</CardTitle>
            <CardDescription>
              Registros gerados pela aplicação web e sincronizados a partir do aplicativo móvel de campo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {irrigations.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-6">
                Nenhum registro de irrigação apontado até o momento.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground">
                      <th className="pb-3 font-semibold">Pivô</th>
                      <th className="pb-3 font-semibold">Início</th>
                      <th className="pb-3 font-semibold">Lâmina Aplicada</th>
                      <th className="pb-3 font-semibold">Percentímetro</th>
                      <th className="pb-3 font-semibold">Origem</th>
                      <th className="pb-3 font-semibold">Observações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {irrigations.map((item) => (
                      <tr key={item.id} className="hover:bg-muted/30">
                        <td className="py-3 font-mono font-bold text-primary">{item.pivo_codigo}</td>
                        <td className="py-3 text-muted-foreground">
                          {new Date(item.inicio_em).toLocaleString("pt-BR")}
                        </td>
                        <td className="py-3 font-semibold text-chart-2">{item.lamina_aplicada_mm} mm</td>
                        <td className="py-3 text-muted-foreground">{item.percentimetro}%</td>
                        <td className="py-3">
                          <Badge variant="outline" className="text-[11px]">
                            {item.origem}
                          </Badge>
                        </td>
                        <td className="py-3 text-muted-foreground truncate max-w-xs">{item.observacoes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}