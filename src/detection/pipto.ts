// ─────────────────────────────────────────────
// A3 — PIPTO: Moutsis SN, Tsintotas KA, Gasteratos A. Sensors 2023;23(18):7951. doi:10.3390/s23187951
// Porte linha a linha de python/def_fall.py (github.com/smoutsis/fall_detection_through_acceleration_data).
// `piptoOffline` reproduz o original (inclusive comportamentos não óbvios, marcados "QUIRK").
// `PiptoDetector` é a adaptação para tempo real (janela deslizante), declarada no artigo.
// ─────────────────────────────────────────────
import { Detector, FallEvent, Sample, norm } from "./types";
import { LinearResampler } from "./resample";

const G = 9.807; // valor usado pelos autores
const MIN_LIMIT = 6.5; // m/s²
const FALL_DURATION = 105; // unidades de "entry" (≈ 10 ms) → 1,05 s
const FALL_LIMITATION = 85; // → 0,85 s
const SUB_1 = 50; // → 0,5 s
const DIST_1 = 100;
const DIST_2 = 100;

export type PiptoResult = {
  /** Pares [entry_início, entry_impacto], como o `return new_fall` do Python. */
  falls: [number, number][];
  /** Pares de índices [início, impacto] (o `new_index` do Python). */
  indexes: [number, number][];
  /** Contadores por estágio (funil). */
  stages: Record<string, number>;
};

/** Média com o comportamento de `Average` do Python (0 se vazio). */
function average(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

/** np.std populacional; vazio → NaN (como numpy). */
function stdPop(xs: number[]): number {
  if (!xs.length) return NaN;
  const m = average(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) * (b - m), 0) / xs.length);
}

function max3(xs: number[]): number {
  return xs.length ? Math.max(...xs) : 0;
}

/** Acesso estilo Python (índice negativo conta do fim). */
function py<T>(arr: T[], i: number): T {
  return arr[i < 0 ? arr.length + i : i];
}

function findListsWithSameNumber(lst: [number, number][]): [number[][], number[][]] {
  const m0 = new Map<number, number[]>();
  const m1 = new Map<number, number[]>();
  lst.forEach(([n0, n1], i) => {
    if (!m0.has(n0)) m0.set(n0, []);
    m0.get(n0)!.push(i);
    if (!m1.has(n1)) m1.set(n1, []);
    m1.get(n1)!.push(i);
  });
  return [[...m0.values()].filter((x) => x.length > 1), [...m1.values()].filter((x) => x.length > 1)];
}

/**
 * Porte fiel de `fall_detection(df2, step2, hz)`.
 * @param v magnitudes em m/s² (com gravidade)
 * @param time instantes em segundos
 * @param hz taxa de amostragem
 */
