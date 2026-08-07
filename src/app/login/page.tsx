import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--color-shell)] px-4">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(circle at 15% 20%, var(--color-accent) 0%, transparent 35%), radial-gradient(circle at 85% 80%, var(--color-accent-strong) 0%, transparent 40%)",
        }}
      />
      <div className="relative w-full max-w-sm rounded-2xl border border-[var(--color-shell-border)] bg-[var(--color-surface)] p-8 shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-accent-strong)]">Welcome</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-ink)]">
          Training Portal
        </h1>
        <p className="mb-6 mt-1 text-sm text-[var(--color-ink-soft)]">Sign in with your username and password.</p>
        <LoginForm />
      </div>
    </main>
  );
}
