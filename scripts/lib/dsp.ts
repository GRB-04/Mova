// DSP para simular o acelerômetro do celular a partir de bases de 200 Hz.
import { Sample } from "../../src/detection/types";

/** Biquad passa-baixa (RBJ cookbook), Q = 1/√2 (Butterworth). */
class LowpassBiquad {
  private b0: number;
  private b1: number;
  private b2: number;
  private a1: number;
  private a2: number;
  private x1 = 0;
  private x2 = 0;
  private y1 = 0;
  private y2 = 0;
  private primed = false;

  constructor(fc: number, fs: number, q = Math.SQRT1_2) {
    const w0 = (2 * Math.PI * fc) / fs;
    const alpha = Math.sin(w0) / (2 * q);
    const cos = Math.cos(w0);
    const a0 = 1 + alpha;
    this.b0 = (1 - cos) / 2 / a0;
    this.b1 = (1 - cos) / a0;
    this.b2 = (1 - cos) / 2 / a0;
    this.a1 = (-2 * cos) / a0;
    this.a2 = (1 - alpha) / a0;
  }

  apply(x: number): number {
    if (!this.primed) {
      // regime permanente para entrada constante x (ganho DC = 1)
      this.x1 = this.x2 = this.y1 = this.y2 = x;
      this.primed = true;
    }
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

/** Butterworth de 4ª ordem (duas seções com Q de Butterworth), causal. */
class Butter4 {
  private s1: LowpassBiquad;
  private s2: LowpassBiquad;
  constructor(fc: number, fs: number) {
    this.s1 = new LowpassBiquad(fc, fs, 0.5411961);
    this.s2 = new LowpassBiquad(fc, fs, 1.3065630);
  }
  apply(x: number): number {
    return this.s2.apply(this.s1.apply(x));
  }
}

export type PhoneSimOptions = {
  /** Taxa de origem (Hz). */
  fsIn: number;
  /** Taxa de destino (Hz); fsIn deve ser múltiplo. */
  fsOut: number;
  /** Corte do anti-aliasing (Hz). Padrão: 0,4·fsOut (20 Hz para 50 Hz). */
  cutoffHz?: number;
  /** Saturação por eixo em g (null = sem clip). */
  clipG: number | null;
};

/** Versão em fluxo (amostra a amostra) da simulação do celular; mantém o estado entre chamadas. */
export class PhoneSimStream {
  private readonly factor: number;
  private readonly f: Butter4[];
  private i = 0;
  constructor(private readonly o: PhoneSimOptions) {
    this.factor = Math.round(o.fsIn / o.fsOut);
    if (Math.abs(this.factor * o.fsOut - o.fsIn) > 1e-9) throw new Error(`fsIn ${o.fsIn} não é múltiplo de fsOut ${o.fsOut}`);
    const fc = o.cutoffHz ?? 0.4 * o.fsOut;
    this.f = [0, 1, 2].map(() => new Butter4(fc, o.fsIn));
  }
  /** Devolve a amostra decimada correspondente, ou null se ela foi descartada. */
  push(s: Sample): Sample | null {
    const ax = this.f[0].apply(s.ax);
    const ay = this.f[1].apply(s.ay);
    const az = this.f[2].apply(s.az);
    const keep = this.i % this.factor === 0;
    this.i++;
    if (!keep) return null;
    const c = this.o.clipG;
    const clip = (x: number) => (c == null ? x : Math.max(-c, Math.min(c, x)));
    return { t: s.t, ax: clip(ax), ay: clip(ay), az: clip(az) };
  }
}

/** Anti-aliasing (Butterworth 4ª ordem causal) + decimação + saturação. */
export function phoneSim(samples: Sample[], o: PhoneSimOptions): Sample[] {
  const st = new PhoneSimStream(o);
  const out: Sample[] = [];
  for (const s of samples) {
    const r = st.push(s);
    if (r) out.push(r);
  }
  return out;
}
