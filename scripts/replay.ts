// Replay offline: roda os detectores sobre uma base pública e calcula métricas.
// Uso:
//   npx tsx scripts/replay.ts --dataset sisfall --detector kangas|bourke3|pipto|all \
//        [--data data/SisFall] [--clip 8|none] [--out results] [--limit N] [--dump-pipto DIR]
//
// Pontuação por ARQUIVO (a SisFall não traz o instante do impacto):
//   queda (F##): VP se ≥ 1 alarme, senão FN.   ADL (D##): FP se ≥ 1 alarme, senão VN.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Detector, Sample, norm } from "../src/detection/types";
import { KangasDetector, KangasImpactSignal } from "../src/detection/kangas";
import { Bourke3Detector } from "../src/detection/bourke3";
import { PiptoDetector, piptoOffline } from "../src/detection/pipto";
import { LEGACY_FS, LegacyDetector } from "../src/detection/legacy";
import { SISFALL_FS, SISFALL_UP, listSisfall, loadSisfall, SisfallTrial } from "./datasets/sisfall";
import { phoneSim } from "./lib/dsp";
import { ci, metrics, pct } from "./lib/metrics";

// ── argumentos ──
const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith("--")) {
    const next = process.argv[i + 1];
    if (next === undefined || next.startsWith("--")) args.set(a.slice(2), "true");
    else args.set(a.slice(2), next), i++;
  }
}
const dataset = args.get("dataset") ?? "sisfall";
if (dataset !== "sisfall") throw new Error(`base não suportada: ${dataset}`);
const family = args.get("detector") ?? "all";
const dataRoot = args.get("data") ?? "data/SisFall";
const clipArg = args.get("clip") ?? "8";
const clipG = clipArg === "none" ? null : Number(clipArg);
const outDir = args.get("out") ?? "results";
const limit = args.has("limit") ? Number(args.get("limit")) : Infinity;
const dumpPipto = args.get("dump-pipto");
const suffix = clipG == null ? "_noclip" : clipG === 8 ? "" : `_clip${clipG}`;

// ── variantes ──
type Variant = {
  name: string;
  fs: number;
  /** corte do anti-aliasing (Hz); padrão 0,4·fs */
  cutoffHz?: number;
  /** devolve [nº de alarmes, instantes, estágios] para um sinal já pré-processado */
  run: (s: Sample[]) => { times: number[]; stages: Record<string, number> };
};

function streaming(make: () => Detector): Variant["run"] {
  const det = make();
  return (s) => {
    det.reset();
    det.setUpReference?.(SISFALL_UP);
    const times: number[] = [];
    for (const x of s) for (const e of det.push(x)) times.push(e.t);
    return { times, stages: { ...det.stages } };
  };
}

const KANGAS_SIGNALS: KangasImpactSignal[] = ["SVTOT", "SVD", "SVMAXMIN", "Z2"];
const variants: Record<string, Variant[]> = {
  // linha de base: detector anterior do app (|a| > 2,5 g a 10 Hz). Amostragem pontual do sinal do celular.
  legado: [{ name: "mova-legado", fs: LEGACY_FS, cutoffHz: 20, run: streaming(() => new LegacyDetector()) }],
  kangas: [
    { name: "kangas-faithful", fs: 50, run: streaming(() => new KangasDetector({ postureMode: "faithful" })) },
    { name: "kangas-guardian", fs: 50, run: streaming(() => new KangasDetector({ postureMode: "guardian" })) },
    ...KANGAS_SIGNALS.map((sig) => ({
      name: `kangas-faithful-${sig}`,
      fs: 50,
      run: streaming(() => new KangasDetector({ postureMode: "faithful", impactSignals: [sig], name: `kangas-faithful-${sig}` })),
    })),
  ],
  bourke3: [
    { name: "bourke3", fs: 100, run: streaming(() => new Bourke3Detector()) },
    { name: "bourke3-noedge", fs: 100, run: streaming(() => new Bourke3Detector({ useEdgeTimes: false, name: "bourke3-noedge" })) },
    { name: "bourke3-fixed1s", fs: 100, run: streaming(() => new Bourke3Detector({ velocityWindow: "fixed-1s", name: "bourke3-fixed1s" })) },
    // taxa do original (Bourke 2010: 200 Hz, filtro analógico de 100 Hz) — sensibilidade à nossa escolha de 100 Hz
    { name: "bourke3-200hz", fs: 200, cutoffHz: 80, run: streaming(() => new Bourke3Detector({ fs: 200, name: "bourke3-200hz" })) },
  ],
  pipto: [
    {
      name: "pipto",
      fs: 50,
      run: (s) => {
        const r = piptoOffline(
          s.map((x) => norm(x.ax, x.ay, x.az) * 9.807),
          s.map((x) => x.t),
          50,
        );
        return { times: r.indexes.map(([, hi]) => s[hi].t), stages: r.stages };
      },
    },
    { name: "pipto-streaming", fs: 50, run: streaming(() => new PiptoDetector()) },
  ],
};
const selected = family === "all" ? Object.values(variants).flat() : variants[family];
if (!selected) throw new Error(`detector desconhecido: ${family}`);

// ── replay ──
type Row = SisfallTrial & { variant: string; nAlarms: number; times: number[]; stages: Record<string, number>; durationS: number };
const rows = new Map<string, Row[]>(selected.map((v) => [v.name, []]));
const trials = listSisfall(dataRoot).slice(0, limit);
if (!trials.length) throw new Error(`nenhum arquivo SisFall em ${dataRoot}`);
let dropped = 0;
const t0 = Date.now();
if (dumpPipto) mkdirSync(dumpPipto, { recursive: true });

