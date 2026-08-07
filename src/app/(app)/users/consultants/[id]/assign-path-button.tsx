"use client";

import { FormModalButton } from "@/components/ui/FormModalButton";
import { assignTrainingPathAction } from "./actions";

export function AssignPathButton({
  consultantUserId,
  currentPathName,
  paths,
}: {
  consultantUserId: string;
  currentPathName: string | null;
  paths: { id: string; name: string }[];
}) {
  return (
    <FormModalButton
      action={assignTrainingPathAction}
      hiddenFields={{ consultantUserId }}
      title={currentPathName ? "Change primary training path" : "Assign primary training path"}
      description={
        currentPathName
          ? `Currently assigned: "${currentPathName}". Changing this replaces their primary curriculum immediately.`
          : "Every consultant needs one primary training path."
      }
      submitLabel={currentPathName ? "Change" : "Assign"}
      label={currentPathName ? "Change" : "Assign a training path"}
    >
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--color-ink)]">Training path</label>
        <select name="trainingPathId" required className="w-full field">
          <option value="">Select...</option>
          {paths.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
    </FormModalButton>
  );
}
