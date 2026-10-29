import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "./card";

describe("Card components", () => {
  describe("Card", () => {
    it("renders children", () => {
      render(<Card>Card content</Card>);
      expect(screen.getByText("Card content")).toBeInTheDocument();
    });

    it("applies default styles", () => {
      render(<Card data-testid="card">Content</Card>);
      expect(screen.getByTestId("card")).toHaveClass("rounded-xl", "border");
    });

    it("merges custom className", () => {
      render(
        <Card className="custom" data-testid="card">
          Content
        </Card>,
      );
      expect(screen.getByTestId("card")).toHaveClass("custom");
    });

    it("forwards ref", () => {
      const ref = { current: null };
      render(<Card ref={ref}>Content</Card>);
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe("CardHeader", () => {
    it("renders children", () => {
      render(<CardHeader>Header</CardHeader>);
      expect(screen.getByText("Header")).toBeInTheDocument();
    });

    it("applies padding styles", () => {
      render(<CardHeader data-testid="header">Header</CardHeader>);
      expect(screen.getByTestId("header")).toHaveClass("p-6");
    });
  });

  describe("CardTitle", () => {
    it("renders as h2", () => {
      render(<CardTitle>Title</CardTitle>);
      expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
        "Title",
      );
    });

    it("applies text styles", () => {
      render(<CardTitle data-testid="title">Title</CardTitle>);
      expect(screen.getByTestId("title")).toHaveClass(
        "text-lg",
        "font-semibold",
      );
    });
  });

  describe("CardDescription", () => {
    it("renders children", () => {
      render(<CardDescription>Description</CardDescription>);
      expect(screen.getByText("Description")).toBeInTheDocument();
    });

    it("applies text styles", () => {
      render(<CardDescription data-testid="desc">Desc</CardDescription>);
      expect(screen.getByTestId("desc")).toHaveClass(
        "text-sm",
        "text-neutral-500",
      );
    });
  });

  describe("CardContent", () => {
    it("renders children", () => {
      render(<CardContent>Content</CardContent>);
      expect(screen.getByText("Content")).toBeInTheDocument();
    });

    it("applies padding styles", () => {
      render(<CardContent data-testid="content">Content</CardContent>);
      expect(screen.getByTestId("content")).toHaveClass("p-6", "pt-0");
    });
  });

  describe("CardFooter", () => {
    it("renders children", () => {
      render(<CardFooter>Footer</CardFooter>);
      expect(screen.getByText("Footer")).toBeInTheDocument();
    });

    it("applies flex styles", () => {
      render(<CardFooter data-testid="footer">Footer</CardFooter>);
      expect(screen.getByTestId("footer")).toHaveClass("flex", "items-center");
    });
  });
});
