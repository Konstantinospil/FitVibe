import { render, cleanup, within } from "@testing-library/react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { Chart, ChartTooltip } from "../../src/components/ui/Chart";

const sampleData = [
  { label: "Mon", value: 50 },
  { label: "Tue", value: 55 },
  { label: "Wed", value: 60 },
];

describe("Chart", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders area chart with provided data", () => {
    const { container } = render(<Chart data={sampleData} />);
    const { getByTestId } = within(container);

    // Chart component has its own wrapper with data-testid="chart"
    expect(getByTestId("chart")).toBeInTheDocument();
    expect(container.querySelector(".recharts-responsive-container")).toBeInTheDocument();
  });

  it("renders bar chart when type is bar", () => {
    const { container } = render(<Chart data={sampleData} type="bar" />);
    const { getByTestId } = within(container);

    expect(getByTestId("chart")).toBeInTheDocument();
    expect(container.querySelector(".recharts-responsive-container")).toBeInTheDocument();
  });

  it("renders with custom height", () => {
    const { container } = render(<Chart data={sampleData} height={400} />);
    const { getByTestId } = within(container);

    const chartElement = getByTestId("chart");
    expect(chartElement).toHaveStyle({ height: "400px" });
  });

  it("renders with custom color", () => {
    const { container } = render(<Chart data={sampleData} color="#ff0000" />);
    const { getByTestId } = within(container);

    expect(getByTestId("chart")).toBeInTheDocument();
  });

  it("renders with empty data", () => {
    const { container } = render(<Chart data={[]} />);
    const { getByTestId } = within(container);

    expect(getByTestId("chart")).toBeInTheDocument();
  });

  it("renders with single data point", () => {
    const { container } = render(<Chart data={[{ label: "Mon", value: 50 }]} />);
    const { getByTestId } = within(container);

    expect(getByTestId("chart")).toBeInTheDocument();
  });

  it("uses custom labelFormatter", () => {
    const labelFormatter = vi.fn((label: string) => `Custom: ${label}`);
    const { container } = render(<Chart data={sampleData} labelFormatter={labelFormatter} />);
    const { getByTestId } = within(container);

    expect(getByTestId("chart")).toBeInTheDocument();
  });

  it("uses custom valueFormatter", () => {
    const valueFormatter = vi.fn((value: number) => `$${value}`);
    const { container } = render(<Chart data={sampleData} valueFormatter={valueFormatter} />);
    const { getByTestId } = within(container);

    expect(getByTestId("chart")).toBeInTheDocument();
  });

  it("uses default formatters when not provided", () => {
    const { container } = render(<Chart data={sampleData} />);
    const { getByTestId } = within(container);

    expect(getByTestId("chart")).toBeInTheDocument();
  });

  it("renders area chart as default type", () => {
    const { container } = render(<Chart data={sampleData} type={undefined} />);
    const { getByTestId } = within(container);

    expect(getByTestId("chart")).toBeInTheDocument();
    expect(container.querySelector(".recharts-responsive-container")).toBeInTheDocument();
  });

  it("renders with default height when not provided", () => {
    const { container } = render(<Chart data={sampleData} height={undefined} />);
    const { getByTestId } = within(container);

    const chartElement = getByTestId("chart");
    expect(chartElement).toBeInTheDocument();
  });

  it("renders with default color when not provided", () => {
    const { container } = render(<Chart data={sampleData} color={undefined} />);
    const { getByTestId } = within(container);

    expect(getByTestId("chart")).toBeInTheDocument();
  });

  // Direct tests for ChartTooltip to cover all branches
  // The condition is: !active || !payload?.length || label === undefined
  // We need to test all branch combinations

  it("should return null when active is false (first branch)", () => {
    const { container } = render(
      <ChartTooltip
        active={false}
        payload={[{ value: 50 }]}
        label="Mon"
        labelFormatter={(l) => l}
        valueFormatter={(v) => v.toString()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("should return null when payload is empty array (second branch)", () => {
    const { container } = render(
      <ChartTooltip
        active={true}
        payload={[]}
        label="Mon"
        labelFormatter={(l) => l}
        valueFormatter={(v) => v.toString()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("should return null when payload is null (second branch)", () => {
    const { container } = render(
      <ChartTooltip
        active={true}
        payload={null}
        label="Mon"
        labelFormatter={(l) => l}
        valueFormatter={(v) => v.toString()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("should return null when payload is undefined (second branch)", () => {
    const { container } = render(
      <ChartTooltip
        active={true}
        payload={undefined}
        label="Mon"
        labelFormatter={(l) => l}
        valueFormatter={(v) => v.toString()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("should return null when label is undefined (third branch)", () => {
    const { container } = render(
      <ChartTooltip
        active={true}
        payload={[{ value: 50 }]}
        label={undefined}
        labelFormatter={(l) => l}
        valueFormatter={(v) => v.toString()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("should render tooltip when all conditions are met", () => {
    const { container } = render(
      <ChartTooltip
        active={true}
        payload={[{ value: 50 }]}
        label="Mon"
        labelFormatter={(l) => l}
        valueFormatter={(v) => v.toString()}
      />,
    );
    expect(container.firstChild).not.toBeNull();
    expect(container.firstChild).toHaveTextContent("Mon");
    expect(container.firstChild).toHaveTextContent("50");
  });

  it("should use custom formatters when rendering", () => {
    const labelFormatter = vi.fn((label: string) => `Custom: ${label}`);
    const valueFormatter = vi.fn((value: number) => `$${value}`);
    const { container } = render(
      <ChartTooltip
        active={true}
        payload={[{ value: 50 }]}
        label="Mon"
        labelFormatter={labelFormatter}
        valueFormatter={valueFormatter}
      />,
    );
    expect(container.firstChild).toHaveTextContent("Custom: Mon");
    expect(container.firstChild).toHaveTextContent("$50");
    expect(labelFormatter).toHaveBeenCalledWith("Mon");
    expect(valueFormatter).toHaveBeenCalledWith(50);
  });
});
