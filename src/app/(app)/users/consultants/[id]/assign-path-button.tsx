"use client";

import { FormModalButton } from "@/components/ui/FormModalButton";
import { assignTrainingPathAction } from "./actions";

export function AssignPathButton({
  consultantUserId,
  currentPathName,
  paths,
  consultantTechnology,
}: {
  consultantUserId: string;
  currentPathName: string | null;
  paths: { id: string; name: string; technology: string | null }[];
  consultantTechnology: string | null;
}) {
  const recommended = consultantTechnology
    ? paths.filter((p) => p.technology === consultantTechnology)
    : [];
  const other = consultantTechnology ? paths.filter((p) => p.technology !== consultantTechnology) : paths;

  const renderOption = (p: { id: string; name: string }) => (
    <option key={p.id} value={p.id}>
      {p.name}
    </option>
  );

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
        <label htmlFor="assign-training-path" className="mb-1 block text-xs font-medium text-[var(--color-ink)]">
          Training path
        </label>
        <select id="assign-training-path" name="trainingPathId" required className="w-full field">
          <option value="">Select...</option>
          {recommended.length > 0 ? (
            <>
              <optgroup label={`Recommended for ${consultantTechnology}`}>{recommended.map(renderOption)}</optgroup>
              <optgroup label="Other Training Paths">{other.map(renderOption)}</optgroup>
            </>
          ) : (
            other.map(renderOption)
          )}
        </select>
      </div>
    </FormModalButton>
  );
}
