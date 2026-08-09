"use client";

import { useActionState } from "react";
import { assignConsultantToTeamLeadAction } from "@/app/(app)/offshore/actions";

export function TeamLeadAssignSelect({
  consultantId,
  currentTeamLeadId,
  teamLeads,
}: {
  consultantId: string;
  currentTeamLeadId: string | null;
  teamLeads: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(assignConsultantToTeamLeadAction, {});

  return (
    <form action={formAction} className="flex items-center gap-1">
      <input type="hidden" name="consultantId" value={consultantId} />
      <select
        name="teamLeadId"
        defaultValue={currentTeamLeadId ?? ""}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        disabled={pending}
        className="field py-1 text-xs"
      >
        <option value="">Unassigned</option>
        {teamLeads.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      {state.error && <span className="text-xs text-[var(--color-danger)]">{state.error}</span>}
    </form>
  );
}
