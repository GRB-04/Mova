// ─────────────────────────────────────────────
// MOVA — Gráfico do sinal bruto de uma tentativa (acelerômetro × tempo).
// Desenha o samples.csv da sessão, sem nenhum processamento além de |a| e da redução mín/máx,
// com os alarmes do alarms.csv e os "Marcar instante" do events.csv por cima.
// ─────────────────────────────────────────────
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, LayoutChangeEvent, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Svg, { G, Line, Polygon, Polyline, Rect, Text as SvgText } from "react-native-svg";
import { File, Paths } from "expo-file-system";
import { GRACE_S, TrialRecord } from "../study/scoring";
import {
  AlarmPoint,
  PRE_S,
  SignalSample,
  downsampleMinMax,
  parseAlarms,
  parseMarkers,
  parseSamples,
  sessionDirName,
  signalStats,
  trialSpan,
} from "../study/signal";
import { meta } from "../study/detectorsMeta";

const HEIGHT = 200;
const PAD = { left: 34, right: 8, top: 8, bottom: 22 };
const LEGACY_THRESHOLD_G = 2.5;
const AXES = [
  { key: "x" as const, color: "#A78BFA" },
  { key: "y" as const, color: "#67E8F9" },
  { key: "z" as const, color: "#FDE68A" },
];

type Loaded = { samples: SignalSample[]; alarms: AlarmPoint[]; markers: number[] };
type State = { status: "loading" } | { status: "error"; message: string } | ({ status: "ok" } & Loaded);

const fmt = (v: number, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : "—");
const rel = (t: number, t0: number) => `${t - t0 >= 0 ? "+" : ""}${(t - t0).toFixed(2)} s`;

/** Passo "redondo" dos rótulos do eixo do tempo para ~5 marcas. */
function niceStep(span: number): number {
  const raw = span / 5;
  const p = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map((k) => k * p).find((s) => s >= raw) ?? 10 * p;
}

