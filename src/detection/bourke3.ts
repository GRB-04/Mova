// ─────────────────────────────────────────────
// A2 — Bourke et al. 2010, "Bourke3": VELOCITY + IMPACT + POSTURE
// Bourke AK, et al. J Biomech 2010;43(15):3051-3057.
// Especificação: Bagalà et al. 2012 (PLoS ONE). Não há implementação aberta conhecida.
// Ver docs/ALGORITMOS.md para o status de cada parâmetro.
// ─────────────────────────────────────────────
import { Detector, FallEvent, G_MS2, Sample, Vec3, norm, unit } from "./types";
import { LinearResampler } from "./resample";

export type Bourke3Options = {
  /** Taxa interna (⚠️ o original não foi confirmado; Bagalà cita 50–250 Hz). */
  fs: number;
  /** Aplica os tempos de borda (600 ms / 350 ms). */
  useEdgeTimes: boolean;
  /** 'last-1g-crossing': integra desde o último cruzamento de 1 g para baixo (máx. 1 s). 'fixed-1s': janela fixa de 1 s. */
  velocityWindow: "last-1g-crossing" | "fixed-1s";
  name?: string;
};

export const BOURKE3_DEFAULTS: Bourke3Options = {
  fs: 100,
  useEdgeTimes: true,
  velocityWindow: "last-1g-crossing",
};

const LFT = 0.65; // g
const UFT = 2.8; // g
const FALLING_EDGE_MAX = 0.6; // s
const RISING_EDGE_MAX = 0.35; // s
const VEL_THRESHOLD = -0.7; // m/s
const VEL_MAX_WINDOW = 1.0; // s
const POSTURE_FROM = 1.0; // s após o impacto
const POSTURE_TO = 3.0; // s após o impacto
const POSTURE_ANGLE = 60; // graus
const POSTURE_FRACTION = 0.75;
const GRAVITY_AVG_S = 0.5; // média móvel para estimar o vetor gravidade (⚠️)
const REFRACTORY_REJECTED = 0.5; // s (⚠️)
const HISTORY_S = 2.0; // histórico guardado para bordas e velocidade

type Hist = { t: number; sv: number };

export class Bourke3Detector implements Detector {
  readonly name: string;
  readonly opts: Bourke3Options;
  stages: Record<string, number> = {};

  private rs: LinearResampler;
  private hist: Hist[] = [];
  private gWin: Vec3[] = [];
  private gSum: Vec3 = [0, 0, 0];
  private gRef: Vec3 = [0, 0, 1];
  private svPrev = NaN;
  private lastDown = NaN; // último cruzamento de LFT para baixo
  private lastUp = NaN; // último cruzamento de LFT para cima
  private lastDownAtUp = NaN; // valor de lastDown no momento do último cruzamento para cima
  private blockedUntil = -Infinity;
  private pending: { tImp: number; vMin: number; tDown: number; tUp: number; peak: number; nIn: number; nLying: number } | null = null;

  constructor(opts: Partial<Bourke3Options> = {}) {
    this.opts = { ...BOURKE3_DEFAULTS, ...opts };
    this.name = this.opts.name ?? "bourke3";
    this.rs = new LinearResampler(this.opts.fs);
    this.reset();
  }

  setUpReference(g: Vec3): void {
    this.gRef = unit(g);
  }

  reset(): void {
    this.rs.reset();
    this.hist = [];
    this.gWin = [];
    this.gSum = [0, 0, 0];
    this.svPrev = NaN;
    this.lastDown = NaN;
    this.lastUp = NaN;
    this.lastDownAtUp = NaN;
    this.blockedUntil = -Infinity;
    this.pending = null;
    this.stages = { impact: 0, edgeOK: 0, velocityOK: 0, lying: 0, alarm: 0 };
  }

  push(s: Sample): FallEvent[] {
    const out: FallEvent[] = [];
    for (const r of this.rs.push(s)) {
      const e = this.step(r);
      if (e) out.push(e);
    }
    return out;
  }

