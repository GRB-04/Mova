// ─────────────────────────────────────────────
// MOVA — Sinal bruto de uma tentativa (puro, sem React Native).
// Lê os MESMOS arquivos gravados pelo RecorderScreen (samples.csv, alarms.csv, events.csv)
// e prepara o gráfico do TrialCard: recorte no tempo, |a| e redução de pontos sem perder picos.
// ─────────────────────────────────────────────
import { TrialRecord } from "./scoring";

/** Segundos mostrados antes de "Iniciar tentativa". */
export const PRE_S = 2;

export type SignalSample = { t: number; x: number; y: number; z: number; m: number };
export type AlarmPoint = { algorithm: string; t: number };
export type TrialSpan = { tStart: number; tEnd: number };

/**
 * Início/fim da tentativa no relógio do sensor.
 * Tentativas antigas não guardam tStart/tEnd: o id é `${sessionId}_${round(tStart·1000)}` e a duração é tEnd − tStart.
 */
export function trialSpan(rec: Pick<TrialRecord, "id" | "sessionId" | "durationS" | "tStart" | "tEnd">): TrialSpan | null {
  if (Number.isFinite(rec.tStart) && Number.isFinite(rec.tEnd)) return { tStart: rec.tStart!, tEnd: rec.tEnd! };
  const prefix = `${rec.sessionId}_`;
  if (!rec.id.startsWith(prefix)) return null;
  const ms = Number(rec.id.slice(prefix.length));
  if (!Number.isFinite(ms)) return null;
  const tStart = ms / 1000;
  return { tStart, tEnd: tStart + rec.durationS };
}

/** Nome da pasta da sessão, igual ao RecorderScreen.startSession. */
export function sessionDirName(rec: Pick<TrialRecord, "sessionId" | "volunteer">): string {
  return `${rec.sessionId}_${rec.volunteer.trim()}`;
}

/** Divide uma linha CSV respeitando aspas (campos com vírgula, como os detalhes dos alarmes). */
function splitCsvLine(l: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < l.length; i++) {
    const c = l[i];
    if (q) {
      if (c === '"' && l[i + 1] === '"') (cur += '"'), i++;
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") out.push(cur), (cur = "");
    else cur += c;
  }
  out.push(cur);
  return out;
}

const dataLines = (csv: string) => csv.split(/\r?\n/).slice(1).filter((l) => l.length > 0);

/** samples.csv: session_id,sensor,t_native_s,t_js_ms,x,y,z — amostras com t0 ≤ t ≤ t1. */
export function parseSamples(csv: string, t0: number, t1: number): SignalSample[] {
  const out: SignalSample[] = [];
  for (const l of dataLines(csv)) {
    // sem aspas neste arquivo: split simples é bem mais rápido em sessões longas
    const r = l.split(",");
    if (r.length < 7) continue;
    const t = Number(r[2]);
    if (!(t >= t0 && t <= t1)) continue;
    const x = Number(r[4]);
    const y = Number(r[5]);
    const z = Number(r[6]);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
    out.push({ t, x, y, z, m: Math.sqrt(x * x + y * y + z * z) });
  }
  return out;
}

/** alarms.csv: session_id,algorithm,t_native_s,t_js_ms_est,details — alarmes com t0 ≤ t ≤ t1. */
export function parseAlarms(csv: string, t0: number, t1: number): AlarmPoint[] {
  const out: AlarmPoint[] = [];
  for (const l of dataLines(csv)) {
    const r = splitCsvLine(l);
    const t = Number(r[2]);
    if (r[1] && t >= t0 && t <= t1) out.push({ algorithm: r[1], t });
  }
  return out;
}

/** events.csv: session_id,event,label,t_js_ms,t_native_s_est — instantes dos "Marcar instante" em [t0, t1]. */
export function parseMarkers(csv: string, t0: number, t1: number): number[] {
  const out: number[] = [];
  for (const l of dataLines(csv)) {
    const r = splitCsvLine(l);
    const t = Number(r[4]);
    if (r[1] === "marker" && t >= t0 && t <= t1) out.push(t);
  }
  return out;
}

/**
 * Reduz para no máximo 2 pontos por faixa (o mínimo e o máximo, na ordem do tempo).
 * Desenhado com uma faixa por pixel, o gráfico fica igual ao do sinal completo: nenhum pico some.
 */
export function downsampleMinMax(samples: SignalSample[], value: (s: SignalSample) => number, buckets: number): { t: number; v: number }[] {
  if (samples.length <= 2 * buckets) return samples.map((s) => ({ t: s.t, v: value(s) }));
  const out: { t: number; v: number }[] = [];
  const size = samples.length / buckets;
  for (let b = 0; b < buckets; b++) {
    const from = Math.floor(b * size);
    const to = Math.min(samples.length, Math.floor((b + 1) * size));
    if (from >= to) continue;
    let iMin = from;
    let iMax = from;
    for (let i = from + 1; i < to; i++) {
      const v = value(samples[i]);
      if (v < value(samples[iMin])) iMin = i;
      if (v > value(samples[iMax])) iMax = i;
    }
    for (const i of iMin === iMax ? [iMin] : [Math.min(iMin, iMax), Math.max(iMin, iMax)]) {
      out.push({ t: samples[i].t, v: value(samples[i]) });
    }
  }
  return out;
}

export type SignalStats = { n: number; max: number; tMax: number; min: number; rateHz: number };

/** Pico e vale de |a| e taxa média medida pelo tempo do sensor. */
export function signalStats(samples: SignalSample[]): SignalStats {
  if (!samples.length) return { n: 0, max: NaN, tMax: NaN, min: NaN, rateHz: NaN };
  let max = samples[0];
  let min = samples[0];
  for (const s of samples) {
    if (s.m > max.m) max = s;
    if (s.m < min.m) min = s;
  }
  const span = samples[samples.length - 1].t - samples[0].t;
  return { n: samples.length, max: max.m, tMax: max.t, min: min.m, rateHz: span > 0 ? (samples.length - 1) / span : NaN };
}
