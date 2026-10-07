// Comparação estatística entre os algoritmos na SisFall (condição principal: 50/100 Hz, ±8 g).
// Uso: npx tsx scripts/stats_sisfall.ts [--results results] [--suffix ""] [--out results/estatistica.md]
// Lê results/sisfall_<variante><suffix>.csv gerados por scripts/replay.ts.
// Métodos e justificativas: docs/METODOLOGIA_ANALISES.md (seção 1).
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { wilson } from "../src/study/scoring";
import { clusterBootstrap, cochranQ, holm, mcnemarExact } from "./lib/stats";

const argv = process.argv;
const arg = (k: string, d: string) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const dir = arg("results", "results");
const suffix = arg("suffix", "");
const out = arg("out", join(dir, `estatistica${suffix}.md`));

export const MAIN_VARIANTS = ["mova-legado", "kangas-faithful", "kangas-guardian", "bourke3", "pipto", "pipto-streaming"];
const LABEL: Record<string, string> = {
  "mova-legado": "Mova antigo",
  "kangas-faithful": "Kangas",
  "kangas-guardian": "Kangas (eixo z)",
  bourke3: "Bourke3",
  pipto: "PIPTO (original)",
  "pipto-streaming": "PIPTO (tempo real)",
};

type Row = { key: string; subject: string; kind: "F" | "D"; alarm: Record<string, 0 | 1> };

// ── carrega e alinha os arquivos (mesmos casos para todos os algoritmos: dados PAREADOS) ──
const rows = new Map<string, Row>();
for (const v of MAIN_VARIANTS) {
  const lines = readFileSync(join(dir, `sisfall_${v}${suffix}.csv`), "utf8").trim().split("\n");
  const h = lines[0].split(",");
  const iKey = h.indexOf("file");
  const iSubj = h.indexOf("subject");
  const iKind = h.indexOf("kind");
  const iN = h.indexOf("n_alarms");
  for (const l of lines.slice(1)) {
    const c = l.split(",");
    const key = c[iKey];
    if (!rows.has(key)) rows.set(key, { key, subject: c[iSubj], kind: c[iKind] as "F" | "D", alarm: {} });
    rows.get(key)!.alarm[v] = Number(c[iN]) > 0 ? 1 : 0;
  }
}
const all = [...rows.values()].filter((r) => MAIN_VARIANTS.every((v) => v in r.alarm));
const falls = all.filter((r) => r.kind === "F");
const adls = all.filter((r) => r.kind === "D");

const bySubject = (rs: Row[]) => {
  const m = new Map<string, Row[]>();
  for (const r of rs) {
    if (!m.has(r.subject)) m.set(r.subject, []);
    m.get(r.subject)!.push(r);
  }
  return [...m.values()];
};
const fallClusters = bySubject(falls);
const adlClusters = bySubject(adls);

// "acerto": queda com alarme (SE) / ADL sem alarme (SP)
const ok = (r: Row, v: string) => (r.kind === "F" ? r.alarm[v] : 1 - r.alarm[v]);
const rate = (rs: Row[], v: string) => rs.reduce((a, r) => a + ok(r, v), 0) / rs.length;

const pct = (x: number) => (100 * x).toFixed(1);
const ci = ([a, b]: [number, number]) => `${pct(a)}–${pct(b)}`;
const fmtP = (p: number) => (p < 0.001 ? "< 0,001" : p.toFixed(3).replace(".", ","));

// ── 1. estimativas com dois tipos de IC ──
const est = MAIN_VARIANTS.map((v) => {
  const kF = falls.reduce((a, r) => a + ok(r, v), 0);
  const kD = adls.reduce((a, r) => a + ok(r, v), 0);
  return {
    v,
    se: kF / falls.length,
    seWilson: wilson(kF, falls.length),
    seBoot: clusterBootstrap(fallClusters, (s) => rate(s, v)).ci,
    sp: kD / adls.length,
    spWilson: wilson(kD, adls.length),
    spBoot: clusterBootstrap(adlClusters, (s) => rate(s, v)).ci,
  };
});

// ── 2. omnibus (Q de Cochran) ──
const qF = cochranQ(falls.map((r) => MAIN_VARIANTS.map((v) => ok(r, v))));
const qD = cochranQ(adls.map((r) => MAIN_VARIANTS.map((v) => ok(r, v))));

