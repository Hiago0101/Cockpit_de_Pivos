import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PlanListView } from "@/components/planejamento/PlanListView";
import { PlanningCalendar } from "@/components/planejamento/PlanningCalendar";
import { PlanningIndicators } from "@/components/planejamento/PlanningIndicators";
import { CropCatalogView } from "@/components/planejamento/CropCatalogView";
import { SeasonManagementView } from "@/components/planejamento/SeasonManagementView";
import { AgriculturalStructureView } from "@/components/planejamento/AgriculturalStructureView";
import { CalendarDays, BarChart3, Sprout, Calendar, Layers, Clock } from "lucide-react";

export const Route = createFileRoute("/planejamento")({
  head: () => ({
    meta: [
      { title: "Planejamento Agrícola — Cockpit de Pivôs" },
      { name: "description", content: "Módulo de planejamento integrado de safras, culturas e ocupação dos pivôs." },
      { property: "og:title", content: "Planejamento Agrícola — Cockpit de Pivôs" },
      { property: "og:description", content: "Módulo de planejamento integrado de safras, culturas e ocupação dos pivôs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlanejamentoPage,
});

type TabType = "planos" | "calendario" | "indicadores" | "culturas" | "safras" | "estrutura";

function PlanejamentoPage() {
  const [activeTab, setActiveTab] = useState<TabType>("planos");

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Top Banner do Módulo */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary uppercase tracking-wider">
                Módulo 4.1
              </span>
              <span className="text-xs text-muted-foreground">· Gestão Agronômica</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Planejamento Agrícola de Safras
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Organize a estrutura agrícola, planeje ciclos de cultivo por talhão e pivô central,
              acompanhe o cronograma de plantio e colheita e monitore indicadores de ocupação em hectares.
            </p>
          </div>

          {/* Abas de Navegação Principal */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-muted/40 p-1.5 shrink-0">
            <button
              onClick={() => setActiveTab("planos")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                activeTab === "planos"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <CalendarDays className="size-3.5" />
              Planos de Cultivo
            </button>

            <button
              onClick={() => setActiveTab("calendario")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                activeTab === "calendario"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Clock className="size-3.5" />
              Cronograma
            </button>

            <button
              onClick={() => setActiveTab("indicadores")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                activeTab === "indicadores"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <BarChart3 className="size-3.5" />
              Indicadores
            </button>

            <button
              onClick={() => setActiveTab("safras")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                activeTab === "safras"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Calendar className="size-3.5" />
              Safras
            </button>

            <button
              onClick={() => setActiveTab("culturas")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                activeTab === "culturas"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Sprout className="size-3.5" />
              Culturas
            </button>

            <button
              onClick={() => setActiveTab("estrutura")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                activeTab === "estrutura"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Layers className="size-3.5" />
              Estrutura
            </button>
          </div>
        </div>
      </div>

      {/* Conteúdo Dinâmico da Aba Selecionada */}
      {activeTab === "planos" && <PlanListView />}
      {activeTab === "calendario" && <PlanningCalendar />}
      {activeTab === "indicadores" && <PlanningIndicators />}
      {activeTab === "culturas" && <CropCatalogView />}
      {activeTab === "safras" && <SeasonManagementView />}
      {activeTab === "estrutura" && <AgriculturalStructureView />}
    </div>
  );
}