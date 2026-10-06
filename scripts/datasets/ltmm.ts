// Loader da LTMM — Long Term Movement Monitoring Database (PhysioNet, v1.0.0).
// Weiss A, et al. (2013) e Goldberger AL, et al. (2000) PhysioNet. Ver docs/METODOLOGIA_ANALISES.md, seção 3.
// Formato WFDB: cabeçalho .hea + sinal .dat (formato 16 = int16 little-endian, canais intercalados).
import { closeSync, openSync, readFileSync, readSync } from "node:fs";

export type LtmmChannel = { file: string; gain: number; baseline: number; units: string; name: string };
export type LtmmHeader = { record: string; nSignals: number; fs: number; nSamples: number; channels: LtmmChannel[]; age?: number; sex?: string };

export function parseHeader(text: string): LtmmHeader {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const [record, ns, fs, n] = lines[0].split(/\s+/);
  const nSignals = Number(ns);
  const channels: LtmmChannel[] = lines.slice(1, 1 + nSignals).map((l) => {
    const p = l.split(/\s+/);
    if (p[1] !== "16") throw new Error(`formato WFDB ${p[1]} não suportado`);
    const m = /^([\d.]+)\((-?\d+)\)\/(.+)$/.exec(p[2]);
    if (!m) throw new Error(`ganho inválido: ${p[2]}`);
    return { file: p[0], gain: Number(m[1]), baseline: Number(m[2]), units: m[3], name: p.slice(8).join(" ") };
  });
  const age = lines.find((l) => l.startsWith("#Age:"))?.slice(5);
  const sex = lines.find((l) => l.startsWith("#Sex:"))?.slice(5);
  return { record, nSignals, fs: Number(fs), nSamples: Number(n), channels, age: age ? Number(age) : undefined, sex };
}

/** Faixa medível (g) de um canal: o menor lado entre o máximo e o mínimo do int16. */
export function channelRangeG(c: LtmmChannel): number {
  return Math.min((32767 - c.baseline) / c.gain, (32768 + c.baseline) / c.gain);
}

/**
 * Lê o .dat em blocos e chama `onFrame(i, v, ml, ap)` para cada amostra, com as acelerações em g.
 * Canais usados: v-acceleration, ml-acceleration, ap-acceleration (procurados pelo nome).
 */
export function streamAcc(datPath: string, h: LtmmHeader, onFrame: (i: number, v: number, ml: number, ap: number) => void): number {
  const idx = ["v-acceleration", "ml-acceleration", "ap-acceleration"].map((name) => {
    const k = h.channels.findIndex((c) => c.name === name);
    if (k < 0) throw new Error(`canal ${name} ausente em ${h.record}`);
    return k;
  });
  const [cv, cm, ca] = idx.map((k) => h.channels[k]);
  const frameBytes = 2 * h.nSignals;
  const framesPerChunk = 1 << 16;
  const buf = Buffer.alloc(frameBytes * framesPerChunk);
  const fd = openSync(datPath, "r");
  let i = 0;
  try {
    for (;;) {
      const got = readSync(fd, buf, 0, buf.length, null);
      if (got <= 0) break;
      const frames = Math.floor(got / frameBytes);
      for (let f = 0; f < frames; f++) {
        const o = f * frameBytes;
        const v = (buf.readInt16LE(o + 2 * idx[0]) - cv.baseline) / cv.gain;
        const ml = (buf.readInt16LE(o + 2 * idx[1]) - cm.baseline) / cm.gain;
        const ap = (buf.readInt16LE(o + 2 * idx[2]) - ca.baseline) / ca.gain;
        onFrame(i++, v, ml, ap);
      }
      if (got % frameBytes !== 0) throw new Error("leitura desalinhada");
    }
  } finally {
    closeSync(fd);
  }
  return i;
}

export function readHeader(path: string): LtmmHeader {
  return parseHeader(readFileSync(path, "utf8"));
}
