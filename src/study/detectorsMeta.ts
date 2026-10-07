// Nome amigável e cor de cada detector na tela de resultados.
// A cor segue o detector (nunca a posição no ranking). Paleta categórica validada
// (CVD e contraste ≥ 3:1) contra o fundo dos cartões #111827.
export const DETECTOR_META: Record<string, { label: string; color: string; note: string }> = {
  "mova-legado": { label: "Mova antigo", color: "#3987e5", note: "|a| > 2,5 g, sem postura" },
  "kangas-faithful": { label: "Kangas", color: "#d95926", note: "queda livre + impacto + deitado" },
  "kangas-guardian": { label: "Kangas (eixo z)", color: "#199e70", note: "postura pelo eixo z do celular" },
  bourke3: { label: "Bourke3", color: "#c98500", note: "velocidade + impacto + deitado" },
  "pipto-streaming": { label: "PIPTO", color: "#d55181", note: "queda livre + impacto + repouso" },
};

export const meta = (d: string) => DETECTOR_META[d] ?? { label: d, color: "#94A3B8", note: "" };
