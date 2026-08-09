import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { VISA_TYPE_LABELS } from "@/lib/visaTypeLabels";
import { StatusBadge } from "@/components/ui/Badge";
import { OtterFeedbackForm } from "./OtterFeedbackForm";

export default async function OtterConsultantsPage() {
  const actor = await getCurrentUser();
  if (!actor) redirect("/login");
  if (actor.role !== "OTTER_TEAM") redirect("/dashboard");

  const consultants = await prisma.user.findMany({
    where: { role: "CONSULTANT", otterTeamUserId: actor.id, deletedAt: null },
    include: { otterFeedbackReceived: { orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return (
    <div>
      <h1 className="page-title">My Consultants</h1>
      <p className="page-subtitle">Consultants assigned to you for marketing-readiness review.</p>

      <div className="mt-6 space-y-3">
        {consultants.map((c) => {
          const latest = c.otterFeedbackReceived[0];
          return (
            <div key={c.id} className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--color-ink)]">
                    {c.firstName} {c.lastName} <span className="text-[var(--color-ink-soft)]">@{c.username}</span>
                  </p>
                  <p className="text-xs text-[var(--color-ink-soft)]">
                    {c.technology ?? "—"} · {c.visaType ? VISA_TYPE_LABELS[c.visaType] : "—"}
                  </p>
                </div>
                <StatusBadge status={c.status} />
              </div>
              {latest && (
                <p className="mt-2 text-xs text-[var(--color-ink-soft)]">
                  Latest verdict:{" "}
                  <span className={latest.verdict === "READY" ? "text-green-700" : "text-[var(--color-danger)]"}>
                    {latest.verdict === "READY" ? "Ready for marketing" : "Not yet"}
                  </span>{" "}
                  ({latest.createdAt.toLocaleDateString()}){latest.notes ? ` — ${latest.notes}` : ""}
                </p>
              )}
              <OtterFeedbackForm consultantUserId={c.id} />
            </div>
          );
        })}
        {consultants.length === 0 && (
          <p className="text-sm text-[var(--color-ink-faint)]">No consultants assigned to you yet.</p>
        )}
      </div>
    </div>
  );
}
