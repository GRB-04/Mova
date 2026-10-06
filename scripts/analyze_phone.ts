// Etapa 10: análise das sessões gravadas no celular (RecorderScreen).
// Uso: npx tsx scripts/analyze_phone.ts --sessions <pasta com as sessões> [--out results]
//
// Cada sessão é uma pasta com samples.csv, events.csv, alarms.csv e session.json.
// 1. Reprocessa samples.csv offline com os MESMOS detectores do app e compara com alarms.csv (validação).
// 2. Tentativa de queda (rótulo "queda ..."): VP se houver alarme entre −1 s e +5 s do marcador
//    (se não houver marcador, qualquer alarme dentro da tentativa).
// 3. Tentativa de ADL: FP se houver qualquer alarme dentro da tentativa.
// 4. "uso livre": alarmes falsos por hora.
import { readdirSync, readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createStudyDetectors, Vec3 } from "../src/detection";
import { ci, metrics, pct } from "./lib/metrics";

const argv = process.argv;
const arg = (k: string, d?: string) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const root = arg("sessions");
const outDir = arg("out", "results")!;
if (!root) throw new Error("use --sessions <pasta>");

type Ev = { event: string; label: string; tJs: number; tNative: number };
type Trial = { session: string; position: string; label: string; isFall: boolean; isFree: boolean; t0: number; t1: number; markers: number[] };
type Alarm = { algorithm: string; t: number };

function parseCsv(path: string): string[][] {
  const text = readFileSync(path, "utf8").trim();
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .slice(1)
    .map((l) => {
      const out: string[] = [];
      let cur = "";
      let q = false;
      for (let i = 0; i < l.length; i++) {
        const c = l[i];
        if (q) {
          if (c === '"' && l[i + 1] === '"') (cur += '"'), i++;
          else if (c === '"') q = false;
          else cur += c;
        } else if (c === '"') q = true;
        else if (c === ",") out.push(cur), (cur = "");
        else cur += c;
      }
      out.push(cur);
      return out;
    });
}

const trials: Trial[] = [];
const offlineAlarms = new Map<string, Alarm[]>(); // por sessão
const agreement: string[] = [];
let algorithms: string[] = [];
const sessionDirs = readdirSync(root).filter((d) => existsSync(join(root, d, "samples.csv"))).sort();
if (!sessionDirs.length) throw new Error(`nenhuma sessão em ${root}`);

for (const dir of sessionDirs) {
  const p = (f: string) => join(root, dir, f);
  const meta = JSON.parse(readFileSync(p("session.json"), "utf8"));
  const anchor = meta.anchor as { tNative: number; tJs: number } | null;
  const toNative = (tJs: number) => (anchor ? anchor.tNative + (tJs - anchor.tJs) / 1000 : NaN);
  const events: Ev[] = parseCsv(p("events.csv")).map((r) => ({ event: r[1], label: r[2], tJs: Number(r[3]), tNative: toNative(Number(r[3])) }));

  // tentativas e marcadores
  let open: Trial | null = null;
  for (const e of events) {
    if (e.event === "trial_start") {
      open = {
        session: dir,
        position: meta.phone_position,
        label: e.label,
        isFall: e.label.startsWith("queda"),
        isFree: e.label === "uso livre",
        t0: e.tNative,
        t1: NaN,
        markers: [],
      };
    } else if (e.event === "marker" && open) open.markers.push(e.tNative);
    else if (e.event === "trial_end" && open) {
      open.t1 = e.tNative;
      trials.push(open);
      open = null;
    }
  }

  // reprocessamento offline
  const dets = createStudyDetectors();
  algorithms = dets.map((d) => d.name);
  const calib = events.find((e) => e.event === "calibration_end");
  const ref = calib ? (calib.label.split(" ").map(Number) as Vec3) : null;
  let refApplied = false;
  const alarms: Alarm[] = [];
  for (const r of parseCsv(p("samples.csv"))) {
    const t = Number(r[2]);
    if (ref && !refApplied && t >= calib!.tNative) {
      dets.forEach((d) => d.setUpReference?.(ref));
      refApplied = true;
    }
    const s = { t, ax: Number(r[4]), ay: Number(r[5]), az: Number(r[6]) };
    for (const d of dets) for (const ev of d.push(s)) alarms.push({ algorithm: ev.algorithm, t: ev.t });
  }
  offlineAlarms.set(dir, alarms);

  // concordância ao vivo × offline (±0,1 s)
  const live: Alarm[] = parseCsv(p("alarms.csv")).map((r) => ({ algorithm: r[1], t: Number(r[2]) }));
  for (const alg of algorithms) {
    const a = live.filter((x) => x.algorithm === alg);
    const b = alarms.filter((x) => x.algorithm === alg);
    const matched = a.filter((x) => b.some((y) => Math.abs(x.t - y.t) <= 0.1)).length;
    agreement.push(`| ${dir} | ${alg} | ${a.length} | ${b.length} | ${matched} |`);
  }
}

