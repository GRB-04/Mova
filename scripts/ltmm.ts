// Alarmes falsos por dia em vida real de idosos: LTMM (PhysioNet), ~3 dias por pessoa, sensor na lombar, 100 Hz.
// Não há quedas anotadas: TODO alarme é tratado como falso alarme (ver METODOLOGIA 3).
//
// Uso:
//   npx tsx scripts/ltmm.ts --run [--shard 0/3] [--records CO001,FL004]   # processa (baixa, analisa, apaga o .dat)
//   npx tsx scripts/ltmm.ts --summarize                                  # junta os resultados em results/ltmm/RESUMO.md
// Metadados (.hea, RECORDS) em data/ltmm/ — baixados de s3.amazonaws.com/physionet-open/ltmm/1.0.0/.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { Detector, Vec3, norm } from "../src/detection/types";
import { KangasDetector } from "../src/detection/kangas";
import { Bourke3Detector } from "../src/detection/bourke3";
import { PiptoDetector } from "../src/detection/pipto";
import { LEGACY_FS, LegacyDetector } from "../src/detection/legacy";
import { PhoneSimStream } from "./lib/dsp";
import { LtmmHeader, channelRangeG, readHeader, streamAcc } from "./datasets/ltmm";
import { clusterBootstrap, holm, wilcoxonSignedRank } from "./lib/stats";

const S3 = "https://s3.amazonaws.com/physionet-open/ltmm/1.0.0";
const META = "data/ltmm";
const TMP = "data/ltmm/tmp";
const OUT = "results/ltmm";
const REC_OUT = join(OUT, "registros");

// ── critérios (justificativas na METODOLOGIA, seção 3) ──
const MIN_RANGE_G = 3.5; // > maior limiar de impacto entre os algoritmos (PIPTO ≈ 3,06 g) + margem
const MIN_HOURS = 24;
const EXCLUDED: Record<string, string> = { CO005: "queda relatada no diário de uso (\"fall 11:40\", dia 0)" };
// não uso (critério do GGIR / van Hees): janela de 60 min, passo de 15 min;
// não uso se ≥ 2 eixos com DP < 13 mg OU ≥ 2 eixos com amplitude < 50 mg
const NW_WIN_MIN = 60;
const NW_STEP_MIN = 15;
const NW_SD = 0.013;
const NW_RANGE = 0.05;
// segundos de "caminhada" para estimar a vertical (referência em pé): média do SV ≈ 1 g e DP do SV moderado
const WALK_MEAN = [0.9, 1.1];
const WALK_SD = [0.08, 0.6];
/** Análise de sensibilidade (post hoc): só registros com a vertical estimada a até 30° do eixo v. */
const MAX_UP_ANGLE_SENS = 30;
/** Bourke 2010 define "dia" como 16,5 h acordado (7,5 h de sono). Usado só para comparar com o publicado. */
const WAKING_H = 16.5;

type DetSpec = { name: string; hz: number; cutoff?: number; make: () => Detector };
const DETECTORS: DetSpec[] = [
  { name: "mova-legado", hz: LEGACY_FS, cutoff: 20, make: () => new LegacyDetector() },
  { name: "kangas-faithful", hz: 50, make: () => new KangasDetector({ postureMode: "faithful" }) },
  { name: "kangas-guardian", hz: 50, make: () => new KangasDetector({ postureMode: "guardian" }) },
  { name: "bourke3", hz: 100, cutoff: 40, make: () => new Bourke3Detector() },
  { name: "pipto-streaming", hz: 50, make: () => new PiptoDetector() },
];

export type RecordResult = {
  record: string;
  group: "CO" | "FL";
  age?: number;
  sex?: string;
  hours: number;
  wearHours: number;
  upRef: Vec3;
  upAngleToVerticalDeg: number;
  walkSeconds: number;
  alarms: Record<string, number[]>; // instantes (s) dos alarmes durante uso
  alarmsNonWear: Record<string, number>;
};

