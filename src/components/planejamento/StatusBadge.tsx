import React from "react";
import { Badge } from "@/components/ui/badge";
import type { CropPlanStatus } from "@/services/api";
import { Clock, Calendar, PlayCircle, CheckCircle2, XCircle } from "lucide-react";

interface StatusBadgeProps {
  status: CropPlanStatus | string;
  className?: string;
}

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  switch (status) {
    case "RASCUNHO":
      return (
        <Badge
          variant="outline"
          className={`border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300 font-medium gap-1 px-2 py-0.5 ${className}`}
        >
          <Clock className="size-3" />
          Rascunho
        </Badge>
      );
    case "PLANEJADO":
      return (
        <Badge
          variant="outline"
          className={`border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300 font-medium gap-1 px-2 py-0.5 ${className}`}
        >
          <Calendar className="size-3" />
          Planejado
        </Badge>
      );
    case "EM_ANDAMENTO":
      return (
        <Badge
          variant="outline"
          className={`border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-medium gap-1 px-2 py-0.5 animate-pulse ${className}`}
        >
          <PlayCircle className="size-3" />
          Em Andamento
        </Badge>
      );
    case "CONCLUIDO":
      return (
        <Badge
          variant="outline"
          className={`border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300 font-medium gap-1 px-2 py-0.5 ${className}`}
        >
          <CheckCircle2 className="size-3" />
          Concluído
        </Badge>
      );
    case "CANCELADO":
      return (
        <Badge
          variant="outline"
          className={`border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300 font-medium gap-1 px-2 py-0.5 ${className}`}
        >
          <XCircle className="size-3" />
          Cancelado
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className={`text-muted-foreground ${className}`}>
          {status}
        </Badge>
      );
  }
}
