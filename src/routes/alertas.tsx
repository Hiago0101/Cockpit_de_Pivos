import { createFileRoute } from "@tanstack/react-router";
import { EmptyPage } from "@/components/empty-page";

export const Route = createFileRoute("/alertas")({
  head: () => ({ meta: [
    { title: "Alertas — Cockpit de Pivôs" },
    { name: "description", content: "Área de alertas e riscos da operação agrícola." },
    { property: "og:title", content: "Alertas — Cockpit de Pivôs" },
    { property: "og:description", content: "Área de alertas e riscos da operação agrícola." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <EmptyPage title="Alertas" />,
});