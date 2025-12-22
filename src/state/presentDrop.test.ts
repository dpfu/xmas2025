import { describe, expect, it } from "vitest";
import { computeLanding, type TreeMetrics } from "./presentDrop";
import { DROP } from "../config/tuning";

describe("computeLanding", () => {
  it("offsets from tree center and uses ground Y", () => {
    const metrics: TreeMetrics = {
      treeBounds: {
        center: { x: 1, y: 2, z: -3 },
        size: { x: 2, y: 4, z: 6 },
      },
      stage: { groundY: 0.5, treeX: 0, treeZ: 0 },
    };

    const landing = computeLanding(metrics);
    expect(landing.x).toBeCloseTo(1 + 2 * DROP.landingOffset.x);
    expect(landing.z).toBeCloseTo(-3 + 6 * DROP.landingOffset.z);
    expect(landing.y).toBeCloseTo(0.5 + DROP.landingYOffset);
  });
});
