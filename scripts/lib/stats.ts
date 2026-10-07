// Testes estatísticos usados no estudo (sem dependências externas).
// Justificativa de cada escolha: docs/METODOLOGIA_ANALISES.md.

/** Gerador pseudoaleatório determinístico (mulberry32): resultados reprodutíveis com semente fixa. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function logFactorial(n: number): number {
  let s = 0;
  for (let i = 2; i <= n; i++) s += Math.log(i);
  return s;
}

/** P(X ≤ k) para X ~ Binomial(n, 1/2), em escala segura para n grande. */
function binomCdfHalf(k: number, n: number): number {
  if (k < 0) return 0;
  if (k >= n) return 1;
  const lf = logFactorial(n);
  let acc = 0;
  for (let i = 0; i <= k; i++) acc += Math.exp(lf - logFactorial(i) - logFactorial(n - i) - n * Math.LN2);
  return Math.min(1, acc);
}

/**
 * Teste de McNemar EXATO (binomial) para proporções pareadas.
 * b = casos em que só A acertou; c = casos em que só B acertou.
 * p bilateral = 2·P(X ≤ min(b,c)), X ~ Bin(b+c, 1/2), limitado a 1.
 */
export function mcnemarExact(b: number, c: number): number {
  const n = b + c;
  if (n === 0) return 1;
  return Math.min(1, 2 * binomCdfHalf(Math.min(b, c), n));
}

/** Correção de Holm–Bonferroni: devolve p ajustados na ordem original. */
export function holm(ps: number[]): number[] {
  const idx = ps.map((p, i) => [p, i] as const).sort((a, b) => a[0] - b[0]);
  const m = ps.length;
  const adj = new Array<number>(m);
  let running = 0;
  idx.forEach(([p, i], k) => {
    running = Math.max(running, Math.min(1, (m - k) * p));
    adj[i] = running;
  });
  return adj;
}

/** Função gama incompleta regularizada superior Q(s, x) — para o p-valor do qui-quadrado. */
function gammaQ(s: number, x: number): number {
  if (x <= 0) return 1;
  const lnGamma = (z: number): number => {
    const g = 7;
    const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
    z -= 1;
    let a = c[0];
    const t = z + g + 0.5;
    for (let i = 1; i < g + 2; i++) a += c[i] / (z + i);
    return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a);
  };
  if (x < s + 1) {
    // série para P, devolve 1 − P
    let sum = 1 / s;
    let term = sum;
    for (let n = 1; n < 500; n++) {
      term *= x / (s + n);
      sum += term;
      if (Math.abs(term) < Math.abs(sum) * 1e-15) break;
    }
    return 1 - sum * Math.exp(-x + s * Math.log(x) - lnGamma(s));
  }
  // fração continuada (Lentz) para Q
  let b = x + 1 - s;
  let c = 1e300;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 500; i++) {
    const an = -i * (i - s);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < 1e-300) d = 1e-300;
    c = b + an / c;
    if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-15) break;
  }
  return Math.exp(-x + s * Math.log(x) - lnGamma(s)) * h;
}

export function chi2Sf(x: number, df: number): number {
  return gammaQ(df / 2, x / 2);
}

/**
 * Teste Q de Cochran (omnibus): k algoritmos aplicados aos mesmos casos, resultado binário.
 * H0: todos os algoritmos têm a mesma taxa de sucesso.
 * @param m matriz casos × algoritmos (0/1)
 */
export function cochranQ(m: number[][]): { Q: number; df: number; p: number } {
  const k = m[0]?.length ?? 0;
  const colSums = new Array(k).fill(0);
  let rowSq = 0;
  let total = 0;
  for (const row of m) {
    const r = row.reduce((a, b) => a + b, 0);
    rowSq += r * r;
    total += r;
    row.forEach((v, j) => (colSums[j] += v));
  }
  const num = (k - 1) * (k * colSums.reduce((a, c) => a + c * c, 0) - total * total);
  const den = k * total - rowSq;
  const Q = den === 0 ? 0 : num / den;
  return { Q, df: k - 1, p: den === 0 ? 1 : chi2Sf(Q, k - 1) };
}

/**
 * Bootstrap por CLUSTER (participante): reamostra participantes com reposição e recalcula a estatística.
 * Respeita a dependência entre tentativas de uma mesma pessoa.
 * Devolve o IC percentil 95%.
 */
export function clusterBootstrap<T>(
  clusters: T[][],
  stat: (sample: T[]) => number,
  reps = 2000,
  seed = 20261006,
): { estimate: number; ci: [number, number] } {
  const r = rng(seed);
  const all = clusters.flat();
  const est = stat(all);
  const vals: number[] = [];
  for (let i = 0; i < reps; i++) {
    const sample: T[] = [];
    for (let j = 0; j < clusters.length; j++) sample.push(...clusters[Math.floor(r() * clusters.length)]);
    const v = stat(sample);
    if (Number.isFinite(v)) vals.push(v);
  }
  vals.sort((a, b) => a - b);
  const q = (p: number) => vals[Math.min(vals.length - 1, Math.max(0, Math.floor(p * vals.length)))];
  return { estimate: est, ci: [q(0.025), q(0.975)] };
}

/** CDF da normal padrão (Abramowitz–Stegun 7.1.26 via erf). */
export function normalCdf(z: number): number {
  const t = 1 / (1 + 0.3275911 * (Math.abs(z) / Math.SQRT2));
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}

/**
 * Teste dos postos sinalizados de Wilcoxon (pareado), bilateral, aproximação normal com
 * correção de empates e de continuidade. Pares com diferença zero são descartados (Wilcoxon).
 */
export function wilcoxonSignedRank(x: number[], y: number[]): { W: number; n: number; z: number; p: number } {
  const d = x.map((v, i) => v - y[i]).filter((v) => v !== 0);
  const n = d.length;
  if (n === 0) return { W: 0, n: 0, z: 0, p: 1 };
  const abs = d.map((v, i) => ({ a: Math.abs(v), s: Math.sign(v), i })).sort((p, q) => p.a - q.a);
  const ranks = new Array<number>(n);
  let tie = 0;
  for (let i = 0; i < n; ) {
    let j = i;
    while (j + 1 < n && abs[j + 1].a === abs[i].a) j++;
    const r = (i + j + 2) / 2;
    for (let k = i; k <= j; k++) ranks[k] = r;
    const t = j - i + 1;
    tie += t * t * t - t;
    i = j + 1;
  }
  const Wplus = abs.reduce((acc, e, k) => acc + (e.s > 0 ? ranks[k] : 0), 0);
  const mean = (n * (n + 1)) / 4;
  const sd = Math.sqrt((n * (n + 1) * (2 * n + 1)) / 24 - tie / 48);
  const z = sd === 0 ? 0 : (Wplus - mean - 0.5 * Math.sign(Wplus - mean)) / sd;
  return { W: Wplus, n, z, p: Math.min(1, 2 * (1 - normalCdf(Math.abs(z)))) };
}
