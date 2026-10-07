// Robustez dos algoritmos às condições do celular, na SisFall.
//   taxa:      o celular entrega R Hz (10, 25, 50, 100) para TODOS os detectores
//   faixa:     saturação do sensor em ±2, ±4, ±8 g e sem saturação
//   orientação: rotação 3D aleatória por arquivo (celular "em qualquer posição"),
//               com e sem a calibração de 5 s em pé
// Uso: npx tsx scripts/robustness.ts [--data data/SisFall] [--out results/robustez] [--only taxa|faixa|orientacao] [--limit N]
// Métodos e justificativas: docs/METODOLOGIA_ANALISES.md (seção 2).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Detector, Sample, Vec3, norm } from "../src/detection/types";
import { KangasDetector } from "../src/detection/kangas";
import { Bourke3Detector } from "../src/detection/bourke3";
import { PiptoDetector, piptoOffline } from "../src/detection/pipto";
import { LEGACY_FS, LegacyDetector } from "../src/detection/legacy";
import { SISFALL_FS, SISFALL_UP, SisfallTrial, listSisfall, loadSisfall } from "./datasets/sisfall";
import { phoneSim } from "./lib/dsp";
import { clusterBootstrap, holm, mcnemarExact, rng } from "./lib/stats";
import { wilson } from "../src/study/scoring";

const argv = process.argv;
const arg = (k: string, d?: string) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const dataRoot = arg("data", "data/SisFall")!;
const outDir = arg("out", "results/robustez")!;
const only = arg("only");
const limit = Number(arg("limit", "Infinity"));
const SEED = 20261006;
/** Banda do filtro interno do acelerômetro do celular (suposição; ver METODOLOGIA 2.1). */
const SENSOR_BAND_HZ = 40;

// ── condições ──
type Rotation = "none" | "calibrated" | "uncalibrated";
type Condition = {
  id: string;
  family: "taxa" | "faixa" | "orientacao";
  label: string;
  /** taxa única entregue a todos os detectores; null = taxa nativa de cada detector (condição principal) */
  inputHz: number | null;
  /** banda do filtro do próprio sensor (Hz) antes do descarte de amostras; ver METODOLOGIA 2.1 */
  sensorBandHz?: number;
  clipG: number | null;
  rotation: Rotation;
  /** condição de referência para o teste pareado */
  ref: string;
};
const CONDITIONS: Condition[] = [
  { id: "base", family: "faixa", label: "principal (taxa nativa, ±8 g)", inputHz: null, clipG: 8, rotation: "none", ref: "base" },
  { id: "hz10", family: "taxa", label: "10 Hz", inputHz: 10, sensorBandHz: SENSOR_BAND_HZ, clipG: 8, rotation: "none", ref: "hz50" },
  { id: "hz25", family: "taxa", label: "25 Hz", inputHz: 25, sensorBandHz: SENSOR_BAND_HZ, clipG: 8, rotation: "none", ref: "hz50" },
  { id: "hz50", family: "taxa", label: "50 Hz", inputHz: 50, sensorBandHz: SENSOR_BAND_HZ, clipG: 8, rotation: "none", ref: "hz50" },
  { id: "hz100", family: "taxa", label: "100 Hz", inputHz: 100, sensorBandHz: SENSOR_BAND_HZ, clipG: 8, rotation: "none", ref: "hz50" },
  { id: "clip2", family: "faixa", label: "±2 g", inputHz: null, clipG: 2, rotation: "none", ref: "base" },
  { id: "clip4", family: "faixa", label: "±4 g", inputHz: null, clipG: 4, rotation: "none", ref: "base" },
  { id: "clipNone", family: "faixa", label: "sem saturação (±16 g da SisFall)", inputHz: null, clipG: null, rotation: "none", ref: "base" },
  { id: "rotCal", family: "orientacao", label: "orientação aleatória, COM calibração", inputHz: null, clipG: 8, rotation: "calibrated", ref: "base" },
  { id: "rotNoCal", family: "orientacao", label: "orientação aleatória, SEM calibração", inputHz: null, clipG: 8, rotation: "uncalibrated", ref: "base" },
];
const selected = CONDITIONS.filter((c) => !only || c.family === only || c.id === "base" || (only === "taxa" && c.id === "hz50"));

// ── detectores (mesma configuração do replay) ──
type Variant = { name: string; nativeHz: number; nativeCutoff?: number; make?: () => Detector; offline?: boolean };
const VARIANTS: Variant[] = [
  { name: "mova-legado", nativeHz: LEGACY_FS, nativeCutoff: 20, make: () => new LegacyDetector() },
  { name: "kangas-faithful", nativeHz: 50, make: () => new KangasDetector({ postureMode: "faithful" }) },
  { name: "kangas-guardian", nativeHz: 50, make: () => new KangasDetector({ postureMode: "guardian" }) },
  { name: "bourke3", nativeHz: 100, make: () => new Bourke3Detector() },
  { name: "pipto", nativeHz: 50, offline: true },
  { name: "pipto-streaming", nativeHz: 50, make: () => new PiptoDetector() },
];

