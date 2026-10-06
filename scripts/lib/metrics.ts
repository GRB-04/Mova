export type Confusion = { tp: number; fn: number; tn: number; fp: number };

/** Intervalo de confiança de Wilson (95%) para uma proporção k/n. */
export function wilson(k: number, n: number, z = 1.959964): [number, number] {
  if (n === 0) return [NaN, NaN];
  const p = k / n;
  const den = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / den;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / den;
  return [Math.max(0, center - half), Math.min(1, center + half)];
}

export function metrics(c: Confusion) {
  const se = c.tp / (c.tp + c.fn);
  const sp = c.tn / (c.tn + c.fp);
  const prec = c.tp / (c.tp + c.fp);
  const f1 = (2 * prec * se) / (prec + se);
  return {
    ...c,
    se,
    seCI: wilson(c.tp, c.tp + c.fn),
    sp,
    spCI: wilson(c.tn, c.tn + c.fp),
    precision: prec,
    f1,
  };
}

export const pct = (x: number) => (Number.isFinite(x) ? (100 * x).toFixed(1) : "—");
export const ci = ([a, b]: [number, number]) => `${pct(a)}–${pct(b)}`;
