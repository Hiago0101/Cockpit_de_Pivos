import { createFileRoute } from "@tanstack/react-router";
import { PlanningCalendar } from "@/components/planejamento/PlanningCalendar";

export const Route = createFileRoute("/calendario")({
  head: () => ({
    meta: [
      { title: "Calendário Operacional — Cockpit de Pivôs" },
      { name: "description", content: "Cronograma temporal integrado de plantio e colheita dos pivôs e safras." },
      { property: "og:title", content: "Calendário Operacional — Cockpit de Pivôs" },
      { property: "og:description", content: "Cronograma temporal integrado de plantio e colheita dos pivôs e safras." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <PlanningCalendar />
    </div>
  ),
});