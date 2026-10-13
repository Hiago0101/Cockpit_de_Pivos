import { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CircleGauge,
  Droplets,
  AlertTriangle,
  Play,
  Square,
  RefreshCw,
  MapPin,
  TrendingUp,
  Layers,
  ChevronRight,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api, type Pivot, type CockpitSummary, type AlertItem } from "@/services/api";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cockpit — Cockpit de Pivôs" },
      { name: "description", content: "Visão consolidada do planejamento agrícola, telemetria e operação irrigada de pivôs centrais." },
      { property: "og:title", content: "Cockpit — Cockpit de Pivôs" },
      { property: "og:description", content: "Visão consolidada do planejamento agrícola, telemetria e operação irrigada de pivôs centrais." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CockpitPage,
});

function CockpitPage() {
  const [summary, setSummary] = useState<CockpitSummary | null>(null);
  const [pivots, setPivots] = useState<Pivot[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadDashboardData = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const [sumData, pivosData, alertsData] = await Promise.all([
        api.getCockpitSummary().catch(() => null),
        api.getPivots().catch(() => []),
        api.getAlerts().catch(() => []),
      ]);

      if (sumData) setSummary(sumData);
      setPivots(pivosData);
      setAlerts(alertsData);
    } catch (err: any) {
      setErrorMessage(err.message || "Erro ao carregar dados operacionais da API.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleTogglePivotStatus = async (pivot: Pivot) => {
    const newStatus = pivot.status_operacional === "IRRIGANDO" ? "PARADO" : "IRRIGANDO";
    setActionLoading(pivot.id);
    try {
      await api.quickCommand(pivot.id, {
        status_operacional: newStatus,
        percentimetro_atual: pivot.percentimetro_atual || 80,
        sentido_rotacao: pivot.sentido_rotacao || "HORARIO",
      });
      await loadDashboardData();
    } catch (err: any) {
      alert(`Falha ao alterar estado do pivô: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "IRRIGANDO":
      case "FERTIRRIGANDO":
        return "default";
      case "FALHA":
        return "destructive";
      case "MANUTENCAO":
        return "secondary";
      default:
        return "outline";
    }
  };

  return (
    <section className="flex min-h-[calc(100svh-4rem)] flex-col px-5 py-7 sm:px-8 sm:py-9 lg:px-10">
      <div className="mx-auto w-full max-w-[1600px] space-y-8">
        {/* Cabeçalho da Visão Geral */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Gestão Integrada</span>
              <span className="inline-block size-1.5 rounded-full bg-primary" />
              <span className="text-xs text-muted-foreground">Tempo Real On-Premises</span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Cockpit Operacional</h1>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={loadDashboardData}
              disabled={loading}
              className="gap-2"
            >
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button asChild size="sm" className="gap-2">
              <Link to="/irrigacao">
                <Plus className="size-4" />
                Cadastrar / Irrigação
              </Link>
            </Button>
          </div>
        </div>

        {/* Alerta de Modo de Simulação / Ausência de Controlador Físico */}
        <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3.5 text-xs text-foreground/90">
          <CircleGauge className="mt-0.5 size-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-primary">Ambiente de Gestão Operacional — Modo Apontamento / Simulação</p>
            <p className="mt-0.5 text-muted-foreground leading-relaxed">
              Os comandos e acionamentos alteram o <strong>estado registrado</strong> no banco de dados corporativo.
              Não há envio direto de sinais de comando para controladores físicos (CLP/telemetria de campo), aguardando documentação e homologação dos protocolos dos fabricantes.
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            <div>
              <p className="font-semibold">Acesso Protegido / Comunicação:</p>
              <p className="mt-1 text-xs">{errorMessage}</p>
            </div>
            <Button asChild size="sm" variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10">
              <Link to="/login">Fazer Login</Link>
            </Button>
          </div>
        )}

        {/* Indicadores Principais */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pivôs em Operação</CardTitle>
              <Droplets className="size-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {summary?.indicadores.irrigando_count ?? pivots.filter(p => p.status_operacional === "IRRIGANDO").length}
                <span className="text-sm font-normal text-muted-foreground">
                  {" "}/ {summary?.indicadores.total_pivos ?? pivots.length} pivôs
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Taxa operacional: {summary?.indicadores.taxa_operacao_pct ?? 0}% das áreas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Área Irrigada</CardTitle>
              <Layers className="size-5 text-chart-2" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {summary?.indicadores.area_total_ha ?? pivots.reduce((acc, p) => acc + Number(p.area_irrigada_ha), 0).toFixed(1)} ha
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Total sob cobertura de pivôs centrais</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Alertas Ativos</CardTitle>
              <AlertTriangle className="size-5 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {summary?.indicadores.alertas_criticos ?? alerts.filter(a => a.severidade === "CRITICO").length}
                <span className="text-sm font-normal text-muted-foreground"> críticos</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {summary?.indicadores.alertas_atencao ?? alerts.filter(a => a.severidade === "ATENCAO").length} avisos de atenção operacional
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Janelas de Tarifa</CardTitle>
              <TrendingUp className="size-5 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">
                {summary?.indicadores.janelas_ativas ?? 1} ativas hoje
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Oportunidade de redução em kWh</p>
            </CardContent>
          </Card>
        </div>

        {/* Grade de Pivôs Centrais */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Status dos Pivôs Centrais</h2>
            <Button asChild variant="ghost" size="sm" className="gap-1 text-xs">
              <Link to="/mapa">Ver no Mapa Georreferenciado <ChevronRight className="size-3.5" /></Link>
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {pivots.map((pivot) => (
              <Card key={pivot.id} className="transition-all hover:shadow-md">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-primary">{pivot.codigo}</span>
                        <Badge variant={getStatusBadgeVariant(pivot.status_operacional)}>
                          {pivot.status_display || pivot.status_operacional}
                        </Badge>
                      </div>
                      <CardTitle className="mt-1 text-base font-semibold">{pivot.nome}</CardTitle>
                      <CardDescription className="flex items-center gap-1 text-xs">
                        <MapPin className="size-3" />
                        {pivot.fazenda_nome || "Fazenda Principal"}
                      </CardDescription>
                    </div>

                    <Button
                      size="icon"
                      variant={pivot.status_operacional === "IRRIGANDO" ? "destructive" : "default"}
                      disabled={actionLoading === pivot.id}
                      onClick={() => handleTogglePivotStatus(pivot)}
                      title={pivot.status_operacional === "IRRIGANDO" ? "Parar Pivô" : "Ligar Pivô"}
                      className="size-8 rounded-full"
                    >
                      {actionLoading === pivot.id ? (
                        <RefreshCw className="size-4 animate-spin" />
                      ) : pivot.status_operacional === "IRRIGANDO" ? (
                        <Square className="size-3.5" />
                      ) : (
                        <Play className="size-3.5" />
                      )}
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 pt-0 text-xs">
                  <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/50 p-2.5 text-center">
                    <div>
                      <span className="text-muted-foreground">Velocidade</span>
                      <p className="font-semibold text-foreground">{pivot.percentimetro_atual}%</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Lâmina</span>
                      <p className="font-semibold text-foreground">{pivot.lamina_atual_mm} mm</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Ângulo</span>
                      <p className="font-semibold text-foreground">{pivot.angulo_atual_graus}°</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Área: {pivot.area_irrigada_ha} ha · Vazão: {pivot.vazao_nominal_m3h} m³/h</span>
                    <span>Sentido: {pivot.sentido_display || pivot.sentido_rotacao}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Seção de Alertas e Atenção Operacional */}
        {alerts.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Alertas que Exigem Atenção</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {alerts.slice(0, 4).map((alert) => (
                <div
                  key={alert.id}
                  className={`flex items-start gap-3 rounded-lg border p-3.5 ${
                    alert.severidade === "CRITICO"
                      ? "border-destructive/30 bg-destructive/5 text-destructive"
                      : "border-warning/30 bg-warning/5 text-warning-foreground"
                  }`}
                >
                  <AlertTriangle className="mt-0.5 size-5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold uppercase tracking-wider">{alert.pivo_codigo} — {alert.titulo}</p>
                      <Badge variant={alert.severidade === "CRITICO" ? "destructive" : "outline"} className="text-[10px]">
                        {alert.severidade}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-foreground/80">{alert.mensagem}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
