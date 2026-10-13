import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  OpportunityStatusBadge,
  OpportunityPriorityBadge,
  OpportunityTypeBadge,
  OpportunityOriginBadge,
} from "@/components/oportunidades/OpportunityBadges";
import { OpportunityDiscardModal } from "@/components/oportunidades/OpportunityDiscardModal";
import { OpportunityResolveModal } from "@/components/oportunidades/OpportunityResolveModal";
import { OpportunityDetailModal } from "@/components/oportunidades/OpportunityDetailModal";
import { api, type Opportunity } from "@/services/api";

const mockOpportunity: Opportunity = {
  id: "opp-123",
  titulo: "Janela Noturna Reduzida Pivô 01",
  descricao: "Tarifa com desconto de 60% entre 21h30 e 06h00.",
  tipo: "TARIFA_NOTURNA",
  prioridade: "ALTA",
  status: "DETECTADA",
  origem: "REGRA_INTERNA",
  inicio_janela: "2026-10-15T21:30:00Z",
  fim_janela: "2026-10-16T06:00:00Z",
  empresa: "emp-1",
  empresa_nome: "Agro S/A",
  fazenda: "faz-1",
  fazenda_nome: "Fazenda Santa Maria",
  pivo: "pivo-1",
  pivo_nome: "Pivô Central 01",
  justificativa: "Enquadramento tarifário verificado",
  is_vencida: false,
};

describe("Módulo Janelas de Oportunidade — Badges e Componentes", () => {
  it("renders status badges with appropriate labels", () => {
    const { rerender } = render(<OpportunityStatusBadge status="DETECTADA" />);
    expect(screen.getByText("Detectada")).toBeDefined();

    rerender(<OpportunityStatusBadge status="RECONHECIDA" />);
    expect(screen.getByText("Reconhecida")).toBeDefined();

    rerender(<OpportunityStatusBadge status="RESOLVIDA" />);
    expect(screen.getByText("Resolvida")).toBeDefined();

    rerender(<OpportunityStatusBadge status="DESCARTADA" />);
    expect(screen.getByText("Descartada")).toBeDefined();
  });

  it("renders priority badges correctly", () => {
    const { rerender } = render(<OpportunityPriorityBadge priority="CRITICA" />);
    expect(screen.getByText("Crítica")).toBeDefined();

    rerender(<OpportunityPriorityBadge priority="ALTA" />);
    expect(screen.getByText("Alta")).toBeDefined();

    rerender(<OpportunityPriorityBadge priority="MEDIA" />);
    expect(screen.getByText("Média")).toBeDefined();

    rerender(<OpportunityPriorityBadge priority="BAIXA" />);
    expect(screen.getByText("Baixa")).toBeDefined();
  });

  it("renders type and origin badges correctly", () => {
    render(
      <div>
        <OpportunityTypeBadge type="TARIFA_NOTURNA" />
        <OpportunityOriginBadge origin="REGRA_INTERNA" />
      </div>
    );
    expect(screen.getByText("Tarifa Noturna")).toBeDefined();
    expect(screen.getByText("Regra Automática")).toBeDefined();
  });

  it("OpportunityDetailModal shows opportunity details and tabs", () => {
    const onClose = vi.fn();
    render(
      <OpportunityDetailModal
        opportunity={mockOpportunity}
        isOpen={true}
        onClose={onClose}
      />
    );

    expect(screen.getByText("Janela Noturna Reduzida Pivô 01")).toBeDefined();
    expect(screen.getByText("Detalhes & Período")).toBeDefined();
    expect(screen.getByText("Vínculos Agrícolas")).toBeDefined();
    expect(screen.getByText("Trilha de Auditoria")).toBeDefined();
  });

  it("OpportunityDiscardModal requires justification reason", async () => {
    const onClose = vi.fn();
    const onSuccess = vi.fn();
    const discardSpy = vi.spyOn(api, "discardOpportunity").mockResolvedValue({
      ...mockOpportunity,
      status: "DESCARTADA",
      motivo_descarte: "Manutenção na rede elétrica",
    });

    render(
      <OpportunityDiscardModal
        opportunity={mockOpportunity}
        isOpen={true}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    );

    expect(screen.getByText("Descartar Oportunidade")).toBeDefined();
    const submitBtn = screen.getByText("Confirmar Descarte");
    expect(submitBtn).toBeDefined();

    const textarea = screen.getByPlaceholderText(/Ex: Condições operacionais/i);
    fireEvent.change(textarea, { target: { value: "Manutenção na rede elétrica" } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(discardSpy).toHaveBeenCalledWith("opp-123", "Manutenção na rede elétrica");
      expect(onSuccess).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("OpportunityResolveModal submits resolution with optional notes", async () => {
    const onClose = vi.fn();
    const onSuccess = vi.fn();
    const resolveSpy = vi.spyOn(api, "resolveOpportunity").mockResolvedValue({
      ...mockOpportunity,
      status: "RESOLVIDA",
      justificativa: "Executado com êxito",
    });

    render(
      <OpportunityResolveModal
        opportunity={mockOpportunity}
        isOpen={true}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    );

    expect(screen.getByText("Concluir / Resolver Oportunidade")).toBeDefined();
    const textarea = screen.getByPlaceholderText(/Ex: Irrigação noturna executada/i);
    fireEvent.change(textarea, { target: { value: "Executado com êxito" } });

    const confirmBtn = screen.getByText("Confirmar Resolução");
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(resolveSpy).toHaveBeenCalledWith("opp-123", "Executado com êxito");
      expect(onSuccess).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });
});