export function piptoOffline(v: number[], time: number[], hz: number): PiptoResult {
  const stages = { low: 0, high: 0, paired: 0, afterDedupe: 0, afterDuration: 0, alarm: 0 };
  const empty = (): PiptoResult => ({ falls: [], indexes: [], stages });
  const n = v.length;

  const entry: number[] = [0];
  for (let i = 1; i < n; i++) entry.push((time[i] - time[i - 1]) / 10 + entry[i - 1] + 100 / hz);

  const vAvg = average(v);
  const maxLimit = Math.max(vAvg, 20) + 10;
  const maxLimit2 = maxLimit;

  const low: number[] = [];
  const high: number[] = [];
  for (let i = 0; i < n; i++) {
    if (v[i] < MIN_LIMIT) low.push(i);
    else if (v[i] > maxLimit) high.push(i);
  }
  stages.low = low.length ? 1 : 0;
  stages.high = high.length ? 1 : 0;
  if (!high.length || !low.length) return empty();

  const group = (idx: number[]): number[] => {
    const out = [idx[0]];
    for (let i = 1; i < idx.length; i++) {
      if (entry[idx[i]] - entry[idx[i - 1]] > SUB_1) {
        out.push(idx[i - 1], idx[i]);
      } else if (i === idx.length - 1) {
        out.push(idx[i]);
      }
    }
    if (out.length % 2 === 1) out.push(out[out.length - 1]);
    return out;
  };
  const newLow = group(low);
  const newHigh = group(high);

  const fall: [number, number][] = [];
  const index: [number, number][] = [];
  for (let i = 0; i < newLow.length; i += 2) {
    for (let j = 0; j < newHigh.length; j += 2) {
      const pairs: [number, number][] = [
        [newLow[i], newHigh[j + 1]],
        [newLow[i + 1], newHigh[j + 1]],
        [newLow[i], newHigh[j]],
        [newLow[i + 1], newHigh[j]],
      ];
      for (const [lo, hi] of pairs) {
        const d = entry[hi] - entry[lo];
        if (d < FALL_DURATION && d > 0) {
          fall.push([entry[lo], entry[hi]]);
          index.push([lo, hi]);
          break; // if/elif
        }
      }
    }
  }
  if (!fall.length) return empty();
  stages.paired = fall.length;

  // Conexões duplas: mantém a mais curta
  const toDel: number[] = [];
  const [same0, same1] = findListsWithSameNumber(fall);
  for (const groupIdx of [...same0, ...same1]) {
    for (let j = 1; j < groupIdx.length; j++) {
      const a = fall[groupIdx[j - 1]];
      const b = fall[groupIdx[j]];
      const sub1 = Math.abs(a[0] - a[1]);
      const sub2 = Math.abs(b[0] - b[1]);
      toDel.push(sub1 < sub2 ? groupIdx[j] : groupIdx[j - 1]);
    }
  }
  const del = new Set(toDel);
  let newIndex = index.filter((_, i) => !del.has(i)).map((x) => [...x] as [number, number]);
  let newFall = fall.filter((_, i) => !del.has(i)).map((x) => [...x] as [number, number]);
  stages.afterDedupe = newFall.length;

  // Check 1: queda longa → aproxima o início do impacto
  let indexx: number | undefined; // QUIRK: no Python a variável persiste entre iterações
  for (let i = 0; i < newIndex.length; i++) {
    if (Math.abs(newFall[i][1] - newFall[i][0]) > FALL_LIMITATION) {
      for (let j = newIndex[i][0]; j < newIndex[i][1]; j++) {
        if (v[j] < MIN_LIMIT && newIndex[i][1] - j > 5) indexx = j;
      }
      if (indexx === undefined) throw new Error("PIPTO: UnboundLocalError em indexx (comportamento do original)");
      if (indexx !== newIndex[i][0]) {
        newIndex[i][0] = indexx;
        newFall[i][0] = entry[indexx];
      }
    }
  }

  // Check 2: rejeita quedas longas
  const keep2 = newFall.map((f) => Math.abs(Math.abs(f[0]) - Math.abs(f[1])) < FALL_LIMITATION);
  newFall = newFall.filter((_, i) => keep2[i]);
  newIndex = newIndex.filter((_, i) => keep2[i]);
  stages.afterDuration = newFall.length;

  // Check 3: pico é o maior OU magnitudes após a queda ≈ g
  const fall3: [number, number][] = [];
  const index3: [number, number][] = [];
  const vAfterFall: number[] = []; // QUIRK: não é zerada entre candidatos
  for (let i = 0; i < newIndex.length; i++) {
    let maxV = 0;
    for (let j = newIndex[i][0] - 1; j < newIndex[i][1] + 1; j++) {
      const x = py(v, j); // QUIRK: j = -1 lê a última amostra
      if (x > maxV) maxV = x;
    }
    // QUIRK: as condições dos laços j1/j2 nunca mudam (t1 < início e t2 > fim sempre),
    // então j1 = 1 (ou 0) e j2 = n-1: o "contexto" é a gravação inteira.
    void DIST_1;
    void DIST_2;
    const j1 = newIndex[i][0] - 1 >= 1 ? 1 : 0;
    const j2 = n - 1;
    const high11: number[] = [];
    const high22: number[] = [];
    for (let j = j1; j < newIndex[i][0] - 1; j++) if (v[j] > maxLimit2) high11.push(v[j]);
    for (let j = newIndex[i][1] + 1; j < j2; j++) {
      if (Math.abs(entry[j] - newFall[i][1]) > 0.3) vAfterFall.push(v[j]);
      if (v[j] > maxLimit2) high22.push(v[j]);
    }
    const avgAfter = average(vAfterFall);
    const std = stdPop(vAfterFall);
    const still = avgAfter < G + 2 && avgAfter > G - 2 && std < 2 && vAfterFall.length > 20;
    if (still || maxV > Math.max(max3(high11), max3(high22))) {
      index3.push(newIndex[i]);
      fall3.push(newFall[i]);
    }
  }
  stages.alarm = fall3.length;
  return { falls: fall3, indexes: index3, stages };
}

