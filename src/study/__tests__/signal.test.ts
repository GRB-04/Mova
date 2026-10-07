import { describe, expect, it } from "vitest";
import {
  PRE_S,
  downsampleMinMax,
  parseAlarms,
  parseMarkers,
  parseSamples,
  sessionDirName,
  signalStats,
  trialSpan,
} from "../signal";
import { GRACE_S } from "../scoring";

const SAMPLES_HEADER = "session_id,sensor,t_native_s,t_js_ms,x,y,z\n";

describe("janela da tentativa", () => {
  it("usa tStart/tEnd gravados quando existem", () => {
    const span = trialSpan({ id: "S_999", sessionId: "S", durationS: 3, tStart: 100.25, tEnd: 103.25 });
    expect(span).toEqual({ tStart: 100.25, tEnd: 103.25 });
  });

  it("tentativas antigas: recupera tStart pelo id e tEnd pela duração", () => {
    const span = trialSpan({ id: "20261006_210000_12345678", sessionId: "20261006_210000", durationS: 4.5 });
    expect(span!.tStart).toBeCloseTo(12345.678, 6);
    expect(span!.tEnd).toBeCloseTo(12350.178, 6);
  });

  it("id fora do padrão: sem janela", () => {
    expect(trialSpan({ id: "estranho", sessionId: "S", durationS: 1 })).toBeNull();
  });

  it("pasta da sessão = sessionId_voluntário (igual ao RecorderScreen)", () => {
    expect(sessionDirName({ sessionId: "20261006_210000", volunteer: " V01 " })).toBe("20261006_210000_V01");
  });
});

describe("leitura do samples.csv", () => {
  const csv =
    SAMPLES_HEADER +
    "S,acc,9.000000,1,0,0,1\n" +
    "S,acc,10.000000,2,0,-1,0\n" +
    "S,acc,10.500000,3,3,4,0\n" +
    "S,acc,12.000000,4,0,0,1\n";

  it("recorta pelo tempo do sensor (bordas inclusas) e calcula |a|", () => {
    const s = parseSamples(csv, 10, 10.5);
    expect(s.map((r) => r.t)).toEqual([10, 10.5]);
    expect(s[0]).toMatchObject({ x: 0, y: -1, z: 0, m: 1 });
    expect(s[1].m).toBeCloseTo(5, 10);
  });

  it("ignora cabeçalho, linhas vazias e linhas quebradas", () => {
    const s = parseSamples(SAMPLES_HEADER + "\nS,acc,1,1,0,0,1\nS,acc,lixo\n", 0, 5);
    expect(s).toHaveLength(1);
  });

  it("aceita fim de linha do Windows", () => {
    expect(parseSamples(csv.replace(/\n/g, "\r\n"), 0, 20)).toHaveLength(4);
  });
});

describe("leitura do alarms.csv e events.csv", () => {
  it("alarmes: detalhes entre aspas com vírgulas não quebram a leitura", () => {
    const csv =
      "session_id,algorithm,t_native_s,t_js_ms_est,details\n" +
      'S,kangas-faithful,10.2000,5,"{""svTot"":2.1,""lying"":true}"\n' +
      "S,bourke3,50.0000,6,{}\n";
    expect(parseAlarms(csv, 0, 20)).toEqual([{ algorithm: "kangas-faithful", t: 10.2 }]);
  });

  it("marcadores: só eventos 'marker' dentro da janela", () => {
    const csv =
      "session_id,event,label,t_js_ms,t_native_s_est\n" +
      "S,trial_start,pular,1,10.0000\n" +
      "S,marker,pular,2,11.5000\n" +
      'S,marker,"queda, teste",3,12.0000\n' +
      "S,marker,pular,4,99.0000\n";
    expect(parseMarkers(csv, 0, 20)).toEqual([11.5, 12]);
  });
});

describe("redução de pontos (mín/máx por faixa)", () => {
  const mk = (n: number, peakAt: number) =>
    Array.from({ length: n }, (_, i) => ({ t: i / 100, x: 0, y: 0, z: 1, m: i === peakAt ? 4.2 : i === peakAt + 1 ? 0.1 : 1 }));

  it("preserva o pico e o vale mesmo reduzindo muito", () => {
    const pts = downsampleMinMax(mk(5000, 3333), (s) => s.m, 50);
    expect(pts.length).toBeLessThanOrEqual(100);
    expect(Math.max(...pts.map((p) => p.v))).toBe(4.2);
    expect(Math.min(...pts.map((p) => p.v))).toBe(0.1);
  });

  it("mantém a ordem no tempo", () => {
    const pts = downsampleMinMax(mk(1000, 10), (s) => s.m, 20);
    for (let i = 1; i < pts.length; i++) expect(pts[i].t).toBeGreaterThanOrEqual(pts[i - 1].t);
  });

  it("poucos pontos: devolve todos", () => {
    expect(downsampleMinMax(mk(10, 3), (s) => s.m, 50)).toHaveLength(10);
  });
});

describe("resumo do sinal", () => {
  it("pico, mínimo e taxa medida pelo tempo do sensor", () => {
    const s = [0, 0.02, 0.04, 0.06].map((t, i) => ({ t, x: 0, y: 0, z: 0, m: [1, 3, 0.2, 1][i] }));
    const st = signalStats(s);
    expect(st).toMatchObject({ n: 4, max: 3, tMax: 0.02, min: 0.2 });
    expect(st.rateHz).toBeCloseTo(50, 6);
  });

  it("sem amostras", () => {
    expect(signalStats([]).n).toBe(0);
  });
});

it("janela padrão do gráfico: PRE_S antes e GRACE_S depois", () => {
  expect(PRE_S).toBeGreaterThan(0);
  expect(GRACE_S).toBe(5);
});
