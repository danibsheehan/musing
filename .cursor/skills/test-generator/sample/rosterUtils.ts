/**
 * Sample plain TypeScript module — patterns apply to `src/lib`-style helpers.
 */
export function abbrevName(full: string): string {
	const parts = full.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return '';
	if (parts.length === 1) return parts[0].slice(0, 3).toUpperCase();
	const first = parts[0][0] ?? '';
	const last = parts[parts.length - 1][0] ?? '';
	return (first + last).toUpperCase();
}
