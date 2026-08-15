import { redirect } from "next/navigation";

// Superseded by the consolidated /users/management list (filterable by
// role) — this per-role page is kept as a redirect only so old bookmarks
// and direct links still land somewhere useful. Does not affect
// /users/consultants/[id], the still-active per-consultant detail page.
export default function ConsultantsPage() {
  redirect("/users/management");
}
