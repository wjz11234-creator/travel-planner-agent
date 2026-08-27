import { describe, expect, it } from "vitest";
import { agentLabel } from "./agents";

describe("agentLabel", () => {
  it("maps known expert ids", () => {
    expect(agentLabel("guide")).toBe("Guide");
    expect(agentLabel("supervisor")).toBe("Supervisor");
    expect(agentLabel("planner")).toBe("Planner");
  });

  it("returns empty for missing id and passthrough for unknown", () => {
    expect(agentLabel(null)).toBe("");
    expect(agentLabel(undefined)).toBe("");
    expect(agentLabel("revise")).toBe("revise");
  });
});
