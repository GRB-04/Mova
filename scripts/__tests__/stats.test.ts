import { describe, expect, it } from "vitest";
import { chi2Sf, clusterBootstrap, cochranQ, holm, mcnemarExact, normalCdf, wilcoxonSignedRank } from "../lib/stats";

describe("estatística", () => {
  it("McNemar exato: valores de referência", () => {
    // b=0, c=6 → p = 2·0,5^6 = 0,03125
    expect(mcnemarExact(0, 6)).toBeCloseTo(0.03125, 6);
    // b=c → p = 1
    expect(mcnemarExact(5, 5)).toBe(1);
    // b=1, c=9 → 2·(1+10)/1024 = 0,021484
    expect(mcnemarExact(1, 9)).toBeCloseTo(0.021484, 5);
  });

  it("Holm: ajuste monotônico", () => {
    const adj = holm([0.01, 0.04, 0.03]);
    expect(adj[0]).toBeCloseTo(0.03, 6);
    expect(adj[2]).toBeCloseTo(0.06, 6);
    expect(adj[1]).toBeCloseTo(0.06, 6);
  });

  it("qui-quadrado: valores tabelados", () => {
    expect(chi2Sf(3.841, 1)).toBeCloseTo(0.05, 3);
    expect(chi2Sf(9.488, 4)).toBeCloseTo(0.05, 3);
  });

  it("Q de Cochran: algoritmos idênticos → Q = 0", () => {
    const m = [[1, 1, 1], [0, 0, 0], [1, 1, 1]];
    expect(cochranQ(m).Q).toBe(0);
  });

  it("bootstrap por cluster: IC contém a estimativa", () => {
    const clusters = [[1, 1, 0], [1, 0], [1, 1, 1], [0, 1]];
    const mean = (x: number[]) => x.reduce((a, b) => a + b, 0) / x.length;
    const r = clusterBootstrap(clusters, mean, 500, 1);
    expect(r.ci[0]).toBeLessThanOrEqual(r.estimate);
    expect(r.ci[1]).toBeGreaterThanOrEqual(r.estimate);
  });
});

describe("Wilcoxon", () => {
  it("normal: valores tabelados", () => {
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 3);
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
  });
  it("diferenças todas positivas e grandes → p pequeno; iguais → p = 1", () => {
    const x = Array.from({ length: 20 }, (_, i) => i + 10);
    const y = Array.from({ length: 20 }, (_, i) => i);
    expect(wilcoxonSignedRank(x, y).p).toBeLessThan(0.001);
    expect(wilcoxonSignedRank(x, x).p).toBe(1);
  });
});
