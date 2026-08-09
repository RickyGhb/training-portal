import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { ROLE_LABELS } from "@/lib/roleLabels";
import { VISA_TYPE_LABELS } from "@/lib/visaTypeLabels";
import { UsernameEditButton } from "@/components/users/UsernameEditButton";
import { ChangePasswordButton } from "@/components/users/ChangePasswordButton";
import { ProfileFieldsForm } from "./ProfileFieldsForm";
import { ProfileChangeRequestButton } from "./ProfileChangeRequestButton";

export default async function ProfilePage() {
  const actor = await getCurrentUser();
  if (!actor) redirect("/login");

  const self = await prisma.user.findUnique({ where: { id: actor.id } });
  if (!self || self.deletedAt) redirect("/login");

  return (
    <div>
      <h1 className="page-title">My Profile</h1>
      <p className="page-subtitle">{ROLE_LABELS[self.role]}</p>

      {self.role === "CONSULTANT" ? (
        <>
          <div className="mt-6 max-w-md card">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-[var(--color-ink-soft)]">Name</dt>
                <dd className="text-[var(--color-ink)]">
                  {self.firstName} {self.lastName}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--color-ink-soft)]">Username</dt>
                <dd className="text-[var(--color-ink)]">@{self.username}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--color-ink-soft)]">Email</dt>
                <dd className="text-[var(--color-ink)]">{self.email || <span className="text-[var(--color-ink-faint)]">Not set</span>}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--color-ink-soft)]">Phone</dt>
                <dd className="text-[var(--color-ink)]">{self.phone || <span className="text-[var(--color-ink-faint)]">Not set</span>}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--color-ink-soft)]">Visa Type</dt>
                <dd className="text-[var(--color-ink)]">
                  {self.visaType ? VISA_TYPE_LABELS[self.visaType] : <span className="text-[var(--color-ink-faint)]">Not set</span>}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--color-ink-soft)]">Date of Birth</dt>
                <dd className="text-[var(--color-ink)]">
                  {self.dateOfBirth ? (
                    self.dateOfBirth.toLocaleDateString(undefined, { timeZone: "UTC" })
                  ) : (
                    <span className="text-[var(--color-ink-faint)]">Not set</span>
                  )}
                </dd>
              </div>
            </dl>
          </div>
          <p className="mt-4 max-w-md text-sm text-[var(--color-ink-soft)]">
            To change any of these details, send a request to your coordinator.
          </p>
          <div className="mt-3">
            <ProfileChangeRequestButton />
          </div>
        </>
      ) : (
        <>
          <ProfileFieldsForm
            userId={self.id}
            firstName={self.firstName}
            lastName={self.lastName}
            email={self.email}
            phone={self.phone}
          />
          <div className="mt-4 flex max-w-md items-center justify-between card">
            <div>
              <p className="text-sm font-medium text-[var(--color-ink)]">Username</p>
              <p className="text-sm text-[var(--color-ink-soft)]">@{self.username}</p>
            </div>
            <UsernameEditButton userId={self.id} username={self.username} />
          </div>
          <div className="mt-4 max-w-md card">
            <p className="text-sm font-medium text-[var(--color-ink)]">Password</p>
            <div className="mt-2">
              <ChangePasswordButton />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
