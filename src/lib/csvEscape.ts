// Prefixing a value that starts with =, +, -, @, tab, or CR with a leading
// single quote stops spreadsheet apps (Excel, Sheets) from auto-evaluating
// it as a formula on CSV import — otherwise a user-controlled field like a
// consultant's firstName could smuggle a formula into this export and
// execute in whoever opens it (CSV/formula injection, CWE-1236).
export function csvEscape(value: string): string {
  const neutralized = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  if (/[",\n]/.test(neutralized)) {
    return `"${neutralized.replace(/"/g, '""')}"`;
  }
  return neutralized;
}