function eligible(): { rec: string; h: LtmmHeader; reason?: string }[] {
  const recs = readFileSync(join(META, "RECORDS"), "utf8").split(/\s+/).filter((r) => /^(CO|FL)\d+/.test(r));
  return recs.map((rec) => {
    const h = readHeader(join(META, `${rec}.hea`));
    const acc = h.channels.filter((c) => /acceleration/.test(c.name));
    const range = Math.min(...acc.map(channelRangeG));
    const hours = h.nSamples / h.fs / 3600;
    let reason: string | undefined;
    if (EXCLUDED[rec]) reason = EXCLUDED[rec];
    else if (range < MIN_RANGE_G) reason = `faixa ±${range.toFixed(2)} g < ±${MIN_RANGE_G} g`;
    else if (hours < MIN_HOURS) reason = `${hours.toFixed(1)} h < ${MIN_HOURS} h`;
    else if (h.fs !== 100) reason = `taxa ${h.fs} Hz`;
    return { rec, h, reason };
  });
}

function processRecord(rec: string, h: LtmmHeader): RecordResult {
  mkdirSync(TMP, { recursive: true });
  const datName = h.channels[0].file;
  const dat = join(TMP, datName);
  const dl = spawnSync("curl", ["-s", "-f", "--retry", "4", "-o", dat, `${S3}/${datName}`], { stdio: "inherit" });
  if (dl.status !== 0) throw new Error(`download falhou: ${datName}`);
  try {
    const fs = h.fs;
    const nSec = Math.ceil(h.nSamples / fs);
    const nMin = Math.ceil(nSec / 60);
    // ── passagem 1: estatísticas por segundo (vertical) e por minuto (não uso) ──
    const secSum = new Float64Array(nSec * 3);
    const secSv = new Float64Array(nSec);
    const secSv2 = new Float64Array(nSec);
    const secN = new Uint16Array(nSec);
    const minSum = new Float64Array(nMin * 3);
    const minSq = new Float64Array(nMin * 3);
    const minMin = new Float64Array(nMin * 3).fill(Infinity);
    const minMax = new Float64Array(nMin * 3).fill(-Infinity);
    const minN = new Uint32Array(nMin);
    streamAcc(dat, h, (i, v, ml, ap) => {
      const s = Math.floor(i / fs);
      const m = Math.floor(s / 60);
      const a = [v, ml, ap];
      const sv = Math.sqrt(v * v + ml * ml + ap * ap);
      secSv[s] += sv;
      secSv2[s] += sv * sv;
      secN[s]++;
      minN[m]++;
      for (let k = 0; k < 3; k++) {
        secSum[s * 3 + k] += a[k];
        minSum[m * 3 + k] += a[k];
        minSq[m * 3 + k] += a[k] * a[k];
        if (a[k] < minMin[m * 3 + k]) minMin[m * 3 + k] = a[k];
        if (a[k] > minMax[m * 3 + k]) minMax[m * 3 + k] = a[k];
      }
    });
    // não uso
    const nonWear = new Uint8Array(nMin);
    for (let start = 0; start + NW_WIN_MIN <= nMin; start += NW_STEP_MIN) {
      let lowSd = 0;
      let lowRange = 0;
      for (let k = 0; k < 3; k++) {
        let s = 0, q = 0, n = 0, lo = Infinity, hi = -Infinity;
        for (let m = start; m < start + NW_WIN_MIN; m++) {
          s += minSum[m * 3 + k];
          q += minSq[m * 3 + k];
          n += minN[m];
          lo = Math.min(lo, minMin[m * 3 + k]);
          hi = Math.max(hi, minMax[m * 3 + k]);
        }
        const sd = Math.sqrt(Math.max(0, q / n - (s / n) ** 2));
        if (sd < NW_SD) lowSd++;
        if (hi - lo < NW_RANGE) lowRange++;
      }
      if (lowSd >= 2 || lowRange >= 2) for (let m = start; m < start + NW_WIN_MIN; m++) nonWear[m] = 1;
    }
    const wearMinutes = nonWear.reduce((a, x) => a + (x ? 0 : 1), 0);
    // vertical (referência "em pé") a partir de segundos de caminhada durante o uso
    const up: Vec3 = [0, 0, 0];
    let walk = 0;
    for (let s = 0; s < nSec; s++) {
      if (!secN[s] || nonWear[Math.floor(s / 60)]) continue;
      const mean = secSv[s] / secN[s];
      const sd = Math.sqrt(Math.max(0, secSv2[s] / secN[s] - mean * mean));
      if (mean >= WALK_MEAN[0] && mean <= WALK_MEAN[1] && sd >= WALK_SD[0] && sd <= WALK_SD[1]) {
        for (let k = 0; k < 3; k++) up[k] += secSum[s * 3 + k] / secN[s];
        walk++;
      }
    }
    const nUp = norm(up[0], up[1], up[2]) || 1;
    const upRef: Vec3 = [up[0] / nUp, up[1] / nUp, up[2] / nUp];
    const upAngle = (Math.acos(Math.min(1, Math.abs(upRef[0]))) * 180) / Math.PI; // eixo 0 = v-acceleration

    // ── passagem 2: detectores (eixos do "aparelho": x = vertical, y = médio-lateral, z = ântero-posterior) ──
    const dets = DETECTORS.map((d) => {
      const det = d.make();
      det.reset();
      det.setUpReference?.(upRef);
      return { spec: d, det, sim: new PhoneSimStream({ fsIn: fs, fsOut: d.hz, cutoffHz: d.cutoff, clipG: 8 }), times: [] as number[], nw: 0 };
    });
    streamAcc(dat, h, (i, v, ml, ap) => {
      const s0 = { t: i / fs, ax: v, ay: ml, az: ap };
      for (const d of dets) {
        const s = d.sim.push(s0);
        if (!s) continue;
        for (const ev of d.det.push(s)) {
          if (nonWear[Math.floor(ev.t / 60)]) d.nw++;
          else d.times.push(Math.round(ev.t * 100) / 100);
        }
      }
    });
    return {
      record: rec,
      group: rec.slice(0, 2) as "CO" | "FL",
      age: h.age,
      sex: h.sex,
      hours: h.nSamples / fs / 3600,
      wearHours: wearMinutes / 60,
      upRef: upRef.map((x) => Math.round(x * 1000) / 1000) as Vec3,
      upAngleToVerticalDeg: Math.round(upAngle * 10) / 10,
      walkSeconds: walk,
      alarms: Object.fromEntries(dets.map((d) => [d.spec.name, d.times])),
      alarmsNonWear: Object.fromEntries(dets.map((d) => [d.spec.name, d.nw])),
    };
  } finally {
    rmSync(dat, { force: true });
  }
}

