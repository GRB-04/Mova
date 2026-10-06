import { describe, expect, it } from "vitest";
import { PiptoDetector, piptoOffline } from "../pipto";
import { LYING, mag, run, still, synth } from "./synth";

const G = 9.807;

describe("PIPTO (A3)", () => {
  const fall = (fs: number) => synth([still(5), mag(0.4, 0.3), mag(0.04, 4), still(6, LYING)], fs);

  it("offline: 1 g constante, sem queda", () => {
    const s = synth([still(15)], 50);
    const r = piptoOffline(s.map(() => G), s.map((x) => x.t), 50);
    expect(r.falls).toHaveLength(0);
  });

  it("offline: queda livre + impacto + repouso, 1 queda", () => {
    const s = fall(50);
    const v = s.map((x) => Math.hypot(x.ax, x.ay, x.az) * G);
    const r = piptoOffline(v, s.map((x) => x.t), 50);
    expect(r.falls).toHaveLength(1);
  });

  it("offline: impacto sem queda livre, sem queda", () => {
    const s = synth([still(5), mag(0.04, 4), still(6)], 50);
    const v = s.map((x) => Math.hypot(x.ax, x.ay, x.az) * G);
    expect(piptoOffline(v, s.map((x) => x.t), 50).falls).toHaveLength(0);
  });

  it("streaming: 1 alarme, ~2 s após o impacto", () => {
    const ev = run(new PiptoDetector(), fall(50));
    expect(ev).toHaveLength(1);
    expect(Number(ev[0].details!.tImpact)).toBeCloseTo(5.4, 1);
  });

  it("streaming: 1 g constante, sem alarme", () => {
    expect(run(new PiptoDetector(), synth([still(30)], 50))).toHaveLength(0);
  });
});
