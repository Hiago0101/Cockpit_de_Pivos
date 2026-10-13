import { createFileRoute, Link } from "@tanstack/react-router";
import { CircleGauge, Building2, Sprout, ArrowRight, Layers, BarChart3, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PivotPlanningGantt } from "@/components/planejamento/PivotPlanningGantt";

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
  return (
    <div className="flex-1 space-y-4 p-2 sm:p-4 lg:p-6 w-full">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">Gestão Integrada</span>
            <span className="inline-block size-1.5 rounded-full bg-primary" />
            <span className="text-xs text-muted-foreground">Cockpit de Pivôs</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Cockpit Operacional
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Acompanhe o cronograma dinâmico de plantio dos pivôs, sequenciamento de culturas e disponibilidade hídrica.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="default" size="sm" className="gap-1.5 text-xs font-semibold shadow-sm">
            <Link to="/planejamento">
              <CalendarDays className="size-3.5" />
              Módulo Planejamento (Cadastros)
              <ArrowRight className="size-3 ml-1" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Componente Dinâmico de Gantt no Cockpit: "Planejamento dos Pivôs" em tela cheia */}
      <div className="w-full">
        <PivotPlanningGantt showNewPlanButton={false} />
      </div>
    </div>
  );
}
