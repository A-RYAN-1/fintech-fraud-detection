import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent } from "@/test/test-utils";
import { incidentsApi, type Incident } from "@/features/incidents";
import IncidentsPage from "./IncidentsPage";

const incident: Incident = {
  id: 3,
  kind: "paypal_error",
  title: "PayPal capture failed (HTTP 502)",
  status: "open",
  occurrences: 7,
  recurrences: 0,
  first_seen_at: "2026-10-30T08:00:00Z",
  last_seen_at: "2026-10-30T09:00:00Z",
  sample: { action: "capture", status: 502, debug_id: "dbg-1" },
  detail: "Bad gateway",
  ai_note: null,
  draft: {
    title: "[Sentrix] PayPal capture failed (HTTP 502)",
    body: "## What happened\nSeen 7 times.",
    new_issue_url:
      "https://github.com/A-RYAN-1/fintech-fraud-detection/issues/new?title=x",
  },
  decided_by: null,
  decided_at: null,
  decision_note: null,
  issue_url: null,
};

const handled: Incident = {
  ...incident,
  id: 4,
  title: "Background job BoomJob failed with RuntimeError",
  kind: "job_failed",
  status: "reported",
  decided_by: "admin@example.com",
  decided_at: "2026-10-30T10:00:00Z",
  decision_note: "filed",
};

function mockList(rows: Incident[], digest = "# Sentrix incident digest") {
  return vi.spyOn(incidentsApi, "list").mockResolvedValue({
    incidents: rows,
    meta: { current_page: 1, total_pages: 1, total_count: rows.length },
    digest,
    open_count: rows.filter((row) => row.status === "open").length,
  });
}

const admin = {
  preloadedState: { auth: { user: { id: "1", role: "admin" } } } as never,
};
const analyst = {
  preloadedState: { auth: { user: { id: "2", role: "analyst" } } } as never,
};

describe("IncidentsPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the digest, the counted incident and its evidence", async () => {
    mockList([incident], "# Sentrix incident digest\n\n1 open incident");
    renderWithProviders(<IncidentsPage />, admin);

    expect(
      await screen.findByText("PayPal capture failed (HTTP 502)"),
    ).toBeInTheDocument();
    expect(screen.getByText(/1 open incident/)).toBeInTheDocument();
    expect(screen.getByText(/PayPal: 7 times/)).toBeInTheDocument();
    expect(screen.getByText("dbg-1")).toBeInTheDocument();
    expect(screen.getByText(/Last message: Bad gateway/)).toBeInTheDocument();
  });

  it("links to a prefilled GitHub issue form and files nothing itself", async () => {
    mockList([incident]);
    renderWithProviders(<IncidentsPage />, admin);

    const link = await screen.findByRole("link", {
      name: "Open the GitHub issue form",
    });
    expect(link).toHaveAttribute(
      "href",
      expect.stringContaining("https://github.com/A-RYAN-1/"),
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("gives an analyst no approve or dismiss buttons", async () => {
    mockList([incident]);
    renderWithProviders(<IncidentsPage />, analyst);

    await screen.findByText("PayPal capture failed (HTTP 502)");
    expect(screen.getByText("Waiting for an admin")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Approve the report" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Dismiss" }),
    ).not.toBeInTheDocument();
  });

  it("lets an admin approve with a note and the issue link", async () => {
    mockList([incident]);
    const decide = vi
      .spyOn(incidentsApi, "decide")
      .mockResolvedValue({ ...incident, status: "reported" });
    renderWithProviders(<IncidentsPage />, admin);

    await userEvent.type(await screen.findByLabelText(/Note/), "filing it");
    await userEvent.type(
      screen.getByLabelText(/Issue link/),
      "https://github.com/A-RYAN-1/fintech-fraud-detection/issues/9",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Approve the report" }),
    );

    expect(decide).toHaveBeenCalledWith(
      3,
      "approve",
      "filing it",
      "https://github.com/A-RYAN-1/fintech-fraud-detection/issues/9",
      expect.any(String),
    );
  });

  it("lets an admin dismiss", async () => {
    mockList([incident]);
    const decide = vi
      .spyOn(incidentsApi, "decide")
      .mockResolvedValue({ ...incident, status: "dismissed" });
    renderWithProviders(<IncidentsPage />, admin);

    await userEvent.click(
      await screen.findByRole("button", { name: "Dismiss" }),
    );

    expect(decide).toHaveBeenCalledWith(
      3,
      "dismiss",
      "",
      "",
      expect.any(String),
    );
  });

  it("asks the AI analyst for a likely cause only when an admin presses the button", async () => {
    mockList([incident]);
    const suggest = vi
      .spyOn(incidentsApi, "suggest")
      .mockResolvedValue({ ...incident, ai_note: "Likely cause: outage." });
    renderWithProviders(<IncidentsPage />, admin);

    expect(suggest).not.toHaveBeenCalled();
    await userEvent.click(
      await screen.findByRole("button", {
        name: /Ask the AI analyst for a likely cause/,
      }),
    );
    expect(suggest).toHaveBeenCalledWith(3, expect.any(String));
  });

  it("lists handled incidents with who decided and says so when none are open", async () => {
    mockList([handled], "No open incidents.");
    renderWithProviders(<IncidentsPage />, admin);

    expect(await screen.findByText("No open incidents")).toBeInTheDocument();
    expect(screen.getByText("Handled")).toBeInTheDocument();
    expect(
      screen.getByText(/Approved by admin@example.com/),
    ).toBeInTheDocument();
  });

  it("runs a scan on request", async () => {
    mockList([]);
    const scan = vi
      .spyOn(incidentsApi, "scan")
      .mockResolvedValue({ observed: 1, open_count: 1 });
    renderWithProviders(<IncidentsPage />, analyst);

    await userEvent.click(
      await screen.findByRole("button", { name: "Scan now" }),
    );
    expect(scan).toHaveBeenCalled();
  });
});
