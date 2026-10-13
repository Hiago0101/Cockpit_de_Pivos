export type PivotStatus = "PARADO" | "IRRIGANDO" | "FERTIRRIGANDO" | "MANUTENCAO" | "FALHA";
export type PivotDirection = "HORARIO" | "ANTI_HORARIO" | "ESTACIONARIO";

export interface MobilePivot {
  id: string;
  fazenda_nome: string;
  codigo: string;
  nome: string;
  fabricante: string;
  modelo: string;
  raio_metros: number;
  area_irrigada_ha: number;
  vazao_nominal_m3h: number;
  pressao_nominal_bar: number;
  status_operacional: PivotStatus;
  status_display: string;
  angulo_atual_graus: number;
  sentido_rotacao: PivotDirection;
  percentimetro_atual: number;
  lamina_atual_mm: number;
  pressao_atual_bar: number;
  tensao_eletrica_v: number;
  ultima_comunicacao: string;
  updated_at: string;
}

export interface MobileFarm {
  id: string;
  nome: string;
  codigo?: string;
  filial?: string;
  id_pims?: string;
  municipio?: string;
  uf?: string;
  area_total_ha?: number;
  ativo?: boolean;
}

export interface MobileCrop {
  id: string;
  descricao: string;
  fazenda?: string | null;
  fazenda_nome?: string;
  fazenda_filial?: string;
  id_pims?: string;
}

export interface MobileSeason {
  id: string;
  nome: string;
  data_inicio: string;
  data_fim: string;
  status: "PLANEJAMENTO" | "EM_ANDAMENTO" | "ENCERRADA";
  ativa: boolean;
  fazenda?: string | null;
  fazenda_nome?: string;
}

export interface MobileField {
  id: string;
  fazenda: string;
  fazenda_nome?: string;
  fazenda_filial?: string;
  codigo: string;
  nome?: string;
  descricao?: string;
  id_pims?: string;
  area_ha?: number;
  ativo?: boolean;
}

export type CropPlanStatus = "RASCUNHO" | "PLANEJADO" | "EM_ANDAMENTO" | "CONCLUIDO" | "CANCELADO";

export interface MobileCropPlan {
  id: string;
  safra: string;
  safra_nome: string;
  cultura: string;
  cultura_nome: string;
  fazenda: string;
  fazenda_nome: string;
  talhao?: string | null;
  talhao_nome?: string;
  pivo?: string | null;
  pivo_nome?: string;
  pivo_codigo?: string;
  alvo_nome: string;
  data_plantio: string;
  data_colheita_prevista: string;
  data_plantio_real?: string | null;
  data_colheita_real?: string | null;
  area_planejada_ha: number;
  status: CropPlanStatus;
  status_display: string;
  permite_sobreposicao?: boolean;
  justificativa_sobreposicao?: string;
  observacoes?: string;
  atualizado_em?: string;
}

export type SyncOperationStatus = "PENDING" | "FAILED" | "CONFLICT" | "REJECTED" | "DISCARDED";

export interface PendingSyncItem {
  id: string;
  client_op_id: string;
  entity: "pivo" | "registro_irrigacao" | "alerta" | "plano";
  action: "CREATE" | "UPDATE" | "UPDATE_STATUS" | "ACKNOWLEDGE";
  payload: string; // JSON string
  created_at: string;
  status: SyncOperationStatus;
  error_message?: string;
  server_entity_id?: string;
  server_state_info?: string;
  last_attempt_at?: string;
  resolved_at?: string;
  resolution?: "DISCARDED" | "PULLED_FROM_SERVER";
}

export type OpportunityStatus = "DETECTADA" | "RECONHECIDA" | "RESOLVIDA" | "DESCARTADA";
export type OpportunityPriority = "BAIXA" | "MEDIA" | "ALTA" | "CRITICA";
export type OpportunityType =
  | "TARIFA_NOTURNA"
  | "JANELA_PLANTIO"
  | "JANELA_COLHEITA"
  | "MANUTENCAO_PREVENTIVA"
  | "APORTE_HIDRICO"
  | "TRATAMENTO_FITOSSANITARIO"
  | "OUTRO";

export interface MobileOpportunity {
  id: string;
  titulo: string;
  descricao: string;
  tipo: OpportunityType;
  tipo_display?: string;
  prioridade: OpportunityPriority;
  status: OpportunityStatus;
  origem: string;
  origem_display?: string;
  inicio_janela: string;
  fim_janela: string;
  is_vencida?: boolean;
  aproveitada?: boolean;
  fazenda_id?: string;
  fazenda_nome?: string;
  talhao_id?: string | null;
  talhao_nome?: string;
  pivo_id?: string | null;
  pivo_codigo?: string;
  pivo_nome?: string;
  cultura_id?: string | null;
  cultura_nome?: string;
  safra_id?: string | null;
  safra_nome?: string;
  plano_id?: string | null;
  plano_titulo?: string;
  justificativa?: string | null;
  motivo_descarte?: string | null;
  atualizado_em?: string;
}