// ── 3. pares: McNemar exato + Holm + diferença com IC por bootstrap de participante ──
type Pair = { a: string; b: string; metric: "SE" | "SP"; diff: number; diffCI: [number, number]; onlyA: number; onlyB: number; p: number; pHolm?: number };
const pairs: Pair[] = [];
for (let i = 0; i < MAIN_VARIANTS.length; i++) {
  for (let j = i + 1; j < MAIN_VARIANTS.length; j++) {
    const a = MAIN_VARIANTS[i];
    const b = MAIN_VARIANTS[j];
    for (const [metric, rs, cl] of [["SE", falls, fallClusters], ["SP", adls, adlClusters]] as const) {
      let onlyA = 0;
      let onlyB = 0;
      for (const r of rs) {
        const x = ok(r, a);
        const y = ok(r, b);
        if (x && !y) onlyA++;
        if (!x && y) onlyB++;
      }
      const boot = clusterBootstrap(cl, (s) => rate(s, a) - rate(s, b), 2000, 7 + i * 31 + j);
      pairs.push({ a, b, metric, diff: boot.estimate, diffCI: boot.ci, onlyA, onlyB, p: mcnemarExact(onlyA, onlyB) });
    }
  }
}
const adj = holm(pairs.map((p) => p.p));
pairs.forEach((p, i) => (p.pHolm = adj[i]));

// ── saída ──
const verdict = (p: Pair) => {
  const sig = (p.pHolm ?? 1) < 0.05;
  const ciExcl0 = p.diffCI[0] > 0 || p.diffCI[1] < 0;
  if (sig && ciExcl0) return p.diff > 0 ? `**${LABEL[p.a]} melhor**` : `**${LABEL[p.b]} melhor**`;
  if (sig !== ciExcl0) return "inconclusivo (testes discordam)";
  return "sem diferença demonstrada";
};
const pairTable = (metric: "SE" | "SP") => [
  `| A | B | A − B (pontos %) | IC 95% bootstrap por participante | só A acertou | só B acertou | p McNemar exato | p Holm | Conclusão |`,
  `|---|---|---|---|---|---|---|---|---|`,
  ...pairs
    .filter((p) => p.metric === metric)
    .map((p) => `| ${LABEL[p.a]} | ${LABEL[p.b]} | ${(100 * p.diff).toFixed(1)} | ${(100 * p.diffCI[0]).toFixed(1)} a ${(100 * p.diffCI[1]).toFixed(1)} | ${p.onlyA} | ${p.onlyB} | ${fmtP(p.p)} | ${fmtP(p.pHolm!)} | ${verdict(p)} |`),
];

const md = [
  `# Comparação estatística entre os algoritmos (SisFall${suffix ? `, ${suffix}` : ""})`,
  "",
  `Casos pareados: ${falls.length} quedas (${fallClusters.length} participantes com quedas) e ${adls.length} ADLs (${adlClusters.length} participantes). Todos os algoritmos foram avaliados nos MESMOS arquivos.`,
  "Métodos e justificativas: `docs/METODOLOGIA_ANALISES.md`, seção 1.",
  "",
  "## 1. Sensibilidade (SE) e especificidade (SP) com dois intervalos de confiança",
  "",
  "O IC de Wilson trata cada arquivo como independente. O IC por bootstrap de participante reamostra PESSOAS e é o mais honesto quando há várias tentativas por pessoa. Quando o segundo é bem mais largo, a precisão real é menor do que o número de arquivos sugere.",
  "",
  "| Algoritmo | SE % | IC Wilson | IC bootstrap (participante) | SP % | IC Wilson | IC bootstrap (participante) |",
  "|---|---|---|---|---|---|---|",
  ...est.map((e) => `| ${LABEL[e.v]} | ${pct(e.se)} | ${ci(e.seWilson)} | ${ci(e.seBoot)} | ${pct(e.sp)} | ${ci(e.spWilson)} | ${ci(e.spBoot)} |`),
  "",
  "## 2. Teste global (Q de Cochran): os algoritmos diferem entre si?",
  "",
  `- Quedas (SE): Q = ${qF.Q.toFixed(1)}, gl = ${qF.df}, p ${fmtP(qF.p)}`,
  `- ADLs (SP): Q = ${qD.Q.toFixed(1)}, gl = ${qD.df}, p ${fmtP(qD.p)}`,
  "",
  "## 3. Comparações par a par: sensibilidade (quedas)",
  "",
  "\"Só A acertou\" = quedas que A detectou e B não. Correção de Holm sobre as 30 comparações (15 pares × 2 métricas).",
  "A conclusão exige que o McNemar (corrigido) e o IC por participante concordem.",
  "",
  ...pairTable("SE"),
  "",
  "## 4. Comparações par a par: especificidade (ADLs)",
  "",
  "\"Só A acertou\" = ADLs em que A NÃO deu alarme e B deu.",
  "",
  ...pairTable("SP"),
  "",
].join("\n");
writeFileSync(out, md);
console.log(md);
