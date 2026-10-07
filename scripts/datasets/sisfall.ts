// Loader da SisFall (Sucerquia et al., Sensors 2017;17(1):198, doi:10.3390/s17010198).
// Lê o espelho em CSV (github.com/krishna-karthikk/SisFall-Dataset): pasta por sujeito,
// um arquivo por tentativa {D##|F##}_{SA##|SE##}_R##.csv, cabeçalho + 9 colunas
// (ADXL345 xyz, ITG3200 xyz, MMA8451Q xyz), valores brutos.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { Sample, Vec3 } from "../../src/detection/types";

export const SISFALL_FS = 200;
/** ADXL345: ±16 g, 13 bits → g = raw · (2·16) / 2^13. */
export const ADXL_TO_G = 32 / 8192;
/** Gravidade "em pé" no referencial do sensor da SisFall (eixo y aponta para baixo; ver docs/ALGORITMOS.md). */
export const SISFALL_UP: Vec3 = [0, -1, 0];

export type SisfallTrial = {
  /** Chave única: "<pasta do sujeito>/<arquivo>". */
  key: string;
  file: string;
  path: string;
  subject: string; // SA01..SE15 — vem da PASTA (ver nota sobre SA15 abaixo)
  /** true se o nome do arquivo cita outro sujeito (no espelho, SA15/D17_SE15_R0*.csv). */
  misnamed: boolean;
  group: "SA" | "SE"; // jovens × idosos
  kind: "F" | "D"; // queda × ADL
  activity: string; // F01..F15, D01..D19
  trial: string; // R01..
};

const NAME_RE = /^([DF]\d{2})_((SA|SE)\d{2})_(R\d{2})\.(csv|txt)$/;
const SUBJECT_RE = /^(SA|SE)\d{2}$/;

export function listSisfall(root: string): SisfallTrial[] {
  const out: SisfallTrial[] = [];
  for (const subj of readdirSync(root).sort()) {
    const dir = join(root, subj);
    if (!SUBJECT_RE.test(subj) || !statSync(dir).isDirectory()) continue;
    for (const file of readdirSync(dir).sort()) {
      const m = NAME_RE.exec(file);
      if (!m) continue;
      // A pasta SA15 contém D17_SE15_R01..R05 com conteúdo DIFERENTE dos arquivos de SE15:
      // são as tentativas D17 do SA15 com nome errado. O sujeito é tirado da pasta.
      out.push({
        key: `${subj}/${file}`,
        file,
        path: join(dir, file),
        subject: subj,
        misnamed: subj !== m[2],
        group: subj.slice(0, 2) as "SA" | "SE",
        kind: m[1][0] as "F" | "D",
        activity: m[1],
        trial: m[4],
      });
    }
  }
  return out;
}

/** Lê o canal ADXL345 em g a 200 Hz. Linhas malformadas (existem no espelho) são descartadas e contadas. */
export function loadSisfall(path: string): { samples: Sample[]; dropped: number } {
  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  const samples: Sample[] = [];
  let dropped = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim().replace(/;$/, "");
    if (!line || /[a-z]/i.test(line)) continue; // vazio ou cabeçalho
    const parts = line.split(",");
    if (parts.length !== 9) {
      dropped++;
      continue;
    }
    const x = Number(parts[0]);
    const y = Number(parts[1]);
    const z = Number(parts[2]);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      dropped++;
      continue;
    }
    // o tempo segue o índice da linha lida (taxa nominal de 200 Hz)
    samples.push({ t: samples.length / SISFALL_FS, ax: x * ADXL_TO_G, ay: y * ADXL_TO_G, az: z * ADXL_TO_G });
  }
  return { samples, dropped };
}
