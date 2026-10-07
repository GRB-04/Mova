// ─────────────────────────────────────────────
// MOVA — Resultados do estudo (guardados no aparelho) e comparação dos detectores.
// ─────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Ionicons } from "@expo/vector-icons";
import { DetectorSummary, Rate, TrialRecord, byActivity, summarize, trialsToCsv } from "../study/scoring";
import { clearTrials, deleteTrial, loadTrials } from "../study/trialStore";
import { meta } from "../study/detectorsMeta";

function formatDuration(s: number): string {
  if (s < 90) return `${Math.round(s)} s`;
  if (s < 3600) return `${Math.round(s / 60)} min`;
  return `${(s / 3600).toFixed(1)} h`;
}

const pct = (x: number) => (Number.isFinite(x) ? `${Math.round(x * 100)}%` : "—");

type BarRow = { detector: string; value: number; ci?: [number, number]; text: string };

/** Barras horizontais, uma por detector, com nome e valor escritos (a cor nunca é a única pista). */
function BarChart({ title, hint, rows, max = 1 }: { title: string; hint: string; rows: BarRow[]; max?: number }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardHint}>{hint}</Text>
      {rows.map((r) => {
        const m = meta(r.detector);
        const w = Number.isFinite(r.value) ? Math.max(0, Math.min(1, r.value / max)) : 0;
        return (
          <View key={r.detector} style={styles.barRow}>
            <Text style={styles.barLabel} numberOfLines={1}>
              {m.label}
            </Text>
            <View style={styles.barTrack}>
              {w > 0 && <View style={[styles.barFill, { width: `${w * 100}%`, backgroundColor: m.color }]} />}
              {r.ci && Number.isFinite(r.ci[0]) && (
                <View
                  style={[styles.whisker, { left: `${(r.ci[0] / max) * 100}%`, width: `${Math.max(0.5, ((r.ci[1] - r.ci[0]) / max) * 100)}%` }]}
                />
              )}
            </View>
            <Text style={styles.barValue}>{r.text}</Text>
          </View>
        );
      })}
    </View>
  );
}

const rateRow = (detector: string, r: Rate): BarRow => ({
  detector,
  value: r.rate,
  ci: r.ci,
  text: r.n ? `${pct(r.rate)} (${r.k}/${r.n})` : "sem dados",
});

