export const RACE_CATEGORIES = ["10K", "21K"] as const;

export type RaceCategory = (typeof RACE_CATEGORIES)[number];

export function normalizeRaceCategory(value: unknown): RaceCategory | null {
  const compact = value == null
    ? ""
    : String(value).trim().toLocaleUpperCase("tr-TR").replace(/\s+/g, "");

  if (compact === "10" || compact.startsWith("10K")) return "10K";
  if (compact === "21" || compact.startsWith("21K")) return "21K";
  return null;
}
