import { describe, expect, it } from "vitest";
import { KangasDetector } from "../kangas";
import { LYING, UP, mag, run, still, synth } from "./synth";

const FS = 50;

describe("Kangas (A1)", () => {
  const det = () => new KangasDetector({ postureMode: "faithful" });

  it("1 g constante por 30 s: sem alarme", () => {
    expect(run(det(), synth([still(30)], FS))).toHaveLength(0);
  });

  it("queda livre 0,3 g + pico 3 g + deitado 5 s: 1 alarme", () => {
    const s = synth([still(10), mag(0.3, 0.3), mag(0.06, 3), still(5, LYING)], FS);
    const ev = run(det(), s);
    expect(ev).toHaveLength(1);
    expect(ev[0].t).toBeGreaterThan(10.3);
    expect(ev[0].t).toBeLessThan(13);
  });

  it("mesmo sinal, mas volta a ficar em pé: sem alarme", () => {
    const s = synth([still(10), mag(0.3, 0.3), mag(0.06, 3), still(5, UP)], FS);
    expect(run(det(), s)).toHaveLength(0);
  });

  it("pico de 3 g sem queda livre antes: sem alarme", () => {
    const s = synth([still(10), mag(0.06, 3), still(5, LYING)], FS);
    expect(run(det(), s)).toHaveLength(0);
  });

  it("modo guardian: deitado = eixo z do LPF > 0,5 g", () => {
    const d = new KangasDetector({ postureMode: "guardian" });
    // celular em pé na cintura (gravidade no eixo y), cai e fica de face para cima (gravidade em z)
    const s = synth([still(10, [0, 1, 0]), mag(0.3, 0.3, [0, 1, 0]), mag(0.06, 3, [0, 1, 0]), still(5, [0, 0, 1])], FS);
    expect(run(d, s)).toHaveLength(1);
  });

  it("taxa de entrada irregular (~66 Hz) é reamostrada para 50 Hz", () => {
    const s = synth([still(10), mag(0.3, 0.3), mag(0.06, 3), still(5, LYING)], 66);
    expect(run(det(), s)).toHaveLength(1);
  });
});
