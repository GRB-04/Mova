// Butterworth 2ª ordem, fs = 50 Hz, corte 0,25 Hz.
// Coeficientes do porte Guardian (gerados pelo mkfilter de A.J. Fisher).
// ATENÇÃO: só valem para 50 Hz. Mudou a taxa, recalcule.

const LPF_GAIN = 4.143204922e3;
const HPF_GAIN = 1.022463023;
const F0 = -0.9565436765;
const F1 = 1.9555782403;

abstract class Biquad {
  protected xv = [0, 0, 0];
  protected yv = [0, 0, 0];
  private primed = false;
  /** primeOnFirst=false reproduz o Guardian literal (estado zerado, com transitório de ~8 s). */
  constructor(private readonly primeOnFirst = true) {}

  /** Inicializa o estado em regime permanente para a entrada constante `x` (evita o transitório de partida). */
  protected abstract prime(x: number): void;
  protected abstract step(x: number): number;

  apply(x: number): number {
    if (!this.primed && this.primeOnFirst) this.prime(x);
    this.primed = true;
    return this.step(x);
  }

  reset(): void {
    this.xv = [0, 0, 0];
    this.yv = [0, 0, 0];
    this.primed = false;
  }
}

export class LowPass50 extends Biquad {
  protected prime(x: number): void {
    this.xv = [x / LPF_GAIN, x / LPF_GAIN, x / LPF_GAIN];
    this.yv = [x, x, x];
  }
  protected step(x: number): number {
    const { xv, yv } = this;
    xv[0] = xv[1];
    xv[1] = xv[2];
    xv[2] = x / LPF_GAIN;
    yv[0] = yv[1];
    yv[1] = yv[2];
    yv[2] = xv[0] + xv[2] + 2 * xv[1] + F0 * yv[0] + F1 * yv[1];
    return yv[2];
  }
}

export class HighPass50 extends Biquad {
  protected prime(x: number): void {
    this.xv = [x / HPF_GAIN, x / HPF_GAIN, x / HPF_GAIN];
    this.yv = [0, 0, 0];
  }
  protected step(x: number): number {
    const { xv, yv } = this;
    xv[0] = xv[1];
    xv[1] = xv[2];
    xv[2] = x / HPF_GAIN;
    yv[0] = yv[1];
    yv[1] = yv[2];
    yv[2] = xv[0] + xv[2] - 2 * xv[1] + F0 * yv[0] + F1 * yv[1];
    return yv[2];
  }
}
