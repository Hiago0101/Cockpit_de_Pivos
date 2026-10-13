import { createFileRoute } from "@tanstack/react-router";
import { EmptyPage } from "@/components/empty-page";

export const Route = createFileRoute("/operacoes")({
  head: () => ({ meta: [
    { title: "Operações — Cockpit de Pivôs" },
    { name: "description", content: "Área de acompanhamento das operações agrícolas." },
    { property: "og:title", content: "Operações — Cockpit de Pivôs" },
    { property: "og:description", content: "Área de acompanhamento das operações agrícolas." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <EmptyPage title="Operações" />,
});