// ─────────────────────────────────────────────
// Adaptação para tempo real (⚠️ declarar no artigo):
// o original usa a média da gravação INTEIRA (v_avg) e olha a gravação toda depois do impacto.
// Aqui: buffer deslizante de `windowS`; a cada `hopS` roda o original sobre o buffer;
// só aceita quedas cujo impacto tenha ocorrido há pelo menos `postS` (para existir dado pós-queda)
// e que não estejam a menos de `dedupS` de uma queda já emitida.
// ─────────────────────────────────────────────
export type PiptoOptions = {
  fs: number;
  windowS: number;
  hopS: number;
  postS: number;
  dedupS: number;
  name?: string;
};

export const PIPTO_DEFAULTS: PiptoOptions = { fs: 50, windowS: 10, hopS: 0.5, postS: 2, dedupS: 2 };

export class PiptoDetector implements Detector {
  readonly name: string;
  readonly opts: PiptoOptions;
  stages: Record<string, number> = {};
  private rs: LinearResampler;
  private v: number[] = [];
  private t: number[] = [];
  private lastRun = -Infinity;
  private emitted: number[] = [];

  constructor(opts: Partial<PiptoOptions> = {}) {
    this.opts = { ...PIPTO_DEFAULTS, ...opts };
    this.name = this.opts.name ?? "pipto-streaming";
    this.rs = new LinearResampler(this.opts.fs);
    this.reset();
  }

  reset(): void {
    this.rs.reset();
    this.v = [];
    this.t = [];
    this.lastRun = -Infinity;
    this.emitted = [];
    this.stages = { runs: 0, paired: 0, alarm: 0 };
  }

  push(s: Sample): FallEvent[] {
    const out: FallEvent[] = [];
    for (const r of this.rs.push(s)) {
      this.v.push(norm(r.ax, r.ay, r.az) * G);
      this.t.push(r.t);
      const maxN = Math.round(this.opts.windowS * this.opts.fs);
      if (this.v.length > maxN) {
        this.v.shift();
        this.t.shift();
      }
      if (r.t - this.lastRun >= this.opts.hopS - 1e-9 && this.v.length >= this.opts.fs * (this.opts.postS + 1)) {
        this.lastRun = r.t;
        out.push(...this.run(r.t));
      }
    }
    return out;
  }

  private run(now: number): FallEvent[] {
    this.stages.runs++;
    let res: PiptoResult;
    try {
      res = piptoOffline(this.v, this.t, this.opts.fs);
    } catch {
      return [];
    }
    if (res.stages.paired) this.stages.paired++;
    const out: FallEvent[] = [];
    for (const [lo, hi] of res.indexes) {
      const tImp = this.t[hi];
      if (now - tImp < this.opts.postS) continue;
      if (this.emitted.some((e) => Math.abs(e - tImp) < this.opts.dedupS)) continue;
      this.emitted.push(tImp);
      this.stages.alarm++;
      out.push({
        t: now,
        algorithm: this.name,
        details: { tImpact: Math.round(tImp * 1000) / 1000, tStart: Math.round(this.t[lo] * 1000) / 1000, peak: Math.round(this.v[hi] * 100) / 100 },
      });
    }
    return out;
  }
}
