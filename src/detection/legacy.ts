// ─────────────────────────────────────────────
// A0 — Detector anterior do Mova (linha de base): alarme quando |a| > 2,5 g,
// lendo o acelerômetro a cada 100 ms (SeniorScreen.tsx original). Sem queda livre nem postura.
// Após um alarme, o app esperava a resposta do idoso (até 30 s): modelado como refratário de 30 s.
// ─────────────────────────────────────────────
import { Detector, FallEvent, Sample, norm } from "./types";
import { LinearResampler } from "./resample";

export const LEGACY_THRESHOLD_G = 2.5;
export const LEGACY_FS = 10;
const REFRACTORY_S = 30;

export class LegacyDetector implements Detector {
  readonly name = "mova-legado";
  stages: Record<string, number> = {};
  private rs = new LinearResampler(LEGACY_FS);
  private lastAlarm = -Infinity;

  constructor() {
    this.reset();
  }

  reset(): void {
    this.rs.reset();
    this.lastAlarm = -Infinity;
    this.stages = { alarm: 0 };
  }

  push(s: Sample): FallEvent[] {
    const out: FallEvent[] = [];
    for (const r of this.rs.push(s)) {
      const m = norm(r.ax, r.ay, r.az);
      if (m > LEGACY_THRESHOLD_G && r.t - this.lastAlarm >= REFRACTORY_S) {
        this.lastAlarm = r.t;
        this.stages.alarm++;
        out.push({ t: r.t, algorithm: this.name, details: { magnitude: Math.round(m * 100) / 100 } });
      }
    }
    return out;
  }
}
