import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GroundingNote } from "./GroundingNote";

describe("GroundingNote", () => {
  it("says a passed text was checked against the case facts", () => {
    render(<GroundingNote grounding={{ status: "passed", issues: [] }} />);
    expect(
      screen.getByText(/Checked against the case facts/),
    ).toBeInTheDocument();
  });

  it("names what a rejected draft cited, without echoing an identifier", () => {
    render(
      <GroundingNote
        grounding={{
          status: "rejected",
          issues: [
            { kind: "unknown_number", detail: "4" },
            { kind: "unknown_rule", detail: "CHARGEBACK_HISTORY" },
            { kind: "identifier", detail: "email" },
          ],
        }}
      />,
    );
    const note = screen.getByText(/The AI draft was replaced/);
    expect(note).toHaveTextContent("number 4");
    expect(note).toHaveTextContent("rule name CHARGEBACK_HISTORY");
    expect(note).toHaveTextContent("an identifier");
    expect(note).not.toHaveTextContent("email");
  });

  it("shows nothing when no AI text was involved or the field is missing", () => {
    const { container, rerender } = render(
      <GroundingNote grounding={{ status: "not_applicable", issues: [] }} />,
    );
    expect(container).toBeEmptyDOMElement();
    rerender(<GroundingNote />);
    expect(container).toBeEmptyDOMElement();
  });
});