export default function StudyResults({ detectors, refreshKey }: { detectors: string[]; refreshKey: number }) {
  const [trials, setTrials] = useState<TrialRecord[]>([]);
  const [position, setPosition] = useState<string>("todas");
  const [showTrials, setShowTrials] = useState(false);

  const reload = useCallback(() => {
    loadTrials().then(setTrials);
  }, []);
  useEffect(reload, [refreshKey]);

  const positions = useMemo(() => ["todas", ...new Set(trials.map((t) => t.position))], [trials]);
  const filtered = position === "todas" ? trials : trials.filter((t) => t.position === position);
  const summary: DetectorSummary[] = useMemo(() => summarize(filtered, detectors), [filtered, detectors]);
  const activities = useMemo(() => byActivity(filtered, detectors), [filtered, detectors]);
  const nFalls = filtered.filter((t) => t.kind === "queda").length;
  const nAdl = filtered.filter((t) => t.kind === "adl").length;
  const freeH = filtered.filter((t) => t.kind === "livre").reduce((a, t) => a + t.durationS, 0) / 3600;
  const maxPerHour = Math.max(1, ...summary.map((s) => (Number.isFinite(s.free.perHour) ? s.free.perHour : 0)));

  const exportCsv = async () => {
    const f = new File(Paths.cache, `mova_resultados_${Date.now()}.csv`);
    f.write(trialsToCsv(trials, detectors));
    await Sharing.shareAsync(f.uri, { mimeType: "text/csv", dialogTitle: "Resultados do estudo" });
  };

  const confirmClear = () =>
    Alert.alert("Apagar todos os resultados?", "Isso não pode ser desfeito. Exporte o CSV antes.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Apagar", style: "destructive", onPress: () => clearTrials().then(reload) },
    ]);

  const confirmDelete = (t: TrialRecord) =>
    Alert.alert("Apagar esta tentativa?", `${t.activity} · ${t.volunteer} · ${new Date(t.createdAt).toLocaleString()}`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Apagar", style: "destructive", onPress: () => deleteTrial(t.id).then(setTrials) },
    ]);

  if (!trials.length) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Nenhuma tentativa salva ainda</Text>
        <Text style={styles.cardHint}>Faça tentativas na aba Coleta. Cada tentativa encerrada fica salva no aparelho e aparece aqui.</Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 12 }}>
      <View style={styles.chips}>
        {positions.map((p) => (
          <TouchableOpacity key={p} style={[styles.chip, position === p && styles.chipActive]} onPress={() => setPosition(p)}>
            <Text style={[styles.chipText, position === p && styles.chipTextActive]}>{p}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.tiles}>
        <View style={styles.tile}>
          <Text style={styles.tileValue}>{nFalls}</Text>
          <Text style={styles.tileLabel}>quedas</Text>
        </View>
        <View style={styles.tile}>
          <Text style={styles.tileValue}>{nAdl}</Text>
          <Text style={styles.tileLabel}>atividades normais</Text>
        </View>
        <View style={styles.tile}>
          <Text style={styles.tileValue}>{freeH.toFixed(1)} h</Text>
          <Text style={styles.tileLabel}>uso livre</Text>
        </View>
      </View>

      <BarChart
        title="Quedas detectadas"
        hint="Quanto MAIOR, melhor. A linha branca é a margem de incerteza (IC 95%): com poucas tentativas ela é larga."
        rows={summary.map((s) => rateRow(s.detector, s.falls))}
      />
      <BarChart
        title="Alarmes falsos em atividades normais"
        hint="Quanto MENOR, melhor. % de tentativas sem queda (sentar, pular, celular caiu…) que geraram alarme."
        rows={summary.map((s) => rateRow(s.detector, s.falseAlarms))}
      />
      {freeH > 0 && (
        <BarChart
          title="Alarmes falsos por hora (uso livre)"
          hint="Quanto MENOR, melhor. É o número mais próximo da vida real."
          max={maxPerHour}
          rows={summary.map((s) => ({
            detector: s.detector,
            value: s.free.perHour,
            text: `${Number.isFinite(s.free.perHour) ? s.free.perHour.toFixed(1) : "—"}/h (${s.free.alarms})`,
          }))}
        />
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Por atividade</Text>
        <Text style={styles.cardHint}>Tentativas com alarme / total. Em quedas, alarme é acerto; nas demais, é alarme falso.</Text>
        <View style={styles.tableRow}>
          <Text style={[styles.tableAct, styles.tableHead]}>Atividade</Text>
          {detectors.map((d) => (
            <Text key={d} style={[styles.tableCell, styles.tableHead]} numberOfLines={2}>
              {meta(d).label}
            </Text>
          ))}
        </View>
        {activities.map((a) => (
          <View key={a.activity} style={styles.tableRow}>
            <Text style={styles.tableAct} numberOfLines={2}>
              {a.activity}
            </Text>
            {a.cells.map((c) => {
              const good = a.kind === "queda" ? c.k === c.n : c.k === 0;
              const bad = a.kind === "queda" ? c.k === 0 : c.k === c.n;
              return (
                <Text key={c.detector} style={[styles.tableCell, good && styles.good, bad && styles.bad]}>
                  {c.k}/{c.n}
                </Text>
              );
            })}
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.secondary} onPress={() => setShowTrials(!showTrials)}>
        <Text style={styles.secondaryText}>{showTrials ? "Esconder" : "Ver"} tentativas ({filtered.length})</Text>
      </TouchableOpacity>
      {showTrials &&
        [...filtered].reverse().map((t) => (
          <TrialCard key={t.id} trial={t} detectors={detectors} onDelete={() => confirmDelete(t)} />
        ))}

      <View style={{ flexDirection: "row", gap: 10 }}>
        <TouchableOpacity style={[styles.secondary, { flex: 1 }]} onPress={exportCsv}>
          <Text style={styles.secondaryText}>Exportar CSV</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.secondary, { flex: 1, borderColor: "#F87171" }]} onPress={confirmClear}>
          <Text style={[styles.secondaryText, { color: "#F87171" }]}>Apagar tudo</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/** Resultado de uma tentativa: ✓/✗ por detector, já interpretado (verde = acertou). */
export function TrialCard({ trial, detectors, onDelete }: { trial: TrialRecord; detectors: string[]; onDelete?: () => void }) {
  return (
    <View style={styles.card}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={styles.cardTitle}>{trial.activity}</Text>
        {onDelete && (
          <TouchableOpacity onPress={onDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="trash-outline" size={18} color="#64748B" />
          </TouchableOpacity>
        )}
      </View>
      <Text style={styles.cardHint}>
        {trial.volunteer} · {trial.position} · {formatDuration(trial.durationS)} · {new Date(trial.createdAt).toLocaleString()}
      </Text>
      {detectors.map((d) => {
        const alarmed = trial.hit[d];
        const n = trial.nAlarms[d] ?? 0;
        let ok: boolean;
        let text: string;
        if (trial.kind === "queda") {
          ok = alarmed;
          text = alarmed ? "detectou a queda" : "NÃO detectou";
        } else if (trial.kind === "adl") {
          ok = !alarmed;
          text = alarmed ? `alarme falso (${n})` : "sem alarme";
        } else {
          ok = n === 0;
          text = `${n} alarme(s)`;
        }
        return (
          <View key={d} style={styles.resultRow}>
            <Ionicons name={ok ? "checkmark-circle" : "close-circle"} size={18} color={ok ? "#2da44e" : "#F87171"} />
            <Text style={styles.resultLabel}>{meta(d).label}</Text>
            <Text style={[styles.resultText, { color: ok ? "#CBD5E1" : "#F87171" }]}>{text}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#111827", borderRadius: 14, padding: 14, gap: 8, borderWidth: 1, borderColor: "#1F2937" },
  cardTitle: { color: "#F8FAFC", fontSize: 16, fontWeight: "700" },
  cardHint: { color: "#94A3B8", fontSize: 12 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  barLabel: { color: "#CBD5E1", fontSize: 12, width: 96 },
  barTrack: { flex: 1, height: 14, backgroundColor: "#1F2937", borderRadius: 4, justifyContent: "center" },
  barFill: { position: "absolute", left: 0, top: 0, bottom: 0, borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  whisker: { position: "absolute", height: 2, backgroundColor: "#F8FAFCCC" },
  barValue: { color: "#F8FAFC", fontSize: 12, width: 82, textAlign: "right" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: "#111827", borderWidth: 1, borderColor: "#1F2937" },
  chipActive: { backgroundColor: "#4ECDC4", borderColor: "#4ECDC4" },
  chipText: { color: "#CBD5E1", fontSize: 13 },
  chipTextActive: { color: "#070b19", fontWeight: "700" },
  tiles: { flexDirection: "row", gap: 8 },
  tile: { flex: 1, backgroundColor: "#111827", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#1F2937" },
  tileValue: { color: "#F8FAFC", fontSize: 22, fontWeight: "700" },
  tileLabel: { color: "#94A3B8", fontSize: 12 },
  tableRow: { flexDirection: "row", alignItems: "center", borderTopWidth: 1, borderTopColor: "#1F2937", paddingVertical: 6 },
  tableHead: { color: "#94A3B8", fontWeight: "700", fontSize: 11 },
  tableAct: { color: "#CBD5E1", fontSize: 12, flex: 1.6 },
  tableCell: { color: "#CBD5E1", fontSize: 12, flex: 1, textAlign: "center" },
  good: { color: "#2da44e", fontWeight: "700" },
  bad: { color: "#F87171", fontWeight: "700" },
  secondary: { borderWidth: 1, borderColor: "#4ECDC4", padding: 12, borderRadius: 12, alignItems: "center" },
  secondaryText: { color: "#4ECDC4", fontWeight: "600" },
  resultRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  resultLabel: { color: "#F8FAFC", fontSize: 13, width: 110 },
  resultText: { fontSize: 13, flex: 1 },
});
