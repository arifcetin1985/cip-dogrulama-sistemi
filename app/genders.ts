export const GENDERS = ["ERKEK", "KADIN"] as const;

export type Gender = (typeof GENDERS)[number];

export function normalizeGender(value: unknown): Gender | null {
  const normalized = value == null
    ? ""
    : String(value).trim().toLocaleUpperCase("tr-TR");

  if (["ERKEK", "E", "MALE", "M"].includes(normalized)) return "ERKEK";
  if (["KADIN", "K", "FEMALE", "F"].includes(normalized)) return "KADIN";
  return null;
}

export function genderLabel(value: unknown) {
  return normalizeGender(value) === "KADIN" ? "Kadın" : "Erkek";
}
