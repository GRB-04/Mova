// ─────────────────────────────────────────────
// MOVA — Pontuação das tentativas do estudo (pura, sem React Native).
// As MESMAS regras são usadas na tela de resultados do app e em scripts/analyze_phone.ts.
// ─────────────────────────────────────────────

export type TrialKind = "queda" | "adl" | "livre";

/** Tempo extra após "Parar tentativa" para os detectores terminarem (Kangas/Bourke3/PIPTO alarmam 2–3 s após o impacto). */
export const GRACE_S = 5;
export function classifyActivity(label: string): TrialKind {
  if (label === "uso livre") return "livre";
  return label.startsWith("queda") ? "queda" : "adl";
}

/**
 * Uma tentativa já encerrada. Tempos em segundos no relógio do sensor.
 * `alarms`: instantes dos alarmes de cada detector durante a sessão (o recorte é feito aqui).
 */
export type TrialWindow = { kind: TrialKind; tStart: number; tEnd: number; markers: number[] };

/** Alarmes de um detector que pertencem à tentativa. */
export function alarmsInTrial(w: TrialWindow, alarms: number[]): number[] {
  const end = w.kind === "livre" ? w.tEnd : w.tEnd + GRACE_S;
  return alarms.filter((t) => t >= w.tStart && t <= end);
}

/**
 * Queda: acerto se houver alarme dentro da tentativa (início até GRACE_S depois de parar).
 *   Cada tentativa de queda contém UMA queda. O marcador "queda agora" fica gravado no events.csv,
 *   mas não é usado na pontuação: com a tela travada ele é tocado segundos depois da queda.
 * ADL: "acerto" significa alarme FALSO (qualquer alarme na tentativa).
 * Uso livre: não tem acerto; conta-se alarmes por hora.
 */
export function trialHit(w: TrialWindow, alarms: number[]): boolean {
  return alarmsInTrial(w, alarms).length > 0;
}

/** Registro salvo no aparelho (uma linha por tentativa). */
export type TrialRecord = {
  id: string;
  createdAt: number; // Date.now()
  sessionId: string;
  volunteer: string;
  position: string;
  platform: string;
  activity: string;
  kind: TrialKind;
  durationS: number;
  /** por detector: houve acerto (queda) / alarme falso (ADL) */
  hit: Record<string, boolean>;
  /** por detector: nº de alarmes dentro da tentativa */
  nAlarms: Record<string, number>;
};

/** Intervalo de confiança de Wilson (95%) para k/n. */
export function wilson(k: number, n: number, z = 1.959964): [number, number] {
  if (n === 0) return [NaN, NaN];
  const p = k / n;
  const den = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / den;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / den;
  return [Math.max(0, center - half), Math.min(1, center + half)];
}

export type Rate = { k: number; n: number; rate: number; ci: [number, number] };
const rate = (k: number, n: number): Rate => ({ k, n, rate: n ? k / n : NaN, ci: wilson(k, n) });

export type DetectorSummary = {
  detector: string;
  /** quedas detectadas / quedas (sensibilidade) */
  falls: Rate;
  /** ADLs com alarme falso / ADLs (1 − especificidade) */
  falseAlarms: Rate;
  free: { hours: number; alarms: number; perHour: number };
};

export function summarize(trials: TrialRecord[], detectors: string[]): DetectorSummary[] {
  return detectors.map((d) => {
    const falls = trials.filter((t) => t.kind === "queda");
    const adls = trials.filter((t) => t.kind === "adl");
    const free = trials.filter((t) => t.kind === "livre");
    const hours = free.reduce((a, t) => a + t.durationS, 0) / 3600;
    const alarms = free.reduce((a, t) => a + (t.nAlarms[d] ?? 0), 0);
    return {
      detector: d,
      falls: rate(falls.filter((t) => t.hit[d]).length, falls.length),
      falseAlarms: rate(adls.filter((t) => t.hit[d]).length, adls.length),
      free: { hours, alarms, perHour: hours ? alarms / hours : NaN },
    };
  });
}

/** atividade → detector → {k, n}: quantas tentativas daquela atividade tiveram alarme. */
export function byActivity(trials: TrialRecord[], detectors: string[]) {
  const kindOrder = (a: string) => (classifyActivity(a) === "queda" ? 0 : 1);
  const acts = [...new Set(trials.filter((t) => t.kind !== "livre").map((t) => t.activity))].sort(
    (a, b) => kindOrder(a) - kindOrder(b) || a.localeCompare(b),
  );
  return acts.map((activity) => {
    const sub = trials.filter((t) => t.activity === activity);
    return {
      activity,
      kind: sub[0].kind,
      cells: detectors.map((d) => ({ detector: d, k: sub.filter((t) => t.hit[d]).length, n: sub.length })),
    };
  });
}

export function trialsToCsv(trials: TrialRecord[], detectors: string[]): string {
  const head = ["id", "created_at", "session_id", "volunteer", "position", "platform", "activity", "kind", "duration_s", ...detectors.flatMap((d) => [`${d}_hit`, `${d}_alarms`])];
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const rows = trials.map((t) =>
    [t.id, new Date(t.createdAt).toISOString(), t.sessionId, esc(t.volunteer), esc(t.position), t.platform, esc(t.activity), t.kind, t.durationS.toFixed(1), ...detectors.flatMap((d) => [t.hit[d] ? 1 : 0, t.nAlarms[d] ?? 0])].join(","),
  );
  return [head.join(","), ...rows].join("\n") + "\n";
}
