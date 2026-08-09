import type { Role } from "@/generated/prisma/client";

export const ROLE_LABELS: Record<Role, string> = {
  CEO: "CEO",
  LOCATION_MANAGER: "Location Manager",
  LOCATION_ADMIN: "Location Admin",
  COORDINATOR: "Coordinator",
  CONSULTANT: "Consultant",
  OFFSHORE_MANAGER: "Offshore Manager",
  OFFSHORE_TEAM_LEAD: "Offshore Team Lead",
  TRAINER: "Trainer",
  OTTER_TEAM: "Otter Team",
};
