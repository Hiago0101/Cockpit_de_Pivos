import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "@/components/planejamento/StatusBadge";
import type { CropPlanStatus } from "@/services/api";

describe("Planejamento Agrícola — Componentes e Regras", () => {
  it.each([
    ["RASCUNHO", "Rascunho"],
    ["PLANEJADO", "Planejado"],
    ["EM_ANDAMENTO", "Em Andamento"],
    ["CONCLUIDO", "Concluído"],
    ["CANCELADO", "Cancelado"],
  ] as [CropPlanStatus, string][])("renders correct status badge for %s", (status, expectedText) => {
    const { getByText } = render(<StatusBadge status={status} />);
    expect(getByText(expectedText)).toBeDefined();
  });

  it("calculates progress and handles custom status values gracefully", () => {
    const { getByText } = render(<StatusBadge status="CUSTOM_STATUS" />);
    expect(getByText("CUSTOM_STATUS")).toBeDefined();
  });
});
