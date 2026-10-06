// ─────────────────────────────────────────────
// MOVA — Interface comum dos detectores de queda
// Módulo PURO: sem React Native. Roda no app e no Node (replay offline).
// ─────────────────────────────────────────────

/** Amostra do acelerômetro. t em SEGUNDOS; aceleração em g COM gravidade (repouso: |a| ≈ 1 g). */
export type Sample = { t: number; ax: number; ay: number; az: number };

export type FallEvent = {
  t: number;
  algorithm: string;
  details?: Record<string, number | string>;
};

export type Vec3 = [number, number, number];

export interface Detector {
  readonly name: string;
  /** Recebe amostras em ordem e devolve os alarmes disparados por esta amostra. */
  push(s: Sample): FallEvent[];
  reset(): void;
  /** Vetor gravidade médio "em pé" (calibração de 5 s), em g, no referencial do aparelho. */
  setUpReference?(g: Vec3): void;
  /** Contadores por estágio desde o último reset (para o funil). */
  readonly stages: Record<string, number>;
}

/** 1 g em m/s² (padrão CGPM). */
export const G_MS2 = 9.80665;

export function norm(x: number, y: number, z: number): number {
  return Math.sqrt(x * x + y * y + z * z);
}

export function unit(v: Vec3): Vec3 {
  const n = norm(v[0], v[1], v[2]) || 1;
  return [v[0] / n, v[1] / n, v[2] / n];
}
