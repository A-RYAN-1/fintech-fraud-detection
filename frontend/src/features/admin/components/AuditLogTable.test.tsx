import { describe, expect, it } from "vitest";
import { renderWithProviders, screen } from "@/test/test-utils";
import type { AuditLog } from "../api";
import AuditLogTable from "./AuditLogTable";

const log = (after: Record<string, unknown>) =>
  ({
    id: "1",
    event_type: "CASE_NARRATIVE",
    entity_type: "Transaction",
    entity_id: "9888b957-0000-0000-0000-000000000000",
    description: "drafted a case narrative",
    actor: "reviewer@example.com",
    actor_role: "reviewer",
    before: null,
    after,
    created_at: "2026-11-02T13:00:00Z",
  }) as unknown as AuditLog;

describe("AuditLogTable", () => {
  it("shows a nested value as JSON, never as [object Object]", () => {
    renderWithProviders(
      <AuditLogTable
        logs={[
          log({ source: "ai", grounding: { status: "passed", cited: 3 } }),
        ]}
      />,
    );

    const line = screen.getByText(/^after source=ai/);
    expect(line.textContent).toContain(
      'grounding={"status":"passed","cited":3}',
    );
    expect(line.textContent).not.toContain("[object Object]");
  });

  it("keeps plain values as they were", () => {
    renderWithProviders(
      <AuditLogTable logs={[log({ decision: "held", n: 2 })]} />,
    );

    expect(screen.getByText("after decision=held n=2")).toBeInTheDocument();
  });
});

describe("AuditLogTable long states", () => {
  it("folds a long state to two lines and opens it on request", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    renderWithProviders(
      <AuditLogTable logs={[log({ summary: "x".repeat(300) })]} />,
    );
    const toggle = screen.getByRole("button", { name: "Show all" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Show less" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });
});
