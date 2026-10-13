import { createFileRoute } from "@tanstack/react-router";
import { PlanningIndicators } from "@/components/planejamento/PlanningIndicators";

export const Route = createFileRoute("/indicadores")({
  head: () => ({
    meta: [
      { title: "Indicadores Agrícolas — Cockpit de Pivôs" },
      { name: "description", content: "Indicadores analíticos de planejamento de safras e produtividade dos pivôs." },
      { property: "og:title", content: "Indicadores Agrícolas — Cockpit de Pivôs" },
      { property: "og:description", content: "Indicadores analíticos de planejamento de safras e produtividade dos pivôs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <PlanningIndicators />
    </div>
  ),
});