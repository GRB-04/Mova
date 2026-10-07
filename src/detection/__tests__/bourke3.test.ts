import { describe, expect, it } from "vitest";
import { Bourke3Detector } from "../bourke3";
import { LYING, UP, mag, run, still, synth } from "./synth";

const FS = 100;

describe("Bourke3 (A2)", () => {
  const det = () => new Bourke3Detector();

  it("1 g constante: sem alarme", () => {
    expect(run(det(), synth([still(30)], FS))).toHaveLength(0);
  });

  it("0,3 g por 0,35 s + pico 3,5 g + deitado: alarme", () => {
    const s = synth([still(5), mag(0.35, 0.3), mag(0.03, 3.5), still(5, LYING)], FS);
    const ev = run(det(), s);
    expect(ev).toHaveLength(1);
    expect(Number(ev[0].details!.vMin)).toBeLessThanOrEqual(-0.7);
  });

  it("mesmo sinal sem deitar: sem alarme", () => {
    const s = synth([still(5), mag(0.35, 0.3), mag(0.03, 3.5), still(5, UP)], FS);
    expect(run(det(), s)).toHaveLength(0);
  });

  it("0,3 g por mais de 0,6 s: sem alarme (tempos de borda)", () => {
    const s = synth([still(5), mag(0.7, 0.3), mag(0.03, 3.5), still(5, LYING)], FS);
    expect(run(det(), s)).toHaveLength(0);
    // sem os tempos de borda o mesmo sinal vira alarme
    expect(run(new Bourke3Detector({ useEdgeTimes: false }), s)).toHaveLength(1);
  });

  it("pico sem queda livre (velocidade ~0): sem alarme", () => {
    const s = synth([still(5), mag(0.03, 3.5), still(5, LYING)], FS);
    expect(run(new Bourke3Detector({ useEdgeTimes: false }), s)).toHaveLength(0);
  });
});
