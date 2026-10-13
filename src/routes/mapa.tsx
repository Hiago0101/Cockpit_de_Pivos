import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  MapPin,
  RefreshCw,
  Droplets,
  Play,
  Square,
  Layers,
  Info,
  Maximize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api, type Pivot } from "@/services/api";

export const Route = createFileRoute("/mapa")({
  head: () => ({
    meta: [
      { title: "Mapa dos Pivôs — Cockpit de Pivôs" },
      { name: "description", content: "Visualização georreferenciada e telemetria espacial dos pivôs centrais de irrigação." },
      { property: "og:title", content: "Mapa dos Pivôs — Cockpit de Pivôs" },
      { property: "og:description", content: "Visualização georreferenciada e telemetria espacial dos pivôs centrais de irrigação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MapaPage,
});

function MapaPage() {
  const [pivots, setPivots] = useState<Pivot[]>([]);
  const [selectedPivot, setSelectedPivot] = useState<Pivot | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const loadPivots = async () => {
    setLoading(true);
    try {
      const data = await api.getPivots();
      setPivots(data);
      if (data.length > 0 && data[0] && !selectedPivot) {
        setSelectedPivot(data[0]);
      }
    } catch {
      // Erro tratado pela camada de serviço
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPivots();
  }, []);

  const handleToggleStatus = async (pivot: Pivot) => {
    setActionLoading(true);
    const newStatus = pivot.status_operacional === "IRRIGANDO" ? "PARADO" : "IRRIGANDO";
    try {
      const updated = await api.quickCommand(pivot.id, {
        status_operacional: newStatus,
        percentimetro_atual: pivot.percentimetro_atual,
        sentido_rotacao: pivot.sentido_rotacao,
      });
      setSelectedPivot(updated);
      await loadPivots();
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const getPivotColor = (status: string) => {
    switch (status) {
      case "IRRIGANDO":
      case "FERTIRRIGANDO":
        return "#1b7d52"; // Verde agrícola
      case "FALHA":
        return "#dc2626"; // Vermelho
      case "MANUTENCAO":
        return "#d97706"; // Âmbar
      default:
        return "#64748b"; // Cinza
    }
  };

  return (
    <section className="flex min-h-[calc(100svh-4rem)] flex-col px-5 py-7 sm:px-8 sm:py-9 lg:px-10">
      <div className="mx-auto w-full max-w-[1600px] space-y-6">
        {/* Cabeçalho */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Monitoramento Espacial</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Mapa dos Pivôs Centrais</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Visualização vetorial esquemática dos pivôs e ângulos de giro. Coordenadas salvas em WGS84 (camada de ortofoto GIS externa desacoplada).
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={loadPivots} disabled={loading} className="gap-2">
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Nota técnica sobre a representação esquemática */}
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0 text-primary" />
          <p className="leading-relaxed">
            <strong>Nota de Engenharia:</strong> Esta interface utiliza renderização vetorial autônoma (SVG) que opera em redes isoladas sem depender de serviços externos de mapas. A projeção cartográfica geodésica contínua (MapLibre / PostGIS) será conectada na fase de dados geográficos avançados.
          </p>
        </div>

        {/* Layout Principal: Mapa Interativo + Inspetor Lateral */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          {/* Canvas do Mapa Agrícola On-Premises */}
          <Card className="overflow-hidden border-border bg-slate-950 text-slate-100 shadow-lg">
            <CardHeader className="border-b border-slate-800 bg-slate-900/60 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="size-4 text-emerald-400" />
                  <span className="text-sm font-semibold text-slate-200">Planta Operacional da Fazenda</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-400">
                  <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-emerald-500" /> Irrigando</span>
                  <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-slate-400" /> Parado</span>
                  <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-rose-500" /> Falha</span>
                </div>
              </div>
            </CardHeader>

            <CardContent className="relative flex min-h-[520px] items-center justify-center p-6">
              {/* Grade de Coordenadas de Fundo */}
              <div
                className="absolute inset-0 opacity-10"
                style={{
                  backgroundImage: "radial-gradient(#10b981 1px, transparent 1px)",
                  backgroundSize: "28px 28px",
                }}
              />

              {/* Renderização Vetorial dos Pivôs Centrais */}
              <div className="relative grid size-full max-w-2xl grid-cols-2 gap-8 p-4">
                {pivots.map((p, idx) => {
                  const color = getPivotColor(p.status_operacional);
                  const isSelected = selectedPivot?.id === p.id;
                  const angleRad = ((Number(p.angulo_atual_graus) - 90) * Math.PI) / 180;
                  const armX = 60 + 48 * Math.cos(angleRad);
                  const armY = 60 + 48 * Math.sin(angleRad);

                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedPivot(p)}
                      className={`group relative flex cursor-pointer flex-col items-center justify-center rounded-xl border p-6 transition-all ${
                        isSelected
                          ? "border-emerald-500 bg-emerald-950/20 shadow-lg shadow-emerald-950/50"
                          : "border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/80"
                      }`}
                    >
                      {/* SVG do Círculo do Pivô Central */}
                      <div className="relative size-32">
                        <svg viewBox="0 0 120 120" className="size-full">
                          {/* Área irrigada (círculo externo) */}
                          <circle
                            cx="60"
                            cy="60"
                            r="50"
                            fill={color}
                            fillOpacity={p.status_operacional === "IRRIGANDO" ? 0.25 : 0.08}
                            stroke={color}
                            strokeWidth="2.5"
                            strokeDasharray={p.status_operacional === "PARADO" ? "4 3" : "none"}
                          />

                          {/* Torre central (Ponto pivô) */}
                          <circle cx="60" cy="60" r="5" fill="#f8fafc" stroke={color} strokeWidth="2" />

                          {/* Lança / Braço do Pivô no ângulo atual */}
                          <line
                            x1="60"
                            y1="60"
                            x2={armX}
                            y2={armY}
                            stroke="#ffffff"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                          />

                          {/* Última torre móvel no final do lance */}
                          <circle cx={armX} cy={armY} r="3.5" fill="#38bdf8" />
                        </svg>

                        {/* Pulso animado para pivô irrigando */}
                        {p.status_operacional === "IRRIGANDO" && (
                          <span
                            className="absolute inset-0 animate-ping rounded-full opacity-20"
                            style={{ backgroundColor: color }}
                          />
                        )}
                      </div>

                      <div className="mt-3 text-center">
                        <span className="font-mono text-sm font-bold text-slate-100">{p.codigo}</span>
                        <p className="text-xs text-slate-400">{p.nome}</p>
                        <Badge
                          variant="outline"
                          className="mt-2 text-[10px]"
                          style={{ borderColor: color, color }}
                        >
                          {p.status_display || p.status_operacional} · {p.angulo_atual_graus}°
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Painel Inspetor do Pivô Selecionado */}
          <div className="space-y-4">
            {selectedPivot ? (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-primary">{selectedPivot.codigo}</span>
                    <Badge variant={selectedPivot.status_operacional === "IRRIGANDO" ? "default" : "outline"}>
                      {selectedPivot.status_display || selectedPivot.status_operacional}
                    </Badge>
                  </div>
                  <CardTitle className="mt-1 text-lg font-bold">{selectedPivot.nome}</CardTitle>
                  <CardDescription className="text-xs">
                    {selectedPivot.fazenda_nome || "Fazenda Principal"}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4 text-xs">
                  <div className="space-y-2 rounded-lg bg-muted/50 p-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Velocidade (Percentímetro):</span>
                      <span className="font-bold text-foreground">{selectedPivot.percentimetro_atual}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Lâmina Aplicada:</span>
                      <span className="font-bold text-chart-2">{selectedPivot.lamina_atual_mm} mm</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Ângulo Atual de Giro:</span>
                      <span className="font-bold text-foreground">{selectedPivot.angulo_atual_graus}°</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Sentido de Rotação:</span>
                      <span className="font-bold text-foreground">{selectedPivot.sentido_display || selectedPivot.sentido_rotacao}</span>
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-border pt-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Raio da Estrutura:</span>
                      <span className="font-medium text-foreground">{selectedPivot.raio_metros} m</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Área Irrigada:</span>
                      <span className="font-medium text-foreground">{selectedPivot.area_irrigada_ha} ha</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Vazão Nominal:</span>
                      <span className="font-medium text-foreground">{selectedPivot.vazao_nominal_m3h} m³/h</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Pressão de Projeto:</span>
                      <span className="font-medium text-foreground">{selectedPivot.pressao_nominal_bar} bar</span>
                    </div>
                  </div>

                  <div className="border-t border-border pt-4">
                    <Button
                      className="w-full gap-2"
                      variant={selectedPivot.status_operacional === "IRRIGANDO" ? "destructive" : "default"}
                      onClick={() => handleToggleStatus(selectedPivot)}
                      disabled={actionLoading}
                    >
                      {actionLoading ? (
                        <RefreshCw className="size-4 animate-spin" />
                      ) : selectedPivot.status_operacional === "IRRIGANDO" ? (
                        <>
                          <Square className="size-4" />
                          Parar Pivô Central
                        </>
                      ) : (
                        <>
                          <Play className="size-4" />
                          Ligar Pivô Central
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="flex min-h-[300px] flex-col items-center justify-center p-6 text-center text-muted-foreground">
                  <Info className="mb-2 size-8" />
                  <p className="text-sm font-semibold">Nenhum pivô selecionado</p>
                  <p className="mt-1 text-xs">Clique em qualquer círculo no mapa para inspecionar parâmetros.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}