trials.forEach((tr, i) => {
  const { samples, dropped: d } = loadSisfall(tr.path);
  dropped += d;
  const cache = new Map<string, Sample[]>();
  const sig = (fs: number, cutoffHz?: number) => {
    const key = `${fs}/${cutoffHz ?? ""}`;
    if (!cache.has(key)) cache.set(key, phoneSim(samples, { fsIn: SISFALL_FS, fsOut: fs, cutoffHz, clipG }));
    return cache.get(key)!;
  };
  for (const v of selected) {
    const s = sig(v.fs, v.cutoffHz);
    const { times, stages } = v.run(s);
    rows.get(v.name)!.push({ ...tr, variant: v.name, nAlarms: times.length, times, stages, durationS: samples.length / SISFALL_FS });
  }
  if (dumpPipto) {
    const s = sig(50);
    writeFileSync(join(dumpPipto, tr.key.replace("/", "_")), "time,v\n" + s.map((x) => `${x.t},${norm(x.ax, x.ay, x.az) * 9.807}`).join("\n"));
  }
  if ((i + 1) % 500 === 0) console.error(`  ${i + 1}/${trials.length} arquivos (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
});

// ── saída ──
mkdirSync(outDir, { recursive: true });
const header = `> Base: SisFall (espelho CSV), ${trials.length} arquivos, ${dropped} linhas malformadas descartadas. ` +
  `Pré-processamento: ADXL345 → g, anti-aliasing Butterworth 4ª ordem (0,4·fs), decimação 200 Hz → fs do detector, ` +
  `${clipG == null ? "sem saturação" : `saturação ±${clipG} g`}. Pontuação por arquivo.\n`;

for (const v of selected) {
  const rs = rows.get(v.name)!;
  const stageKeys = [...new Set(rs.flatMap((r) => Object.keys(r.stages)))];
  const csv = [
    ["file", "subject", "group", "kind", "activity", "trial", "duration_s", "n_alarms", "alarm_times_s", ...stageKeys.map((k) => `stage_${k}`)].join(","),
    ...rs.map((r) =>
      [r.key, r.subject, r.group, r.kind, r.activity, r.trial, r.durationS.toFixed(2), r.nAlarms, r.times.map((t) => t.toFixed(2)).join(" "), ...stageKeys.map((k) => r.stages[k] ?? 0)].join(","),
    ),
  ].join("\n");
  writeFileSync(join(outDir, `sisfall_${v.name}${suffix}.csv`), csv + "\n");

  const conf = (sub: Row[]) => ({
    tp: sub.filter((r) => r.kind === "F" && r.nAlarms > 0).length,
    fn: sub.filter((r) => r.kind === "F" && r.nAlarms === 0).length,
    tn: sub.filter((r) => r.kind === "D" && r.nAlarms === 0).length,
    fp: sub.filter((r) => r.kind === "D" && r.nAlarms > 0).length,
  });
  const line = (label: string, sub: Row[]) => {
    const m = metrics(conf(sub));
    return `| ${label} | ${m.tp} | ${m.fn} | ${m.tn} | ${m.fp} | ${pct(m.se)} (${ci(m.seCI)}) | ${pct(m.sp)} (${ci(m.spCI)}) | ${pct(m.precision)} | ${pct(m.f1)} |`;
  };
  const adlHours = rs.filter((r) => r.kind === "D").reduce((a, r) => a + r.durationS, 0) / 3600;
  const adlAlarms = rs.filter((r) => r.kind === "D").reduce((a, r) => a + r.nAlarms, 0);

  const byAct = [...new Set(rs.map((r) => r.activity))].sort().map((act) => {
    const sub = rs.filter((r) => r.activity === act);
    const hit = sub.filter((r) => r.nAlarms > 0).length;
    return `| ${act} | ${sub.length} | ${hit} | ${pct(hit / sub.length)} |`;
  });
  const funnel = (kind: "F" | "D") => {
    const sub = rs.filter((r) => r.kind === kind);
    return stageKeys.map((k) => `${k} ${sub.filter((r) => (r.stages[k] ?? 0) > 0).length}`).join(" → ");
  };

  const md = [
    `## ${v.name}${suffix} (fs ${v.fs} Hz)`,
    header,
    "| Grupo | VP | FN | VN | FP | SE % (IC95) | SP % (IC95) | Precisão % | F1 % |",
    "|---|---|---|---|---|---|---|---|---|",
    line("Todos", rs),
    line("Jovens (SA)", rs.filter((r) => r.group === "SA")),
    line("Idosos (SE)", rs.filter((r) => r.group === "SE")),
    "",
    `Alarmes em ADLs: ${adlAlarms} em ${adlHours.toFixed(2)} h de ADL roteirizada (${(adlAlarms / adlHours).toFixed(1)} alarmes/h — não comparar com vida real).`,
    "",
    `Funil (nº de arquivos que chegaram a cada estágio) — quedas: ${funnel("F")}`,
    "",
    `Funil — ADLs: ${funnel("D")}`,
    "",
    "| Atividade | Arquivos | Com alarme | % |",
    "|---|---|---|---|",
    ...byAct,
    "",
  ].join("\n");
  writeFileSync(join(outDir, `sisfall_${v.name}${suffix}.md`), md);
  console.log(md.split("\n").slice(0, 9).join("\n") + "\n");
}
console.error(`concluído em ${((Date.now() - t0) / 1000).toFixed(0)} s`);
