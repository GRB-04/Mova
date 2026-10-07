// Teste de equivalência: porte TS (src/detection/pipto.ts) × PIPTO original em Python.
// Pré-requisitos:
//   npx tsx scripts/replay.ts --detector pipto --dump-pipto data/cache/pipto50
//   python3 scripts/pipto_original.py cache  data/cache/pipto50 data/cache/pipto_python_50hz.json
//   python3 scripts/pipto_original.py native data/SisFall       data/cache/pipto_python_200hz.json
// Uso: npx tsx scripts/pipto_equivalence.ts [--out results]
// Critério: mesmos alarmes, com tolerância de ±1 amostra em cada extremo.
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { piptoOffline } from "../src/detection/pipto";
import { norm } from "../src/detection/types";
import { listSisfall, loadSisfall, SISFALL_FS } from "./datasets/sisfall";
import { ci, metrics, pct } from "./lib/metrics";

const outDir = process.argv.includes("--out") ? process.argv[process.argv.indexOf("--out") + 1] : "results";
type PyRes = Record<string, [number, number][] | string>;

function compare(label: string, hz: number, py: PyRes, ts: Map<string, [number, number][]>) {
  const tol = (100 / hz) * 1 + 1e-6; // 1 amostra em unidades de "entry"
  let same = 0;
  let pyErrors = 0;
  const diffs: string[] = [];
  for (const [file, falls] of ts) {
    const p = py[file];
    if (p === undefined) {
      diffs.push(`${file}: ausente no Python`);
      continue;
    }
    if (typeof p === "string") {
      pyErrors++;
      diffs.push(`${file}: Python lançou ${p}`);
      continue;
    }
    const ok = p.length === falls.length && p.every((f, i) => Math.abs(f[0] - falls[i][0]) <= tol && Math.abs(f[1] - falls[i][1]) <= tol);
    if (ok) same++;
    else diffs.push(`${file}: Python ${JSON.stringify(p)} × TS ${JSON.stringify(falls)}`);
  }
  return { label, n: ts.size, same, pyErrors, diffs };
}

function score(label: string, res: Map<string, number>) {
  const trials = new Map(listSisfall("data/SisFall").flatMap((t) => [[t.key, t], [t.key.replace("/", "_"), t]] as const));
  const c = { tp: 0, fn: 0, tn: 0, fp: 0 };
  for (const [file, n] of res) {
    const t = trials.get(file);
    if (!t) continue;
    if (t.kind === "F") n > 0 ? c.tp++ : c.fn++;
    else n > 0 ? c.fp++ : c.tn++;
  }
  const m = metrics(c);
  return `| ${label} | ${m.tp} | ${m.fn} | ${m.tn} | ${m.fp} | ${pct(m.se)} (${ci(m.seCI)}) | ${pct(m.sp)} (${ci(m.spCI)}) | ${pct(m.precision)} | ${pct(m.f1)} |`;
}

const reports: ReturnType<typeof compare>[] = [];
const rows: string[] = [];

// 50 Hz (mesmo sinal pré-processado do replay)
const py50Path = "data/cache/pipto_python_50hz.json";
if (existsSync(py50Path)) {
  const py50: PyRes = JSON.parse(readFileSync(py50Path, "utf8"));
  const ts50 = new Map<string, [number, number][]>();
  for (const f of readdirSync("data/cache/pipto50").sort()) {
    const lines: string[] = readFileSync(join("data/cache/pipto50", f), "utf8").trim().split("\n").slice(1);
    const t = lines.map((l) => Number(l.split(",")[0]));
    const v = lines.map((l) => Number(l.split(",")[1]));
    ts50.set(f, piptoOffline(v, t, 50).falls);
  }
  reports.push(compare("50 Hz, ±8 g (sinal do replay)", 50, py50, ts50));
  rows.push(score("Python original, 50 Hz ±8 g", new Map(Object.entries(py50).map(([k, v]) => [k, typeof v === "string" ? 0 : v.length]))));
  rows.push(score("Porte TS, 50 Hz ±8 g", new Map([...ts50].map(([k, v]) => [k, v.length]))));
}

// 200 Hz nativo (condição próxima à dos autores)
const py200Path = "data/cache/pipto_python_200hz.json";
if (existsSync(py200Path)) {
  const py200: PyRes = JSON.parse(readFileSync(py200Path, "utf8"));
  const ts200 = new Map<string, [number, number][]>();
  for (const tr of listSisfall("data/SisFall")) {
    const { samples } = loadSisfall(tr.path);
    ts200.set(tr.key, piptoOffline(samples.map((s) => norm(s.ax, s.ay, s.az) * 9.807), samples.map((s) => s.t), SISFALL_FS).falls);
  }
  reports.push(compare("200 Hz nativo, sem clip", 200, py200, ts200));
  rows.push(score("Python original, 200 Hz nativo", new Map(Object.entries(py200).map(([k, v]) => [k, typeof v === "string" ? 0 : v.length]))));
  rows.push(score("Porte TS, 200 Hz nativo", new Map([...ts200].map(([k, v]) => [k, v.length]))));
}

if (!reports.length) throw new Error("nenhuma saída do Python encontrada em data/cache/");

const md = [
  "## Equivalência PIPTO: porte TS × Python original",
  "",
  "| Condição | Arquivos | Iguais (±1 amostra) | Exceções no Python |",
  "|---|---|---|---|",
  ...reports.map((r) => `| ${r.label} | ${r.n} | ${r.same} (${pct(r.same / r.n)}%) | ${r.pyErrors} |`),
  "",
  "| Execução | VP | FN | VN | FP | SE % (IC95) | SP % (IC95) | Precisão % | F1 % |",
  "|---|---|---|---|---|---|---|---|---|",
  ...rows,
  "",
  ...reports.flatMap((r) => (r.diffs.length ? [`Divergências (${r.label}), até 20:`, "", ...r.diffs.slice(0, 20).map((d) => `- ${d}`), ""] : [])),
].join("\n");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "pipto_equivalencia.md"), md + "\n");
console.log(md);
const allSame = reports.every((r) => r.same === r.n);
process.exit(allSame ? 0 : 1);
