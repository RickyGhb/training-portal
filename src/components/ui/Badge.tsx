const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-[var(--color-success-soft)] text-[var(--color-success)]",
  DEACTIVATED: "bg-[var(--color-warning-soft)] text-[var(--color-warning)]",
  DELETED: "bg-[var(--color-muted-soft)] text-[var(--color-ink-soft)]",
  ARCHIVED: "bg-[var(--color-muted-soft)] text-[var(--color-ink-soft)]",
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? "bg-[var(--color-muted-soft)] text-[var(--color-ink-soft)]";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}
