// ─────────────────────────────────────────────
// A1 — Kangas et al. 2008, algoritmo 2: START OF FALL + IMPACT + POSTURE
// Kangas M, et al. Gait & Posture 2008;28(2):285-291. doi:10.1016/j.gaitpost.2008.01.003
// Especificação: Bagalà et al. 2012 (PLoS ONE) + porte Guardian (MIT, Detector.kt).
// Ver docs/ALGORITMOS.md para o status de cada parâmetro.
// ─────────────────────────────────────────────
import { Detector, FallEvent, Sample, Vec3, norm, unit } from "./types";
import { LinearResampler } from "./resample";
import { HighPass50, LowPass50 } from "./filters";

export type KangasImpactSignal = "SVTOT" | "SVD" | "SVMAXMIN" | "Z2";

export type KangasOptions = {
  /** 'faithful': componente do LPF ao longo de u_up (calibrado em pé). 'guardian': eixo z do aparelho (porte Guardian). */
  postureMode: "faithful" | "guardian";
  /** Sinais de impacto combinados com OU. Padrão = os 4 (como no Guardian). */
  impactSignals: KangasImpactSignal[];
  /** Inicializa filtros em regime permanente na 1ª amostra (adaptação ⚠️). false = Guardian literal. */
  primeFilters: boolean;
  /** Alarmes ignorados até `warmupS` após a 1ª amostra (só faz sentido com primeFilters=false). */
  warmupS: number;
  /** Período refratário após alarme (⚠️). */
  refractoryS: number;
  /** Nome customizado (para variantes no replay). */
  name?: string;
};

export const KANGAS_DEFAULTS: KangasOptions = {
  postureMode: "faithful",
  impactSignals: ["SVTOT", "SVD", "SVMAXMIN", "Z2"],
  primeFilters: true,
  warmupS: 0,
  refractoryS: 10,
};

// Parâmetros (Bagalà 2012 + Guardian). fs fixa em 50 Hz: os filtros só valem nessa taxa.
const FS = 50;
const FALL_SVTOT = 0.6; // g, início da queda
const IMPACT_SVTOT = 2.0; // g
const IMPACT_SVD = 1.7; // g
const IMPACT_SVMAXMIN = 2.0; // g
const IMPACT_Z2 = 1.5; // g
const SPAN_MAXMIN = 5; // amostras (0,1 s)
const SPAN_FALLING = 50; // amostras (1 s) — janela para achar o impacto
const SPAN_IMPACT = 100; // amostras (2 s) — postura após o ÚLTIMO impacto
const SPAN_AVG = 20; // amostras (0,4 s) — média da postura
const LYING_MAX = 0.5; // g — deitado se componente vertical média ≤ 0,5 g

export class KangasDetector implements Detector {
  readonly name: string;
  readonly opts: KangasOptions;
  stages: Record<string, number> = {};

  private rs = new LinearResampler(FS);
  private lpf: LowPass50[] = [];
  private hpf: HighPass50[] = [];
  private uUp: Vec3 = [0, 0, 1];
  private raw: Vec3[] = []; // últimas SPAN_MAXMIN amostras brutas
  private vert: number[] = []; // últimas SPAN_AVG componentes verticais do LPF
  private svPrev = NaN;
  private fallTimer = -1;
  private impactTimer = -1;
  private lastAlarm = -Infinity;
  private tFirst = NaN;
  private tFallStart = NaN;
  private peak = { svtot: 0, svd: 0, svmaxmin: 0, z2: 0 };

  constructor(opts: Partial<KangasOptions> = {}) {
    this.opts = { ...KANGAS_DEFAULTS, ...opts };
    this.name = this.opts.name ?? `kangas-${this.opts.postureMode}`;
    this.reset();
  }

  setUpReference(g: Vec3): void {
    this.uUp = unit(g);
  }

