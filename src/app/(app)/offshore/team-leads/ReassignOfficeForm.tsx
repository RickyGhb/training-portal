"use client";

import { useActionState } from "react";
import { reassignTeamLeadOfficeAction } from "@/app/(app)/offshore/actions";
import { OFFSHORE_OFFICE_LABELS } from "@/lib/offshoreOfficeLabels";
import type { OffshoreOffice } from "@/generated/prisma/client";

export function ReassignOfficeForm({ teamLeadId, currentOffice }: { teamLeadId: string; currentOffice: OffshoreOffice | null }) {
  const [state, formAction, pending] = useActionState(reassignTeamLeadOfficeAction, {});

  return (
    <form action={formAction} className="flex items-center gap-1">
      <input type="hidden" name="teamLeadId" value={teamLeadId} />
      <select name="newOffice" defaultValue={currentOffice ?? ""} disabled={pending} className="field py-1 text-xs">
        {Object.entries(OFFSHORE_OFFICE_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <button type="submit" disabled={pending} className="btn-secondary py-1 text-xs disabled:opacity-50">
        Move
      </button>
      {state.error && <span className="text-xs text-[var(--color-danger)]">{state.error}</span>}
      {state.success && <span className="text-xs text-green-700">Moved</span>}
    </form>
  );
}
