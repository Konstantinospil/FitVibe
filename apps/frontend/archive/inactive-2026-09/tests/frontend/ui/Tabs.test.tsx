import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../src/components/ui/Tabs";

function ExampleTabs({
  value,
  onValueChange,
}: {
  value?: string;
  onValueChange?: (value: string) => void;
}) {
  return (
    <Tabs defaultValue="profile" value={value} onValueChange={onValueChange}>
      <TabsList>
        <TabsTrigger value="profile">Profile</TabsTrigger>
        <TabsTrigger value="security">Security</TabsTrigger>
      </TabsList>
      <TabsContent value="profile">Profile panel</TabsContent>
      <TabsContent value="security">Security panel</TabsContent>
    </Tabs>
  );
}

describe("Tabs", () => {
  it("shows the default tab content", () => {
    render(<ExampleTabs />);
    expect(screen.getByRole("tab", { name: "Profile" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Profile panel")).toBeInTheDocument();
    expect(screen.queryByText("Security panel")).not.toBeInTheDocument();
  });

  it("switches tabs on click and keyboard", () => {
    const onValueChange = vi.fn();
    render(<ExampleTabs onValueChange={onValueChange} />);

    fireEvent.click(screen.getByRole("tab", { name: "Security" }));
    expect(onValueChange).toHaveBeenCalledWith("security");
    expect(screen.getByText("Security panel")).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole("tab", { name: "Profile" }), { key: "Enter" });
    expect(onValueChange).toHaveBeenCalledWith("profile");

    fireEvent.keyDown(screen.getByRole("tab", { name: "Security" }), { key: " " });
    expect(onValueChange).toHaveBeenCalledWith("security");
  });

  it("supports controlled values without updating internal state", () => {
    const onValueChange = vi.fn();
    render(<ExampleTabs value="security" onValueChange={onValueChange} />);

    expect(screen.getByText("Security panel")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Profile" }));
    expect(onValueChange).toHaveBeenCalledWith("profile");
    expect(screen.getByText("Security panel")).toBeInTheDocument();
  });

  it("throws when a trigger is used outside Tabs", () => {
    expect(() => render(<TabsTrigger value="x">X</TabsTrigger>)).toThrow(
      "TabsTrigger must be used within Tabs",
    );
  });

  it("throws when content is used outside Tabs", () => {
    expect(() => render(<TabsContent value="x">X</TabsContent>)).toThrow(
      "TabsContent must be used within Tabs",
    );
  });
});
