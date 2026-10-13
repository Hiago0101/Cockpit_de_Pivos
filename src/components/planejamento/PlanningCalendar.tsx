import React from "react";
import { PivotPlanningGantt } from "./PivotPlanningGantt";

interface PlanningCalendarProps {
  onSelectEvent?: (eventId: string) => void;
}

export function PlanningCalendar({ onSelectEvent }: PlanningCalendarProps) {
  return (
    <div className="space-y-4">
      <PivotPlanningGantt
        initialHorizon={12}
        onNewPlanClick={() => {
          // Abertura integrada
        }}
      />
    </div>
  );
}
