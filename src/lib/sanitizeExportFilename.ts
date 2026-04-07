/** Safe base name for PDF / Word downloads (no extension). */
export function sanitizeExportBasename(title: string): string {
  const trimmed = title.trim() || "Untitled";
  const cleaned = trimmed.replace(/[/\\?%*:|"<>]/g, "-").replace(/\s+/g, " ");
  const sliced = cleaned.slice(0, 120).replace(/[.\s]+$/g, "");
  return sliced || "Untitled";
}
