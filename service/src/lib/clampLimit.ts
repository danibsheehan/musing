export function clampLimit(value: unknown, defaultLimit: number, maxLimit: number): number {
  return typeof value === "number" && value > 0 ? Math.min(value, maxLimit) : defaultLimit;
}
