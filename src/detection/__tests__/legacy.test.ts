import { describe, expect, it } from "vitest";
import { LegacyDetector } from "../legacy";
import { mag, run, still, synth } from "./synth";

describe("Mova legado (A0)", () => {
  it("1 g constante: sem alarme", () => {
    expect(run(new LegacyDetector(), synth([still(30)], 50))).toHaveLength(0);
  });

  it("qualquer pico > 2,5 g vira alarme, mesmo sem queda livre nem postura", () => {
    expect(run(new LegacyDetector(), synth([still(5), mag(0.2, 3), still(5)], 50))).toHaveLength(1);
  });
});