export default function SignalChart({ trial, detectors }: { trial: TrialRecord; detectors: string[] }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [width, setWidth] = useState(0);
  const [showAxes, setShowAxes] = useState(false);
  const span = trialSpan(trial);

  useEffect(() => {
    if (!span) {
      setState({ status: "error", message: "Não foi possível identificar o início desta tentativa." });
      return;
    }
    const t0 = span.tStart - PRE_S;
    const t1 = span.tEnd + GRACE_S;
    const f = (name: string) => new File(Paths.document, "mova_estudo", sessionDirName(trial), name);
    let cancelled = false;
    (async () => {
      try {
        const samplesFile = f("samples.csv");
        if (!samplesFile.exists) {
          if (!cancelled) setState({ status: "error", message: `Dados brutos não encontrados (pasta ${sessionDirName(trial)}).` });
          return;
        }
        const samples = parseSamples(await samplesFile.text(), t0, t1);
        const alarmsFile = f("alarms.csv");
        const eventsFile = f("events.csv");
        const alarms = alarmsFile.exists ? parseAlarms(await alarmsFile.text(), t0, t1) : [];
        const markers = eventsFile.exists ? parseMarkers(await eventsFile.text(), t0, t1) : [];
        if (!cancelled) setState({ status: "ok", samples, alarms, markers });
      } catch (e) {
        if (!cancelled) setState({ status: "error", message: `Erro ao ler os arquivos: ${String(e)}` });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [trial.id]);

  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));

  if (state.status === "loading") {
    return (
      <View style={styles.box}>
        <ActivityIndicator color="#4ECDC4" />
      </View>
    );
  }
  if (state.status === "error" || !span) {
    return (
      <View style={styles.box}>
        <Text style={styles.hint}>{state.status === "error" ? state.message : ""}</Text>
      </View>
    );
  }
  if (!state.samples.length) {
    return (
      <View style={styles.box}>
        <Text style={styles.hint}>Nenhuma amostra do sensor nesta janela.</Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 8 }} onLayout={onLayout}>
      {width > 0 && <Plot width={width} span={span} data={state} showAxes={showAxes} detectors={detectors} />}

      <View style={styles.legend}>
        <LegendItem color="#F8FAFC" label="|a| (magnitude)" />
        {showAxes && AXES.map((a) => <LegendItem key={a.key} color={a.color} label={a.key} />)}
        <LegendItem color="#94A3B8" label="início / parar" />
        {state.markers.length > 0 && <LegendItem color="#F8FAFC" label="marcar instante" dashed />}
      </View>

      <TouchableOpacity style={[styles.chip, showAxes && styles.chipActive]} onPress={() => setShowAxes(!showAxes)}>
        <Text style={[styles.chipText, showAxes && styles.chipTextActive]}>{showAxes ? "Esconder" : "Mostrar"} eixos x / y / z</Text>
      </TouchableOpacity>

      <Summary data={state} tStart={span.tStart} detectors={detectors} />
    </View>
  );
}

function LegendItem({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, { borderColor: color, borderStyle: dashed ? "dashed" : "solid" }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function Plot({
  width,
  span,
  data,
  showAxes,
  detectors,
}: {
  width: number;
  span: { tStart: number; tEnd: number };
  data: Loaded;
  showAxes: boolean;
  detectors: string[];
}) {
  const t0 = span.tStart - PRE_S;
  const t1 = span.tEnd + GRACE_S;
  const plotW = width - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;

  const series = useMemo(() => {
    const buckets = Math.max(10, plotW);
    const mag = downsampleMinMax(data.samples, (s) => s.m, buckets);
    const axes = showAxes ? AXES.map((a) => ({ ...a, pts: downsampleMinMax(data.samples, (s) => s[a.key], buckets) })) : [];
    return { mag, axes };
  }, [data.samples, plotW, showAxes]);

  // faixa vertical: sempre mostra 0–3 g; cresce com o pico e, com os eixos, inclui os negativos
  const vMax = Math.max(3, Math.ceil(Math.max(...series.mag.map((p) => p.v))));
  const vMin = showAxes ? Math.min(0, Math.floor(Math.min(...series.axes.flatMap((a) => a.pts.map((p) => p.v))))) : 0;
  const X = (t: number) => PAD.left + ((t - t0) / (t1 - t0)) * plotW;
  const Y = (v: number) => PAD.top + (1 - (v - vMin) / (vMax - vMin)) * plotH;
  const pts = (arr: { t: number; v: number }[]) => arr.map((p) => `${X(p.t).toFixed(1)},${Y(p.v).toFixed(1)}`).join(" ");

  const yStep = vMax - vMin > 8 ? 2 : 1;
  const yTicks: number[] = [];
  for (let v = vMin; v <= vMax; v += yStep) yTicks.push(v);
  const xStep = niceStep(t1 - t0);
  const xTicks: number[] = [];
  for (let s = Math.ceil(-PRE_S / xStep) * xStep; span.tStart + s <= t1; s += xStep) xTicks.push(s);

  return (
    <Svg width={width} height={HEIGHT}>
      {/* fora da tentativa: 2 s antes do início e os GRACE_S de espera após parar */}
      <Rect x={X(t0)} y={PAD.top} width={X(span.tStart) - X(t0)} height={plotH} fill="#1F2937" opacity={0.6} />
      <Rect x={X(span.tEnd)} y={PAD.top} width={X(t1) - X(span.tEnd)} height={plotH} fill="#1F2937" opacity={0.6} />

      {yTicks.map((v) => (
        <G key={`y${v}`}>
          <Line x1={PAD.left} x2={width - PAD.right} y1={Y(v)} y2={Y(v)} stroke="#1F2937" strokeWidth={1} />
          <SvgText x={PAD.left - 4} y={Y(v) + 3} fontSize={9} fill="#64748B" textAnchor="end">
            {`${v} g`}
          </SvgText>
        </G>
      ))}
      {xTicks.map((s) => (
        <SvgText key={`x${s}`} x={X(span.tStart + s)} y={HEIGHT - 6} fontSize={9} fill="#64748B" textAnchor="middle">
          {`${Number(s.toFixed(2))} s`}
        </SvgText>
      ))}

      {/* referências: repouso (1 g) e limiar do Mova antigo (2,5 g) */}
      <Line x1={PAD.left} x2={width - PAD.right} y1={Y(1)} y2={Y(1)} stroke="#475569" strokeDasharray="2 3" />
      <Line x1={PAD.left} x2={width - PAD.right} y1={Y(LEGACY_THRESHOLD_G)} y2={Y(LEGACY_THRESHOLD_G)} stroke={meta("mova-legado").color} strokeDasharray="2 3" opacity={0.7} />

      <Line x1={X(span.tStart)} x2={X(span.tStart)} y1={PAD.top} y2={PAD.top + plotH} stroke="#94A3B8" />
      <Line x1={X(span.tEnd)} x2={X(span.tEnd)} y1={PAD.top} y2={PAD.top + plotH} stroke="#94A3B8" />

      {series.axes.map((a) => (
        <Polyline key={a.key} points={pts(a.pts)} fill="none" stroke={a.color} strokeWidth={1} opacity={0.75} />
      ))}
      <Polyline points={pts(series.mag)} fill="none" stroke="#F8FAFC" strokeWidth={1.5} />

      {data.markers.map((t, i) => (
        <Line key={`m${i}`} x1={X(t)} x2={X(t)} y1={PAD.top} y2={PAD.top + plotH} stroke="#F8FAFC" strokeDasharray="4 3" opacity={0.6} />
      ))}

      {/* alarmes: linha na cor do detector + triângulo empilhado por detector (alarmes simultâneos não se escondem) */}
      {data.alarms.map((a, i) => {
        const color = meta(a.algorithm).color;
        const x = X(a.t);
        const row = Math.max(0, detectors.indexOf(a.algorithm));
        const y = PAD.top + 2 + row * 7;
        return (
          <G key={`a${i}`}>
            <Line x1={x} x2={x} y1={PAD.top} y2={PAD.top + plotH} stroke={color} strokeWidth={1.5} />
            <Polygon points={`${x - 4},${y} ${x + 4},${y} ${x},${y + 6}`} fill={color} />
          </G>
        );
      })}
    </Svg>
  );
}

/** Os mesmos números do gráfico, por escrito (a cor nunca é a única pista). */
function Summary({ data, tStart, detectors }: { data: Loaded; tStart: number; detectors: string[] }) {
  const st = signalStats(data.samples);
  return (
    <View style={{ gap: 4 }}>
      <Text style={styles.hint}>
        Pico |a|: {fmt(st.max)} g em {rel(st.tMax, tStart)} · mínimo: {fmt(st.min)} g · {fmt(st.rateHz, 1)} Hz · {st.n} amostras
      </Text>
      <Text style={styles.hint}>Tempo contado a partir de "Iniciar tentativa". Faixas escuras: fora da tentativa.</Text>
      {detectors.map((d) => {
        const times = data.alarms.filter((a) => a.algorithm === d).map((a) => a.t);
        const m = meta(d);
        return (
          <View key={d} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: m.color }]} />
            <Text style={styles.legendText}>
              {m.label}: {times.length ? times.map((t) => rel(t, tStart)).join(", ") : "sem alarme"}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { height: 60, alignItems: "center", justifyContent: "center" },
  hint: { color: "#94A3B8", fontSize: 12 },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendSwatch: { width: 14, height: 0, borderTopWidth: 2 },
  legendText: { color: "#CBD5E1", fontSize: 12 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  chip: { alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: "#1F2937", backgroundColor: "#0B1220" },
  chipActive: { backgroundColor: "#4ECDC4", borderColor: "#4ECDC4" },
  chipText: { color: "#CBD5E1", fontSize: 12 },
  chipTextActive: { color: "#070b19", fontWeight: "700" },
});
