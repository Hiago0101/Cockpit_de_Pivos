import { createFileRoute } from "@tanstack/react-router";
import { CropCatalogView } from "@/components/planejamento/CropCatalogView";

export const Route = createFileRoute("/culturas")({
  head: () => ({
    meta: [
      { title: "Culturas Agrícolas — Cockpit de Pivôs" },
      { name: "description", content: "Catálogo e gestão das culturas agrícolas e parâmetros agronômicos." },
      { property: "og:title", content: "Culturas Agrícolas — Cockpit de Pivôs" },
      { property: "og:description", content: "Catálogo e gestão das culturas agrícolas e parâmetros agronômicos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <CropCatalogView />
    </div>
  ),
});