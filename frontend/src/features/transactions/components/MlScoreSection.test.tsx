import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import MlScoreSection from "./MlScoreSection";

describe("MlScoreSection", () => {
  it("renders nothing when the transaction has no model score", () => {
    render(<MlScoreSection score={null} />);
    expect(screen.queryByTestId("ml-score-section")).not.toBeInTheDocument();
  });

  it("shows the estimate as a percentage", () => {
    render(<MlScoreSection score={0.1234} reasons={[]} />);
    expect(screen.getByText("12.3%")).toBeInTheDocument();
  });

  it("lists every reason with its contribution", () => {
    render(
      <MlScoreSection
        score={0.4}
        reasons={[
          {
            feature: "new_ip",
            label: "IP address not seen before",
            contribution: 1.234,
          },
          {
            feature: "night",
            label: "Night-time transaction",
            contribution: 0.5,
          },
        ]}
      />,
    );
    expect(screen.getByText("IP address not seen before")).toBeInTheDocument();
    expect(screen.getByText("+1.23")).toBeInTheDocument();
    expect(screen.getByText("Night-time transaction")).toBeInTheDocument();
  });

  it("states that the score never blocks", () => {
    render(<MlScoreSection score={0.4} />);
    expect(screen.getByText(/never block/i)).toBeInTheDocument();
  });
});
