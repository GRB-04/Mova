import { describe, expect, it } from "vitest";
import { GRACE_S, TrialRecord, classifyActivity, summarize, trialHit, wilson } from "../scoring";

describe("pontuação das tentativas", () => {
  it("classifica atividades", () => {
    expect(classifyActivity("queda frente")).toBe("queda");
    expect(classifyActivity("celular caiu no chão")).toBe("adl");
    expect(classifyActivity("uso livre")).toBe("livre");
  });

  it("queda: alarme dentro da tentativa (até GRACE_S depois de parar) conta", () => {
    const w = { kind: "queda" as const, tStart: 0, tEnd: 10, markers: [8] };
    expect(trialHit(w, [9.5])).toBe(true);
    expect(trialHit(w, [10 + GRACE_S - 0.1])).toBe(true);
    expect(trialHit(w, [-0.5])).toBe(false);
  });

  it("ADL: alarme até GRACE_S depois de parar ainda é falso alarme", () => {
    const w = { kind: "adl" as const, tStart: 0, tEnd: 10, markers: [] };
    expect(trialHit(w, [10 + GRACE_S - 0.1])).toBe(true);
    expect(trialHit(w, [10 + GRACE_S + 0.1])).toBe(false);
  });

  it("resume sensibilidade, alarmes falsos e alarmes/hora", () => {
    const base = { createdAt: 0, sessionId: "s", volunteer: "V1", position: "cinto", platform: "android" };
    const trials: TrialRecord[] = [
      { ...base, id: "1", activity: "queda frente", kind: "queda", durationS: 10, hit: { a: true }, nAlarms: { a: 1 } },
      { ...base, id: "2", activity: "queda trás", kind: "queda", durationS: 10, hit: { a: false }, nAlarms: { a: 0 } },
      { ...base, id: "3", activity: "pular", kind: "adl", durationS: 10, hit: { a: true }, nAlarms: { a: 2 } },
      { ...base, id: "4", activity: "uso livre", kind: "livre", durationS: 7200, hit: { a: true }, nAlarms: { a: 3 } },
    ];
    const [s] = summarize(trials, ["a"]);
    expect(s.falls.rate).toBe(0.5);
    expect(s.falseAlarms.rate).toBe(1);
    expect(s.free.perHour).toBe(1.5);
  });

  it("Wilson 95% para 8/10", () => {
    const [lo, hi] = wilson(8, 10);
    expect(lo).toBeCloseTo(0.49, 2);
    expect(hi).toBeCloseTo(0.943, 2);
  });
});
