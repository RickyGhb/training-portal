import type { VisaType } from "@/generated/prisma/client";

export const VISA_TYPE_LABELS: Record<VisaType, string> = {
  CPT: "CPT",
  INITIAL_OPT: "Initial OPT",
  STEM_OPT: "STEM OPT",
  H1B: "H1B",
  H4EAD: "H4 EAD",
  GC: "Green Card (GC)",
  US_CITIZEN: "US Citizen",
};
