import React from "react";
import { Badge } from "@/components/ui/badge";
import {
  type OpportunityStatus,
  type OpportunityPriority,
  type OpportunityType,
  type OpportunityOrigin,
} from "@/services/api";
import {
  AlertTriangle,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  CheckCircle2,
  CheckCircle,
  XCircle,
  Moon,
  Sprout,
  Calendar,
  Wrench,
  Droplets,
  ShieldAlert,
  Tag,
  Cpu,
  User,
  Radio,
} from "lucide-react";

export function OpportunityStatusBadge({ status }: { status: OpportunityStatus }) {
  switch (status) {
    case "DETECTADA":
      return (
        <Badge
          variant="outline"
          className="border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400 gap-1 font-semibold"
        >
          <Eye className="size-3" />
          Detectada
        </Badge>
      );
    case "RECONHECIDA":
      return (
        <Badge
          variant="outline"
          className="border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 gap-1 font-semibold"
        >
          <CheckCircle2 className="size-3" />
          Reconhecida
        </Badge>
      );
    case "RESOLVIDA":
      return (
        <Badge
          variant="outline"
          className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 gap-1 font-semibold"
        >
          <CheckCircle className="size-3" />
          Resolvida
        </Badge>
      );
    case "DESCARTADA":
      return (
        <Badge
          variant="outline"
          className="border-muted-foreground/30 bg-muted/40 text-muted-foreground gap-1 font-medium"
        >
          <XCircle className="size-3" />
          Descartada
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export function OpportunityPriorityBadge({ priority }: { priority: OpportunityPriority }) {
  switch (priority) {
    case "CRITICA":
      return (
        <Badge className="bg-red-600 hover:bg-red-700 text-white gap-1 font-bold">
          <AlertTriangle className="size-3" />
          Crítica
        </Badge>
      );
    case "ALTA":
      return (
        <Badge className="bg-orange-500 hover:bg-orange-600 text-white gap-1 font-semibold">
          <AlertCircle className="size-3" />
          Alta
        </Badge>
      );
    case "MEDIA":
      return (
        <Badge
          variant="outline"
          className="border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400 gap-1 font-semibold"
        >
          <ArrowUpRight className="size-3" />
          Média
        </Badge>
      );
    case "BAIXA":
      return (
        <Badge
          variant="outline"
          className="border-slate-500/30 bg-slate-500/10 text-slate-600 dark:text-slate-400 gap-1 font-medium"
        >
          <ArrowDownRight className="size-3" />
          Baixa
        </Badge>
      );
    default:
      return <Badge variant="outline">{priority}</Badge>;
  }
}

export function OpportunityTypeBadge({ type }: { type: OpportunityType }) {
  switch (type) {
    case "TARIFA_NOTURNA":
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
          <Moon className="size-3.5" />
          Tarifa Noturna
        </span>
      );
    case "JANELA_PLANTIO":
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          <Sprout className="size-3.5" />
          Janela de Plantio
        </span>
      );
    case "JANELA_COLHEITA":
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
          <Calendar className="size-3.5" />
          Janela de Colheita
        </span>
      );
    case "APORTE_HIDRICO":
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-600 dark:text-cyan-400">
          <Droplets className="size-3.5" />
          Aporte Hídrico
        </span>
      );
    case "MANUTENCAO_PREVENTIVA":
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-purple-600 dark:text-purple-400">
          <Wrench className="size-3.5" />
          Manutenção
        </span>
      );
    case "TRATAMENTO_FITOSSANITARIO":
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-400">
          <ShieldAlert className="size-3.5" />
          Fitossanitário
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
          <Tag className="size-3.5" />
          Oportunidade Geral
        </span>
      );
  }
}

export function OpportunityOriginBadge({ origin }: { origin: OpportunityOrigin }) {
  switch (origin) {
    case "REGRA_INTERNA":
      return (
        <Badge variant="secondary" className="gap-1 text-[10px] font-medium">
          <Cpu className="size-2.5" />
          Regra Automática
        </Badge>
      );
    case "INTEGRACAO_EXTERNA":
      return (
        <Badge variant="secondary" className="gap-1 text-[10px] font-medium">
          <Radio className="size-2.5" />
          Integração
        </Badge>
      );
    case "MANUAL":
    default:
      return (
        <Badge variant="secondary" className="gap-1 text-[10px] font-medium">
          <User className="size-2.5" />
          Manual
        </Badge>
      );
  }
}
