import type { Agent, AuthSession, Company } from "@paperclipai/shared";

type DisplayAgent = Pick<Agent, "name" | "role" | "title">;
type DisplayCompany = Pick<Company, "ceoHonorific">;

function compact(value: string | null | undefined) {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

const roleTokenPattern = /^(ceo|cto|cfo|coo|cmo|pm|qa|ui|ux|dev|ops|staff|agent|engineer|designer|frontend|backend)$/i;

function isRoleToken(value: string) {
  return roleTokenPattern.test(value.replace(/\s+/g, " ").trim());
}

export function kawaiiFirstName(name: string | null | undefined, fallback = "Staff") {
  const normalized = compact(name);
  const first = normalized.split(" ")[0] ?? normalized;
  if (!first || isRoleToken(first)) return fallback;
  return first;
}

export function kawaiiStaffTitle(agent: DisplayAgent | null | undefined) {
  const rawTitle = compact(agent?.title);
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

export function kawaiiStaffDisplayParts(agent: DisplayAgent | null | undefined, fallbackName = "Staff") {
  const title = kawaiiStaffTitle(agent);
  const name = kawaiiFirstName(agent?.name, fallbackName);
  return {
    title,
    name,
    label: `${title}, ${name}`,
  };
}

export function kawaiiStaffLabel(agent: DisplayAgent | null | undefined) {
  return kawaiiStaffDisplayParts(agent).label;
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