// ── pontuação ──
type Score = { tp: number; fn: number; tn: number; fp: number; freeAlarms: number; freeHours: number };
const empty = (): Score => ({ tp: 0, fn: 0, tn: 0, fp: 0, freeAlarms: 0, freeHours: 0 });
const byKey = new Map<string, Score>();
const add = (key: string, f: (s: Score) => void) => {
  if (!byKey.has(key)) byKey.set(key, empty());
  f(byKey.get(key)!);
};
const trialRows: string[] = [];

for (const tr of trials) {
  const alarms = offlineAlarms.get(tr.session)!;
  for (const alg of algorithms) {
    const inTrial = alarms.filter((a) => a.algorithm === alg && a.t >= tr.t0 && a.t <= tr.t1);
    let hit: boolean;
    if (tr.isFall && tr.markers.length) {
      hit = tr.markers.some((m) => alarms.some((a) => a.algorithm === alg && a.t >= m - 1 && a.t <= m + 5));
    } else hit = inTrial.length > 0;
    trialRows.push([tr.session, tr.position, csv(tr.label), alg, tr.isFall ? "F" : tr.isFree ? "livre" : "D", (tr.t1 - tr.t0).toFixed(1), inTrial.length, hit ? 1 : 0].join(","));
    for (const key of [`${alg}|todas`, `${alg}|${tr.position}`]) {
      add(key, (s) => {
        if (tr.isFree) {
          s.freeAlarms += inTrial.length;
          s.freeHours += (tr.t1 - tr.t0) / 3600;
        } else if (tr.isFall) hit ? s.tp++ : s.fn++;
        else hit ? s.fp++ : s.tn++;
      });
    }
  }
}
function csv(s: string) {
  return /[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const actRows = [...new Set(trials.map((t) => t.label))].sort().flatMap((label) =>
  algorithms.map((alg) => {
    const rows = trialRows.filter((r) => r.split(",")[3] === alg && r.includes(`,${csv(label)},`));
    const hits = rows.filter((r) => r.endsWith(",1")).length;
    return `| ${label} | ${alg} | ${rows.length} | ${hits} | ${pct(hits / rows.length)} |`;
  }),
);

const md = [
  "## Celular: resultados por algoritmo × posição",
  "",
  `Sessões: ${sessionDirs.length}. Tentativas: ${trials.length}. Pontuação com os alarmes do reprocessamento offline.`,
  "",
  "| Algoritmo | Posição | VP | FN | VN | FP | SE % (IC95) | SP % (IC95) | Uso livre (h) | Alarmes falsos/h |",
  "|---|---|---|---|---|---|---|---|---|---|",
  ...[...byKey.entries()].sort().map(([k, s]) => {
    const [alg, pos] = k.split("|");
    const m = metrics(s);
    const fph = s.freeHours ? (s.freeAlarms / s.freeHours).toFixed(2) : "—";
    return `| ${alg} | ${pos} | ${s.tp} | ${s.fn} | ${s.tn} | ${s.fp} | ${pct(m.se)} (${ci(m.seCI)}) | ${pct(m.sp)} (${ci(m.spCI)}) | ${s.freeHours.toFixed(2)} | ${fph} |`;
  }),
  "",
  "### Taxa de alarme por atividade",
  "",
  "| Atividade | Algoritmo | Tentativas | Com alarme | % |",
  "|---|---|---|---|---|",
  ...actRows,
  "",
  "### Validação: alarmes ao vivo × reprocessamento offline (±0,1 s)",
  "",
  "| Sessão | Algoritmo | Ao vivo | Offline | Coincidentes |",
  "|---|---|---|---|---|",
  ...agreement,
  "",
].join("\n");

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "celular_tentativas.csv"), "session,position,activity,algorithm,kind,duration_s,n_alarms,hit\n" + trialRows.join("\n") + "\n");
writeFileSync(join(outDir, "celular_resumo.md"), md);
console.log(md);
