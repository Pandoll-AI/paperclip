// @vitest-environment jsdom

import { act } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { KawaiiDialogueDock } from "./KawaiiShell";

vi.mock("@/lib/router", () => ({
  NavLink: ({ children }: { children: ReactNode }) => <a>{children}</a>,
  useLocation: () => ({ pathname: "/PAP/dashboard", search: "", hash: "", state: null }),
}));

vi.mock("../context/CompanyContext", () => ({
  useCompany: () => ({
    selectedCompany: { id: "company-1", name: "Paperclip", issuePrefix: "PAP", ceoHonorific: "대표님" },
    selectedCompanyId: "company-1",
  }),
}));

vi.mock("../context/DialogContext", () => ({
  useDialogActions: () => ({
    openNewIssue: vi.fn(),
  }),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe("KawaiiDialogueDock", () => {
  it("renders the lower-right dialogue cut-in instead of the stage scene composite", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<KawaiiDialogueDock />);
    });

    const cutin = container.querySelector(".kawaii-dialogue-dock__cutin img");
    expect(cutin?.getAttribute("src")).toBe("/kawaii/characters/cutins/sera-dock.png");
    expect(container.querySelector(".kawaii-dialogue-dock__scene")).toBeNull();

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
