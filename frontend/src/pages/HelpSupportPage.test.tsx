import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, screen } from "@/test/test-utils";
import type { UserRole } from "@/types";

vi.mock("@/features/auth/hooks", () => ({ useAuth: vi.fn() }));
vi.mock("@/features/help", async () => {
  const actual =
    await vi.importActual<typeof import("@/features/help")>("@/features/help");
  return {
    ...actual,
    helpApi: {
      health: vi.fn(),
      analystStatus: vi.fn(),
      sendSupportMessage: vi.fn(),
    },
  };
});

import { useAuth } from "@/features/auth/hooks";
import { helpApi, faqFor } from "@/features/help";
import HelpSupportPage from "./HelpSupportPage";

function renderAs(role: UserRole) {
  vi.mocked(useAuth).mockReturnValue({
    user: {
      id: "1",
      email: "a@example.com",
      first_name: "A",
      last_name: "B",
      role,
      status: "active",
    },
  } as ReturnType<typeof useAuth>);
  return renderWithProviders(<HelpSupportPage />);
}

describe("HelpSupportPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(helpApi.health).mockResolvedValue({
      status: "ok",
      database: "connected",
      timestamp: "2026-10-30T04:00:00Z",
    });
    vi.mocked(helpApi.analystStatus).mockResolvedValue({
      enabled: true,
      model: "gemini-test",
      state: "open",
      retry_in_seconds: 12.4,
    });
  });

  it("reads the live status and hides the AI analyst row from a customer", async () => {
    renderAs("customer");
    expect(await screen.findByText("Up")).toBeInTheDocument();
    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(screen.queryByText("AI analyst")).not.toBeInTheDocument();
    expect(helpApi.analystStatus).not.toHaveBeenCalled();
  });

  it("shows staff the AI analyst state from the API", async () => {
    renderAs("reviewer");
    expect(
      await screen.findByText("Paused after failures, retries in 13 s"),
    ).toBeInTheDocument();
  });

  it("has no fake contacts or dead links", () => {
    renderAs("customer");
    const hrefs = screen
      .getAllByRole("link")
      .map((a) => a.getAttribute("href"));
    expect(hrefs).not.toContain("#");
    expect(hrefs).toContain(
      "https://github.com/A-RYAN-1/fintech-fraud-detection/issues",
    );
    expect(document.body.textContent).not.toMatch(
      /fraudshield|Live Chat|Operational|\+1/i,
    );
  });

  it("sends a support message and says how many admins got it", async () => {
    vi.mocked(helpApi.sendSupportMessage).mockResolvedValue({
      delivered_to: 2,
    });
    const user = userEvent.setup();
    renderAs("customer");

    await user.selectOptions(screen.getByLabelText("About"), "account");
    await user.type(screen.getByLabelText("Subject"), "Locked out");
    await user.type(screen.getByLabelText("Message"), "Please help");
    await user.click(
      screen.getByRole("button", { name: "Send to the admins" }),
    );

    expect(helpApi.sendSupportMessage).toHaveBeenCalledWith({
      topic: "account",
      subject: "Locked out",
      message: "Please help",
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "2 admins will see it",
    );
  });

  it("filters the questions", async () => {
    const user = userEvent.setup();
    renderAs("customer");
    await user.type(screen.getByLabelText("Search the questions"), "blocked");
    expect(screen.getByText("Why was my payment blocked?")).toBeInTheDocument();
    expect(screen.queryByText("Is this real money?")).not.toBeInTheDocument();
  });
});

describe("faqFor", () => {
  it("keeps staff answers away from customers", () => {
    const customer = faqFor("customer").map((e) => e.question);
    expect(customer).not.toContain("What is my decision limit?");
    expect(faqFor("analyst").map((e) => e.question)).toContain(
      "What is my decision limit?",
    );
    expect(faqFor("analyst").map((e) => e.question)).not.toContain(
      "Why does a refund need a second person?",
    );
    expect(faqFor("admin").map((e) => e.question)).toContain(
      "What can the sandbox admin not do?",
    );
  });
});
