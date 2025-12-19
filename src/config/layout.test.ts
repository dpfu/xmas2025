// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { getLayoutMode } from "./layout";

describe("getLayoutMode", () => {
  it("returns portrait when height is larger", () => {
    Object.defineProperty(window, "innerWidth", { value: 600, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 900, configurable: true });
    expect(getLayoutMode()).toBe("portrait");
  });

  it("returns landscape when width is larger", () => {
    Object.defineProperty(window, "innerWidth", { value: 1200, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 700, configurable: true });
    expect(getLayoutMode()).toBe("landscape");
  });
});
