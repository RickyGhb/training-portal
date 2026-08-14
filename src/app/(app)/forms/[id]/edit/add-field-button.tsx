"use client";

import { FormModalButton } from "@/components/ui/FormModalButton";
import { addFieldAction } from "../../actions";
import { FieldFormFields } from "./field-form-fields";

export function AddFieldButton({ formId }: { formId: string }) {
  return (
    <FormModalButton
      action={addFieldAction}
      hiddenFields={{ formId }}
      title="Add a question"
      submitLabel="Add"
      label="+ Add question"
      className="btn-secondary"
    >
      <FieldFormFields />
    </FormModalButton>
  );
}
