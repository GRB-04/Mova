import { Sample } from "./types";

/**
 * Reamostragem linear para uma grade uniforme (mesma estratégia do porte Guardian do Kangas).
 * A grade começa no instante da primeira amostra recebida: t0, t0+dt, t0+2dt, ...
 * Se a entrada já estiver nessa grade, a saída é idêntica à entrada.
 */
export class LinearResampler {
  private readonly dt: number;
  private prev: Sample | null = null;
  private k = 0;
  private t0 = 0;

  constructor(readonly fs: number) {
    this.dt = 1 / fs;
  }

  reset(): void {
    this.prev = null;
    this.k = 0;
  }

  /** Devolve as amostras da grade em (prev.t, s.t]. */
  push(s: Sample): Sample[] {
    if (!this.prev) {
      this.prev = s;
      this.t0 = s.t;
      this.k = 1;
      return [s];
    }
    const a = this.prev;
    const out: Sample[] = [];
    if (s.t <= a.t) return out; // amostra fora de ordem ou duplicada: descarta
    // tolerância de 1 µs para não perder pontos da grade por erro de ponto flutuante
    for (let tg = this.t0 + this.k * this.dt; tg <= s.t + 1e-6; tg = this.t0 + this.k * this.dt) {
      const w = (tg - a.t) / (s.t - a.t);
      out.push({
        t: tg,
        ax: a.ax + (s.ax - a.ax) * w,
        ay: a.ay + (s.ay - a.ay) * w,
        az: a.az + (s.az - a.az) * w,
      });
      this.k++;
    }
    this.prev = s;
    return out;
  }
}
