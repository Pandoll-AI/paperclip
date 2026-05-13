// @vitest-environment jsdom

import { act } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { KawaiiDialogueDock, resolveKawaiiDialogueChoiceAction } from "./KawaiiShell";

const navigateMock = vi.hoisted(() => vi.fn());
const openNewAgentMock = vi.hoisted(() => vi.fn());
const openNewGoalMock = vi.hoisted(() => vi.fn());
const openNewIssueMock = vi.hoisted(() => vi.fn());
const openNewProjectMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/router", () => ({
  NavLink: ({ children }: { children: ReactNode }) => <a>{children}</a>,
  useLocation: () => ({ pathname: "/PAP/dashboard", search: "", hash: "", state: null }),
  useNavigate: () => navigateMock,
}));

vi.mock("../context/CompanyContext", () => ({
  useCompany: () => ({
    selectedCompany: { id: "company-1", name: "Paperclip", issuePrefix: "PAP", ceoHonorific: "대표님" },
    selectedCompanyId: "company-1",
  }),
}));

vi.mock("../context/DialogContext", () => ({
  useDialogActions: () => ({
    openNewAgent: openNewAgentMock,
    openNewGoal: openNewGoalMock,
    openNewIssue: openNewIssueMock,
    openNewProject: openNewProjectMock,
  }),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe("KawaiiDialogueDock", () => {
  it("maps visual-novel choices to concrete route or dialog actions", () => {
    expect(resolveKawaiiDialogueChoiceAction("office", 0)).toEqual({ kind: "navigate", to: "/approvals/pending" });
    expect(resolveKawaiiDialogueChoiceAction("issue_quest_room", 2)).toEqual({ kind: "dialog", target: "newIssue" });
    expect(resolveKawaiiDialogueChoiceAction("staff_room", 1)).toEqual({ kind: "dialog", target: "newGoal" });
    expect(resolveKawaiiDialogueChoiceAction("approval_budget_room", 1)).toEqual({
      kind: "navigate",
      to: "/approvals/all",
    });
    expect(resolveKawaiiDialogueChoiceAction("settings_atelier", 3)).toEqual({
      kind: "navigate",
      to: "/company/settings/secrets",
    });
  });

  it("renders the lower-right dialogue cut-in instead of the stage scene composite", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<KawaiiDialogueDock />);
    });

    const cutin = container.querySelector(".kawaii-dialogue-dock__cutin img");
    expect(cutin?.getAttribute("src")).toMatch(/^\/kawaii\/characters\/cutins\/sera-dock\.png\?v=/);
    expect(container.querySelector(".kawaii-dialogue-dock__scene")).toBeNull();

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("runs the mapped action when a dialogue choice is clicked", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<KawaiiDialogueDock />);
    });

    const firstChoice = container.querySelector(".kawaii-dialogue-dock__choices button");
    expect(firstChoice).not.toBeNull();

    await act(async () => {
      firstChoice?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(navigateMock).toHaveBeenCalledWith("/approvals/pending");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