  private step(s: Sample): FallEvent | null {
    const sv = norm(s.ax, s.ay, s.az);
    const dt = 1 / this.opts.fs;

    // Vetor gravidade: média móvel de 0,5 s
    const a: Vec3 = [s.ax, s.ay, s.az];
    this.gWin.push(a);
    for (let i = 0; i < 3; i++) this.gSum[i] += a[i];
    if (this.gWin.length > Math.round(GRAVITY_AVG_S * this.opts.fs)) {
      const old = this.gWin.shift()!;
      for (let i = 0; i < 3; i++) this.gSum[i] -= old[i];
    }

    this.hist.push({ t: s.t, sv });
    while (this.hist.length && this.hist[0].t < s.t - HISTORY_S) this.hist.shift();

    // Cruzamentos de LFT
    if (this.svPrev >= LFT && sv < LFT) this.lastDown = s.t;
    if (this.svPrev < LFT && sv >= LFT) {
      this.lastUp = s.t;
      this.lastDownAtUp = this.lastDown;
    }

    let ev: FallEvent | null = null;

    // Postura do candidato pendente: fração de [t+1, t+3] com ângulo > 60°
    if (this.pending) {
      const p = this.pending;
      const rel = s.t - p.tImp;
      if (rel >= POSTURE_FROM - 1e-9 && rel <= POSTURE_TO + 1e-9) {
        const n = this.gWin.length;
        const g: Vec3 = [this.gSum[0] / n, this.gSum[1] / n, this.gSum[2] / n];
        const gu = unit(g);
        const cos = gu[0] * this.gRef[0] + gu[1] * this.gRef[1] + gu[2] * this.gRef[2];
        const ang = (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
        p.nIn++;
        if (ang > POSTURE_ANGLE) p.nLying++;
      }
      if (rel >= POSTURE_TO - 1e-9) {
        const frac = p.nIn ? p.nLying / p.nIn : 0;
        if (frac > POSTURE_FRACTION) {
          this.stages.lying++;
          this.stages.alarm++;
          ev = {
            t: s.t,
            algorithm: this.name,
            details: {
              tImpact: round(p.tImp),
              peakSV: round(p.peak),
              vMin: round(p.vMin),
              fallingEdge: round(p.tImp - p.tDown),
              risingEdge: round(p.tImp - p.tUp),
              lyingFraction: round(frac),
            },
          };
        }
        this.pending = null;
      } else if (sv > p.peak) {
        p.peak = sv;
      }
    }

    // Novo candidato: SV cruza UFT para cima
    if (!this.pending && s.t >= this.blockedUntil && this.svPrev <= UFT && sv > UFT) {
      this.stages.impact++;
      const tImp = s.t;
      const tUp = this.lastUp;
      const tDown = this.lastDownAtUp;
      const edgeOK =
        !this.opts.useEdgeTimes ||
        (!Number.isNaN(tUp) && !Number.isNaN(tDown) && tImp - tDown <= FALLING_EDGE_MAX && tImp - tUp <= RISING_EDGE_MAX);
      if (edgeOK) this.stages.edgeOK++;

      const vMin = this.velocityMin(tImp, tDown, dt);
      const velOK = vMin <= VEL_THRESHOLD;
      if (edgeOK && velOK) {
        this.stages.velocityOK++;
        this.pending = { tImp, vMin, tDown, tUp, peak: sv, nIn: 0, nLying: 0 };
        this.blockedUntil = tImp + POSTURE_TO;
      } else {
        this.blockedUntil = tImp + REFRACTORY_REJECTED;
      }
    }

    this.svPrev = sv;
    return ev;
  }

  /** Mínimo da integral de (SV − 1 g)·g·dt entre o início da janela e o impacto (inclusive). */
  private velocityMin(tImp: number, tDown: number, dt: number): number {
    const h = this.hist;
    let iStart = 0;
    const tMin = tImp - VEL_MAX_WINDOW;
    if (this.opts.velocityWindow === "fixed-1s") {
      iStart = h.findIndex((x) => x.t >= tMin - 1e-9);
    } else {
      // último cruzamento de 1 g para baixo antes do início da queda (tDown), limitado a 1 s antes do impacto
      const ref = Number.isNaN(tDown) ? tImp : tDown;
      iStart = -1;
      for (let i = h.length - 1; i > 0; i--) {
        if (h[i].t > ref) continue;
        if (h[i - 1].sv >= 1 && h[i].sv < 1) {
          iStart = i;
          break;
        }
      }
      const iFloor = h.findIndex((x) => x.t >= tMin - 1e-9);
      if (iStart < iFloor) iStart = iFloor;
    }
    if (iStart < 0) iStart = 0;
    let v = 0;
    let vMin = 0;
    for (let i = iStart; i < h.length && h[i].t <= tImp + 1e-9; i++) {
      v += (h[i].sv - 1) * G_MS2 * dt;
      if (v < vMin) vMin = v;
    }
    return vMin;
  }
}

function round(x: number): number {
  return Math.round(x * 1000) / 1000;
}