// ── rotação 3D uniforme (Shoemake 1992), semente por arquivo ──
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
type Mat3 = [Vec3, Vec3, Vec3];
function randomRotation(key: string): Mat3 {
  const r = rng(hash(key) ^ SEED);
  const [u1, u2, u3] = [r(), r(), r()];
  const a = Math.sqrt(1 - u1);
  const b = Math.sqrt(u1);
  const [x, y, z, w] = [a * Math.sin(2 * Math.PI * u2), a * Math.cos(2 * Math.PI * u2), b * Math.sin(2 * Math.PI * u3), b * Math.cos(2 * Math.PI * u3)];
  return [
    [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
    [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
    [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
  ];
}
const apply = (m: Mat3, v: Vec3): Vec3 => [0, 1, 2].map((i) => m[i][0] * v[0] + m[i][1] * v[1] + m[i][2] * v[2]) as Vec3;

// ── execução ──
type Outcome = { key: string; subject: string; kind: "F" | "D"; activity: string; alarm: Record<string, 0 | 1> };
const outcomes = new Map<string, Outcome[]>(selected.map((c) => [c.id, []]));
const trials: SisfallTrial[] = listSisfall(dataRoot).slice(0, limit);
const t0 = Date.now();

trials.forEach((tr, i) => {
  const { samples } = loadSisfall(tr.path);
  for (const c of selected) {
    let raw = samples;
    let up: Vec3 = SISFALL_UP;
    if (c.rotation !== "none") {
      const R = randomRotation(tr.key);
      raw = samples.map((s) => {
        const [ax, ay, az] = apply(R, [s.ax, s.ay, s.az]);
        return { t: s.t, ax, ay, az };
      });
      if (c.rotation === "calibrated") up = apply(R, SISFALL_UP); // calibração de 5 s em pé no celular já girado
    }
    const cache = new Map<string, Sample[]>();
    const sig = (hz: number, cutoff?: number) => {
      const k = `${hz}/${cutoff ?? ""}`;
      if (!cache.has(k)) cache.set(k, phoneSim(raw, { fsIn: SISFALL_FS, fsOut: hz, cutoffHz: cutoff, clipG: c.clipG }));
      return cache.get(k)!;
    };
    const alarm: Record<string, 0 | 1> = {};
    for (const v of VARIANTS) {
      // taxa única: filtro fixo do sensor + descarte de amostras (como o setUpdateInterval do expo-sensors)
      const s = c.inputHz == null ? sig(v.nativeHz, v.nativeCutoff) : sig(c.inputHz, c.sensorBandHz);
      let n = 0;
      if (v.offline) {
        n = piptoOffline(s.map((x) => norm(x.ax, x.ay, x.az) * 9.807), s.map((x) => x.t), c.inputHz ?? v.nativeHz).falls.length;
      } else {
        const d = v.make!();
        d.reset();
        d.setUpReference?.(up);
        for (const x of s) n += d.push(x).length;
      }
      alarm[v.name] = n > 0 ? 1 : 0;
    }
    outcomes.get(c.id)!.push({ key: tr.key, subject: tr.subject, kind: tr.kind, activity: tr.activity, alarm });
  }
  if ((i + 1) % 500 === 0) console.error(`  ${i + 1}/${trials.length} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
});

// ── métricas e testes pareados contra a condição de referência ──
mkdirSync(outDir, { recursive: true });
for (const c of selected) {
  const rs = outcomes.get(c.id)!;
  writeFileSync(
    join(outDir, `${c.id}.csv`),
    ["file,subject,kind,activity," + VARIANTS.map((v) => v.name).join(","), ...rs.map((r) => [r.key, r.subject, r.kind, r.activity, ...VARIANTS.map((v) => r.alarm[v.name])].join(","))].join("\n") + "\n",
  );
}

const ok = (r: Outcome, v: string) => (r.kind === "F" ? r.alarm[v] : 1 - r.alarm[v]);
const clusters = (rs: Outcome[]) => [...rs.reduce((m, r) => m.set(r.subject, [...(m.get(r.subject) ?? []), r]), new Map<string, Outcome[]>()).values()];
const rate = (rs: Outcome[], v: string) => rs.reduce((a, r) => a + ok(r, v), 0) / rs.length;
const pct = (x: number) => (100 * x).toFixed(1);

type Test = { cond: Condition; v: string; metric: "SE" | "SP"; value: number; ci: [number, number]; diff: number; diffCI: [number, number]; onlyRef: number; onlyCond: number; p: number; pHolm?: number };
const tests: Test[] = [];
for (const c of selected) {
  const ref = outcomes.get(c.ref);
  const cur = outcomes.get(c.id)!;
  for (const v of VARIANTS) {
    for (const metric of ["SE", "SP"] as const) {
      const kind = metric === "SE" ? "F" : "D";
      const a = cur.filter((r) => r.kind === kind);
      const k = a.reduce((s, r) => s + ok(r, v.name), 0);
      let diff = NaN;
      let diffCI: [number, number] = [NaN, NaN];
      let onlyRef = 0;
      let onlyCond = 0;
      let p = NaN;
      if (ref && c.ref !== c.id) {
        const b = ref.filter((r) => r.kind === kind);
        const byKey = new Map(b.map((r) => [r.key, r]));
        const paired = a.map((r) => ({ subject: r.subject, x: ok(r, v.name), y: ok(byKey.get(r.key)!, v.name) }));
        for (const q of paired) {
          if (q.y && !q.x) onlyRef++;
          if (q.x && !q.y) onlyCond++;
        }
        p = mcnemarExact(onlyRef, onlyCond);
        const cl = [...paired.reduce((m, q) => m.set(q.subject, [...(m.get(q.subject) ?? []), q]), new Map<string, typeof paired>()).values()];
        const boot = clusterBootstrap(cl, (s) => s.reduce((acc, q) => acc + q.x - q.y, 0) / s.length, 1000, hash(c.id + v.name + metric));
        diff = boot.estimate;
        diffCI = boot.ci;
      }
      tests.push({ cond: c, v: v.name, metric, value: k / a.length, ci: wilson(k, a.length), diff, diffCI, onlyRef, onlyCond, p });
    }
  }
}
for (const fam of ["taxa", "faixa", "orientacao"] as const) {
  const fs = tests.filter((t) => t.cond.family === fam && Number.isFinite(t.p));
  const adj = holm(fs.map((t) => t.p));
  fs.forEach((t, i) => (t.pHolm = adj[i]));
}

const LABEL: Record<string, string> = { "mova-legado": "Mova antigo", "kangas-faithful": "Kangas", "kangas-guardian": "Kangas (eixo z)", bourke3: "Bourke3", pipto: "PIPTO (original)", "pipto-streaming": "PIPTO (tempo real)" };
const fmtP = (p?: number) => (p == null || !Number.isFinite(p) ? "—" : p < 0.001 ? "< 0,001" : p.toFixed(3).replace(".", ","));
const section = (fam: "taxa" | "faixa" | "orientacao", title: string, conds: string[]) => {
  const cs = conds.map((id) => CONDITIONS.find((c) => c.id === id)!).filter((c) => outcomes.has(c.id));
  if (cs.length < 2) return [];
  const grid = (metric: "SE" | "SP") => [
    `| Algoritmo | ${cs.map((c) => c.label).join(" | ")} |`,
    `|---|${cs.map(() => "---").join("|")}|`,
    ...VARIANTS.map((v) => `| ${LABEL[v.name]} | ${cs.map((c) => {
      const t = tests.find((x) => x.cond.id === c.id && x.v === v.name && x.metric === metric)!;
      const mark = t.pHolm != null && t.pHolm < 0.05 && (t.diffCI[0] > 0 || t.diffCI[1] < 0) ? (t.diff < 0 ? " ▼" : " ▲") : "";
      return `${pct(t.value)}${mark}`;
    }).join(" | ")} |`),
  ];
  const detail = tests
    .filter((t) => t.cond.family === fam && Number.isFinite(t.p) && cs.includes(t.cond))
    .map((t) => `| ${t.cond.label} | ${LABEL[t.v]} | ${t.metric} | ${(100 * t.diff).toFixed(1)} | ${(100 * t.diffCI[0]).toFixed(1)} a ${(100 * t.diffCI[1]).toFixed(1)} | ${t.onlyRef} | ${t.onlyCond} | ${fmtP(t.p)} | ${fmtP(t.pHolm)} |`);
  return [
    `## ${title}`,
    "",
    "**Sensibilidade (% de quedas detectadas)**",
    "",
    ...grid("SE"),
    "",
    "**Especificidade (% de ADLs sem alarme)**",
    "",
    ...grid("SP"),
    "",
    "▲/▼ = melhor/pior que a referência, com McNemar exato corrigido por Holm < 0,05 **e** IC 95% (bootstrap por participante) da diferença sem o zero.",
    "",
    "<details><summary>Testes pareados contra a referência</summary>",
    "",
    "| Condição | Algoritmo | Métrica | Diferença (pontos %) | IC 95% | só a referência acertou | só a condição acertou | p McNemar | p Holm |",
    "|---|---|---|---|---|---|---|---|---|",
    ...detail,
    "",
    "</details>",
    "",
  ];
};

const md = [
  "# Robustez às condições do celular (SisFall)",
  "",
  `${trials.length} arquivos da SisFall; os mesmos arquivos em todas as condições (comparação pareada). Métodos: \`docs/METODOLOGIA_ANALISES.md\`, seção 2.`,
  "",
  ...section("taxa", "1. Taxa de amostragem entregue pelo celular (referência: 50 Hz)", ["hz10", "hz25", "hz50", "hz100"]),
  ...section("faixa", "2. Faixa do acelerômetro (referência: ±8 g)", ["clip2", "clip4", "base", "clipNone"]),
  ...section("orientacao", "3. Orientação do celular (referência: orientação original da SisFall)", ["base", "rotCal", "rotNoCal"]),
].join("\n");
writeFileSync(join(outDir, "RESUMO.md"), md);
console.log(md);
console.error(`concluído em ${((Date.now() - t0) / 1000).toFixed(0)} s`);
