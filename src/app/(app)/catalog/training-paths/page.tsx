import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { canManageCatalogStructure } from "@/lib/auth/rbac";
import { StatusBadge } from "@/components/ui/Badge";
import { TrainingPathForm } from "./training-path-form";
import { TrainingPathRowActions } from "./training-path-row-actions";

export default async function TrainingPathsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canManageCatalogStructure(user.role)) redirect("/dashboard");

  const paths = await prisma.trainingPath.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { courses: true, assignments: true } },
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Training Paths</h1>
      <p className="mt-1 text-sm text-slate-500">
        A training path is an ordered set of courses assigned to consultants as their primary curriculum.
      </p>

      <div className="mt-6">
        <TrainingPathForm />
      </div>

      <table className="mt-6 w-full overflow-hidden rounded-lg border border-slate-200 bg-white text-sm">
        <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
          <tr>
            <th className="px-4 py-2">Name</th>
            <th className="px-4 py-2">Description</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {paths.map((path) => (
            <tr key={path.id}>
              <td className="px-4 py-2 font-medium text-slate-900">{path.name}</td>
              <td className="px-4 py-2 max-w-sm truncate text-slate-600">{path.description}</td>
              <td className="px-4 py-2">
                <StatusBadge status={path.status} />
              </td>
              <td className="px-4 py-2">
                <TrainingPathRowActions
                  id={path.id}
                  name={path.name}
                  description={path.description}
                  status={path.status}
                  courseCount={path._count.courses}
                  assignmentCount={path._count.assignments}
                />
              </td>
            </tr>
          ))}
          {paths.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                No training paths yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
