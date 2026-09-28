import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HelpLabel } from "./ui";

vi.mock("./app-provider", () => ({ useApp: () => ({ locale: "cs" }) }));

afterEach(cleanup);

describe("field help", () => {
  function renderHelp() {
    render(<label><HelpLabel label="Úloha" helpKey="field.agentTask" /><textarea /></label>);
    return screen.getByRole("button", { name: "Více informací: Úloha agenta" });
  }

  it("preserves the enclosing field label when opening help", () => {
    const help = renderHelp();
    const field = screen.getByRole("textbox", { name: /^Úloha/ });
    fireEvent.click(help);
    expect(screen.getByRole("textbox", { name: /^Úloha/ })).toBe(field);
    expect(help).toHaveFocus();
    expect(field).not.toHaveFocus();
  });

  it("keeps activated help open through compatibility mouse events after a tap", () => {
    const help = renderHelp();
    fireEvent.click(help);
    fireEvent.mouseEnter(help);
    fireEvent.mouseLeave(help);
    expect(screen.getByRole("tooltip")).toBeVisible();
    expect(help).toHaveAttribute("aria-expanded", "true");
    expect(help).toHaveAttribute("aria-describedby", screen.getByRole("tooltip").id);
  });
});