function run(): void {
  mkdirSync(REC_OUT, { recursive: true });
  const shardArg = process.argv.includes("--shard") ? process.argv[process.argv.indexOf("--shard") + 1] : "0/1";
  const [k, n] = shardArg.split("/").map(Number);
  const only = process.argv.includes("--records") ? process.argv[process.argv.indexOf("--records") + 1].split(",") : null;
  const list = eligible().filter((e) => !e.reason && (!only || only.includes(e.rec)));
  list.forEach((e, i) => {
    if (i % n !== k) return;
    const out = join(REC_OUT, `${e.rec}.json`);
    if (existsSync(out)) return; // retomável
    const t0 = Date.now();
    const r = processRecord(e.rec, e.h);
    writeFileSync(out, JSON.stringify(r));
    console.error(`${e.rec}: ${r.wearHours.toFixed(1)} h de uso, vertical a ${r.upAngleToVerticalDeg}° do eixo v, ${((Date.now() - t0) / 1000).toFixed(0)} s — ` + DETECTORS.map((d) => `${d.name} ${r.alarms[d.name].length}`).join(", "));
  });
}

function summarize(): void {
  const el = eligible();
  const results: RecordResult[] = readdirSync(REC_OUT).filter((f) => f.endsWith(".json")).sort().map((f) => JSON.parse(readFileSync(join(REC_OUT, f), "utf8")));
  const names = DETECTORS.map((d) => d.name);
  const LABEL: Record<string, string> = { "mova-legado": "Mova antigo", "kangas-faithful": "Kangas", "kangas-guardian": "Kangas (eixo z)", bourke3: "Bourke3", "pipto-streaming": "PIPTO (tempo real)" };
  const perDay = (r: RecordResult, d: string) => r.alarms[d].length / (r.wearHours / 24);
  const q = (xs: number[], p: number) => {
    const s = [...xs].sort((a, b) => a - b);
    const pos = (s.length - 1) * p;
    const lo = Math.floor(pos);
    return s[lo] + (s[Math.ceil(pos)] - s[lo]) * (pos - lo);
  };
  const f1 = (x: number) => x.toFixed(1).replace(".", ",");
  const rowFor = (label: string, rs: RecordResult[]) =>
    names.map((d) => {
      const rates = rs.map((r) => perDay(r, d));
      const pooled = (rs2: RecordResult[]) => rs2.reduce((a, r) => a + r.alarms[d].length, 0) / (rs2.reduce((a, r) => a + r.wearHours, 0) / 24);
      const boot = clusterBootstrap(rs.map((r) => [r]), pooled, 2000, 11);
      return `| ${label} | ${LABEL[d]} | ${rs.reduce((a, r) => a + r.alarms[d].length, 0)} | ${f1(boot.estimate)} (${f1(boot.ci[0])}–${f1(boot.ci[1])}) | ${f1((boot.estimate * WAKING_H) / 24)} | ${f1(q(rates, 0.5))} (${f1(q(rates, 0.25))}–${f1(q(rates, 0.75))}) | ${f1(Math.min(...rates))}–${f1(Math.max(...rates))} | ${rates.filter((x) => x === 0).length} |`;
    });
  // comparação pareada entre detectores (mesmas pessoas): Wilcoxon + Holm
  const pairs: { a: string; b: string; med: number; p: number; pH?: number }[] = [];
  for (let i = 0; i < names.length; i++)
    for (let j = i + 1; j < names.length; j++) {
      const x = results.map((r) => perDay(r, names[i]));
      const y = results.map((r) => perDay(r, names[j]));
      const w = wilcoxonSignedRank(x, y);
      pairs.push({ a: names[i], b: names[j], med: q(x.map((v, k) => v - y[k]), 0.5), p: w.p });
    }
  holm(pairs.map((p) => p.p)).forEach((p, i) => (pairs[i].pH = p));
  const fmtP = (p: number) => (p < 0.001 ? "< 0,001" : p.toFixed(3).replace(".", ","));
  const totalWear = results.reduce((a, r) => a + r.wearHours, 0);
  const excluded = el.filter((e) => e.reason);
  const md = [
    "# Alarmes falsos em vida real: LTMM (idosos em casa, ~3 dias, sensor na lombar)",
    "",
    `Registros analisados: **${results.length}** (${results.filter((r) => r.group === "CO").length} CO = sem histórico de quedas, ${results.filter((r) => r.group === "FL").length} FL = com histórico de quedas), ${f1(totalWear)} h de uso (${f1(totalWear / 24)} dias). Excluídos: ${excluded.length} (lista no fim). Métodos: \`docs/METODOLOGIA_ANALISES.md\`, seção 3.`,
    "",
    "A LTMM não tem quedas anotadas: **todo alarme é contado como falso**. \"Por dia\" = por 24 h de uso (sem os períodos detectados de não uso).",
    "",
    "## Alarmes falsos por dia",
    "",
    "| Grupo | Algoritmo | Alarmes (total) | Taxa agregada/dia (IC 95% bootstrap por pessoa) | Por \"dia acordado\" de 16,5 h (critério do Bourke 2010) | Mediana por pessoa (IIQ) | Mín.–máx. por pessoa | Pessoas com 0 alarmes |",
    "|---|---|---|---|---|---|---|---|",
    ...rowFor("Todos", results),
    ...rowFor("CO", results.filter((r) => r.group === "CO")),
    ...rowFor("FL", results.filter((r) => r.group === "FL")),
    "",
    "### Análise de sensibilidade (definida DEPOIS de ver a checagem de qualidade)",
    "",
    `Alguns registros têm a vertical estimada longe do eixo v do sensor (até ${f1(Math.max(...results.map((r) => r.upAngleToVerticalDeg)))}°), o que pode indicar sensor mal posicionado ou erro na estimativa. Repetição só com registros a ≤ ${MAX_UP_ANGLE_SENS}° (${results.filter((r) => r.upAngleToVerticalDeg <= MAX_UP_ANGLE_SENS).length} de ${results.length}):`,
    "",
    "| Grupo | Algoritmo | Alarmes (total) | Taxa agregada/dia (IC 95% bootstrap por pessoa) | Por \"dia acordado\" de 16,5 h (critério do Bourke 2010) | Mediana por pessoa (IIQ) | Mín.–máx. por pessoa | Pessoas com 0 alarmes |",
    "|---|---|---|---|---|---|---|---|",
    ...rowFor("Vertical ≤ 30°", results.filter((r) => r.upAngleToVerticalDeg <= MAX_UP_ANGLE_SENS)),
    "",
    "Referências publicadas (vida real/ADL contínuas): Bourke3 original 0,6 por dia acordado de 16,5 h = 0,04/h (Bourke 2010: 2 FP em 52,4 h diurnas de 10 idosos); Bourke3 no Bagalà ≈ 5/dia; Kangas no Bagalà < 9/dia; faixa dos 13 algoritmos no Bagalà: 3–85 por 24 h.",
    "",
    "## Comparação entre algoritmos (mesmas pessoas: Wilcoxon pareado, correção de Holm)",
    "",
    "| A | B | Mediana de (A − B) alarmes/dia | p Wilcoxon | p Holm |",
    "|---|---|---|---|---|",
    ...pairs.map((p) => `| ${LABEL[p.a]} | ${LABEL[p.b]} | ${f1(p.med)} | ${fmtP(p.p)} | ${fmtP(p.pH!)} |`),
    "",
    "## Checagens de qualidade por registro",
    "",
    "| Registro | Grupo | Idade | Horas gravadas | Horas de uso | Vertical estimada: ângulo até o eixo v | Segundos de caminhada usados | " + names.map((d) => LABEL[d]).join(" | ") + " |",
    "|---|---|---|---|---|---|---|" + names.map(() => "---").join("|") + "|",
    ...results.map((r) => `| ${r.record} | ${r.group} | ${r.age ?? "—"} | ${f1(r.hours)} | ${f1(r.wearHours)} | ${f1(r.upAngleToVerticalDeg)}° | ${r.walkSeconds} | ` + names.map((d) => r.alarms[d].length).join(" | ") + " |"),
    "",
    "## Registros excluídos",
    "",
    ...excluded.map((e) => `- ${e.rec}: ${e.reason}`),
    "",
  ].join("\n");
  writeFileSync(join(OUT, "RESUMO.md"), md);
  writeFileSync(
    join(OUT, "por_registro.csv"),
    ["record,group,age,hours,wear_hours,up_angle_deg," + names.map((d) => `${d}_alarms,${d}_per_day`).join(","), ...results.map((r) => [r.record, r.group, r.age ?? "", r.hours.toFixed(2), r.wearHours.toFixed(2), r.upAngleToVerticalDeg, ...names.flatMap((d) => [r.alarms[d].length, perDay(r, d).toFixed(2)])].join(","))].join("\n") + "\n",
  );
  console.log(md);
}

if (process.argv.includes("--run")) run();
else if (process.argv.includes("--summarize")) summarize();
else console.error("use --run ou --summarize");
