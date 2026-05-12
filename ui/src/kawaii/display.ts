import type { Agent, AuthSession, Company } from "@paperclipai/shared";

type DisplayAgent = Pick<Agent, "name" | "role" | "title">;
type DisplayCompany = Pick<Company, "ceoHonorific">;

function compact(value: string | null | undefined) {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

export function kawaiiFirstName(name: string | null | undefined) {
  const normalized = compact(name);
  if (!normalized) return "Staff";
  return normalized.split(" ")[0] ?? normalized;
}

export function kawaiiStaffTitle(agent: DisplayAgent | null | undefined) {
  const rawRole = compact(agent?.role).toLowerCase();
  const rawTitle = compact(agent?.title);

  if (rawRole === "ceo" || /\bceo\b/i.test(rawTitle)) {
    return "CTO";
  }

  const title = rawTitle || compact(agent?.role) || "Staff";
  return title
    .replace(/^Royal\s+/i, "")
    .replace(/^Kawaii\s+/i, "")
    .replace(/\s+Agent$/i, "")
    .replace(/\s+Liaison$/i, "")
    .replace(/^Operations\s+Planner$/i, "Operations")
    .replace(/\s+Planner$/i, "")
    .trim() || "Staff";
}

export function kawaiiStaffLabel(agent: DisplayAgent | null | undefined) {
  return `${kawaiiStaffTitle(agent)}, ${kawaiiFirstName(agent?.name)}`;
}

export function kawaiiUserName(session: AuthSession | null | undefined) {
  return compact(session?.user?.name) || compact(session?.user?.email).split("@")[0] || "You";
}

export function kawaiiCeoLabel(session: AuthSession | null | undefined) {
  return `CEO, ${kawaiiUserName(session)}`;
}

export function kawaiiDefaultCeoHonorific(locale?: string | null) {
  const resolvedLocale =
    locale ??
    (typeof navigator !== "undefined" ? navigator.language : null) ??
    "en";
  return /^ko\b/i.test(resolvedLocale) ? "대표님" : "Mr. CEO";
}

export function kawaiiCeoHonorific(
  company: DisplayCompany | null | undefined,
  locale?: string | null,
) {
  return compact(company?.ceoHonorific) || kawaiiDefaultCeoHonorific(locale);
}
