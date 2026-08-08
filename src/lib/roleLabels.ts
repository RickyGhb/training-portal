import type { Role } from "@/generated/prisma/client";

export const ROLE_LABELS: Record<Role, string> = {
  CEO: "CEO",
  LOCATION_MANAGER: "Location Manager",
  LOCATION_ADMIN: "Location Admin",
  COORDINATOR: "Coordinator",
  CONSULTANT: "Consultant",
};
