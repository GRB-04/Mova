import { Detector, FallEvent, Sample, Vec3 } from "../types";

/** Segmento de sinal sintético: duração (s) e função que dá a aceleração (g) no tempo relativo. */
export type Segment = { dur: number; f: (tr: number) => Vec3 };

export const UP: Vec3 = [0, 0, 1]; // gravidade "em pé" no referencial do aparelho
export const LYING: Vec3 = [1, 0, 0]; // gravidade girada 90°

export const still = (dur: number, g: Vec3 = UP): Segment => ({ dur, f: () => g });
export const mag = (dur: number, m: number, dir: Vec3 = UP): Segment => ({
  dur,
  f: () => [dir[0] * m, dir[1] * m, dir[2] * m],
});

export function synth(segments: Segment[], fs: number): Sample[] {
  const out: Sample[] = [];
  let t0 = 0;
  let k = 0;
  for (const seg of segments) {
    const n = Math.round(seg.dur * fs);
    for (let i = 0; i < n; i++, k++) {
      const [ax, ay, az] = seg.f(i / fs);
      out.push({ t: k / fs, ax, ay, az });
    }
    t0 += seg.dur;
  }
  void t0;
  return out;
}

export function run(det: Detector, samples: Sample[]): FallEvent[] {
  det.reset();
  det.setUpReference?.(UP);
  return samples.flatMap((s) => det.push(s));
}
