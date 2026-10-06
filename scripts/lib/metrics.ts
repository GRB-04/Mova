import { wilson } from "../../src/study/scoring";

export { wilson };

export type Confusion = { tp: number; fn: number; tn: number; fp: number };

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