  reset(): void {
    this.rs.reset();
    this.lpf = [0, 1, 2].map(() => new LowPass50(this.opts.primeFilters));
    this.hpf = [0, 1, 2].map(() => new HighPass50(this.opts.primeFilters));
    this.raw = [];
    this.vert = [];
    this.svPrev = NaN;
    this.fallTimer = -1;
    this.impactTimer = -1;
    this.lastAlarm = -Infinity;
    this.tFirst = NaN;
    this.stages = { fallStart: 0, impact: 0, postureCheck: 0, lying: 0, alarm: 0 };
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
    if (Number.isNaN(this.tFirst)) this.tFirst = s.t;
    if (this.fallTimer > -1) this.fallTimer--;
    if (this.impactTimer > -1) this.impactTimer--;

    const a: Vec3 = [s.ax, s.ay, s.az];
    const L = a.map((v, i) => this.lpf[i].apply(v)) as Vec3;
    const H = a.map((v, i) => this.hpf[i].apply(v)) as Vec3;

    this.raw.push(a);
    if (this.raw.length > SPAN_MAXMIN) this.raw.shift();
    const range = [0, 1, 2].map((i) => {
      let mn = Infinity;
      let mx = -Infinity;
      for (const r of this.raw) {
        mn = Math.min(mn, r[i]);
        mx = Math.max(mx, r[i]);
      }
      return mx - mn;
    });

    const svtot = norm(a[0], a[1], a[2]);
    const svd = norm(H[0], H[1], H[2]);
    const svmaxmin = norm(range[0], range[1], range[2]);
    const z2 = (svtot * svtot - svd * svd - 1) / 2;

    const v =
      this.opts.postureMode === "guardian"
        ? L[2]
        : L[0] * this.uUp[0] + L[1] * this.uUp[1] + L[2] * this.uUp[2];
    this.vert.push(v);
    if (this.vert.length > SPAN_AVG) this.vert.shift();

    // 1. Início da queda: SV_TOT cruza para baixo de 0,6 g
    if (this.svPrev >= FALL_SVTOT && svtot < FALL_SVTOT) {
      this.fallTimer = SPAN_FALLING;
      this.tFallStart = s.t;
      this.stages.fallStart++;
    }

    // 2. Impacto em até 1 s; re-arma a cada amostra acima do limiar
    if (this.fallTimer > -1) {
      const sig = this.opts.impactSignals;
      const hit =
        (sig.includes("SVTOT") && svtot >= IMPACT_SVTOT) ||
        (sig.includes("SVD") && svd >= IMPACT_SVD) ||
        (sig.includes("SVMAXMIN") && svmaxmin >= IMPACT_SVMAXMIN) ||
        (sig.includes("Z2") && z2 >= IMPACT_Z2);
      if (hit) {
        if (this.impactTimer === -1) {
          this.stages.impact++;
          this.peak = { svtot: 0, svd: 0, svmaxmin: 0, z2: 0 };
        }
        this.impactTimer = SPAN_IMPACT;
        this.peak.svtot = Math.max(this.peak.svtot, svtot);
        this.peak.svd = Math.max(this.peak.svd, svd);
        this.peak.svmaxmin = Math.max(this.peak.svmaxmin, svmaxmin);
        this.peak.z2 = Math.max(this.peak.z2, z2);
      }
    }

    // 3. Postura 2 s após o último impacto
    let ev: FallEvent | null = null;
    if (this.impactTimer === 0) {
      this.stages.postureCheck++;
      const m = this.vert.reduce((acc, x) => acc + x, 0) / this.vert.length;
      const lying = this.opts.postureMode === "guardian" ? m > LYING_MAX : m <= LYING_MAX;
      if (lying) {
        this.stages.lying++;
        const warm = s.t - this.tFirst >= this.opts.warmupS;
        if (warm && s.t - this.lastAlarm >= this.opts.refractoryS) {
          this.stages.alarm++;
          this.lastAlarm = s.t;
          ev = {
            t: s.t,
            algorithm: this.name,
            details: {
              tFallStart: round(this.tFallStart),
              postureMean: round(m),
              peakSVTOT: round(this.peak.svtot),
              peakSVD: round(this.peak.svd),
              peakSVMAXMIN: round(this.peak.svmaxmin),
              peakZ2: round(this.peak.z2),
            },
          };
        }
      }
    }

    this.svPrev = svtot;
    return ev;
  }
}

function round(x: number): number {
  return Math.round(x * 1000) / 1000;
}
