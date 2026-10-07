// ─────────────────────────────────────────────
// MOVA — Tela de coleta do estudo de quedas (Etapa 8 do pipeline)
// Grava o acelerômetro bruto, roda os detectores ao vivo (sem notificar ninguém)
// e exporta samples.csv, events.csv, alarms.csv e session.json.
// Limitação: o expo-sensors não lê em segundo plano — app aberto e tela ligada.
// ─────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Accelerometer } from "expo-sensors";
import type { EventSubscription } from "expo-modules-core";
import { useKeepAwake } from "expo-keep-awake";
import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Ionicons } from "@expo/vector-icons";
import { createStudyDetectors, Detector, Vec3 } from "../detection";
import { GRACE_S, TrialRecord, alarmsInTrial, classifyActivity, trialHit } from "../study/scoring";
import { addTrial } from "../study/trialStore";
import { meta } from "../study/detectorsMeta";
import StudyResults, { TrialCard } from "./StudyResults";

// Android: setUpdateInterval é um freio com comparação estrita (>); 15 ms garante ≥ 50 Hz.
const UPDATE_INTERVAL_MS = Platform.OS === "android" ? 15 : 20;
const CALIBRATION_S = 5;
const FLUSH_MS = 1000;

const DETECTOR_NAMES = createStudyDetectors().map((d) => d.name);

const POSITIONS = ["cinto", "bolso da calça", "bolso da camisa", "bolsa", "mão"] as const;
const ACTIVITIES = [
  "queda frente",
  "queda trás",
  "queda lado esquerdo",
  "queda lado direito",
  "queda escorregar sentando",
  "andar 30 s",
  "sentar devagar",
  "sentar com força",
  "deitar na cama",
  "pegar objeto no chão",
  "subir/descer escada",
  "pular",
  "celular caiu no chão",
  "celular jogado no sofá",
  "uso livre",
] as const;

type Raw = { tNative: number; tJs: number; x: number; y: number; z: number };

function newSessionId(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function csvEscape(s: string): string {
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function RecorderScreen({ onExit }: { onExit: () => void }) {
  useKeepAwake();

  // Metadados
  const [volunteer, setVolunteer] = useState("");
  const [position, setPosition] = useState<(typeof POSITIONS)[number]>("cinto");
  const [model, setModel] = useState("");
  const [activity, setActivity] = useState<(typeof ACTIVITIES)[number]>("queda frente");

  // Estado da sessão
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [calibrating, setCalibrating] = useState(false);
  const [calibrated, setCalibrated] = useState<Vec3 | null>(null);
  const [trialActive, setTrialActive] = useState(false);
  const [locked, setLocked] = useState(false);
  const [alarmCounts, setAlarmCounts] = useState<Record<string, number>>({});
  const [rateHz, setRateHz] = useState(0);
  const [nSamples, setNSamples] = useState(0);
  const [tab, setTab] = useState<"coleta" | "resultados">("coleta");
  const [finalizing, setFinalizing] = useState(false);
  const [lastResult, setLastResult] = useState<TrialRecord | null>(null);
  const [resultsKey, setResultsKey] = useState(0);

  // Refs (nunca setState por amostra)
  const subRef = useRef<EventSubscription | null>(null);
  const bufRef = useRef<Raw[]>([]);
  const alarmBufRef = useRef<string[]>([]);
  const detectorsRef = useRef<Detector[]>(createStudyDetectors());
  const dirRef = useRef<Directory | null>(null);
  const anchorRef = useRef<{ tNative: number; tJs: number } | null>(null);
  const calibRef = useRef<Raw[] | null>(null);
  const countRef = useRef(0);
  const rateWinRef = useRef<number[]>([]);
  const alarmCountRef = useRef<Record<string, number>>({});
  // instantes (relógio do sensor) de todos os alarmes da sessão, por detector
  const alarmTimesRef = useRef<Record<string, number[]>>({});
  const trialRef = useRef<{ activity: string; tStart: number; markers: number[] } | null>(null);

  const file = (name: string) => new File(dirRef.current!, name);

  const append = (name: string, text: string) => {
    if (!dirRef.current || !text) return;
    file(name).write(text, { append: true });
  };

  const logEvent = (event: string, label: string, tNative?: number) => {
    const tJs = Date.now();
    const tn = tNative ?? estimateNative(tJs);
    append("events.csv", `${sessionId},${event},${csvEscape(label)},${tJs},${tn.toFixed(4)}\n`);
  };

  const estimateNative = (tJs: number) => {
    const a = anchorRef.current;
    return a ? a.tNative + (tJs - a.tJs) / 1000 : NaN;
  };

  // ── sessão ──
  const startSession = () => {
    if (!volunteer.trim()) {
      Alert.alert("Informe o ID do voluntário");
      return;
    }
    const id = newSessionId();
    const root = new Directory(Paths.document, "mova_estudo");
    if (!root.exists) root.create();
    const dir = new Directory(root, `${id}_${volunteer.trim()}`);
    dir.create();
    dirRef.current = dir;
    new File(dir, "samples.csv").write("session_id,sensor,t_native_s,t_js_ms,x,y,z\n");
    new File(dir, "events.csv").write("session_id,event,label,t_js_ms,t_native_s_est\n");
    new File(dir, "alarms.csv").write("session_id,algorithm,t_native_s,t_js_ms_est,details\n");
    detectorsRef.current = createStudyDetectors();
    alarmCountRef.current = {};
    alarmTimesRef.current = {};
    setAlarmCounts({});
    setLastResult(null);
    setCalibrated(null);
    anchorRef.current = null;
    countRef.current = 0;
    setSessionId(id);
  };

  const writeSessionJson = (extra: Record<string, unknown> = {}) => {
    if (!dirRef.current || !sessionId) return;
    const meta = {
      session_id: sessionId,
      volunteer_id: volunteer.trim(),
      phone_position: position,
      platform: Platform.OS,
      os_version: String(Platform.Version),
      device_model: model.trim(),
      update_interval_ms: UPDATE_INTERVAL_MS,
      anchor: anchorRef.current, // par (t_native_s, Date.now()) para alinhar marcadores e alarmes
      up_reference_g: calibrated,
      detectors: detectorsRef.current.map((d) => d.name),
      app_build: "preencher: Expo Go / development build / EAS",
      ...extra,
    };
    file("session.json").write(JSON.stringify(meta, null, 2));
  };

  // ── acelerômetro ──
  useEffect(() => {
    if (!sessionId) return;
    Accelerometer.setUpdateInterval(UPDATE_INTERVAL_MS);
    subRef.current = Accelerometer.addListener(({ x, y, z, timestamp }) => {
      const tJs = Date.now();
      if (!anchorRef.current) anchorRef.current = { tNative: timestamp, tJs };
      const r: Raw = { tNative: timestamp, tJs, x, y, z };
      bufRef.current.push(r);
      countRef.current++;
      rateWinRef.current.push(timestamp);
      if (calibRef.current) calibRef.current.push(r);

      for (const d of detectorsRef.current) {
        for (const ev of d.push({ t: timestamp, ax: x, ay: y, az: z })) {
          alarmCountRef.current[ev.algorithm] = (alarmCountRef.current[ev.algorithm] ?? 0) + 1;
          (alarmTimesRef.current[ev.algorithm] ??= []).push(ev.t);
          const tJsEst = anchorRef.current.tJs + (ev.t - anchorRef.current.tNative) * 1000;
          alarmBufRef.current.push(
            `${sessionId},${ev.algorithm},${ev.t.toFixed(4)},${Math.round(tJsEst)},${csvEscape(JSON.stringify(ev.details ?? {}))}\n`,
          );
        }
      }
    });

    const flush = () => {
      const rows = bufRef.current;
      bufRef.current = [];
      append("samples.csv", rows.map((r) => `${sessionId},acc,${r.tNative.toFixed(6)},${r.tJs},${r.x},${r.y},${r.z}`).join("\n") + (rows.length ? "\n" : ""));
      const al = alarmBufRef.current;
      alarmBufRef.current = [];
      append("alarms.csv", al.join(""));
      // taxa medida pelo timestamp nativo nos últimos ~2 s
      const w = rateWinRef.current;
      if (w.length > 1) setRateHz((w.length - 1) / (w[w.length - 1] - w[0]));
      rateWinRef.current = w.slice(-Math.max(2, Math.round(w.length / 2)));
      setNSamples(countRef.current);
      setAlarmCounts({ ...alarmCountRef.current });
    };
    const timer = setInterval(flush, FLUSH_MS);

    writeSessionJson();
    return () => {
      subRef.current?.remove();
      subRef.current = null;
      clearInterval(timer);
      flush(); // grava o que restou no buffer
    };
  }, [sessionId]);

  // ── calibração: 5 s em pé e parado ──
  const calibrate = () => {
    setCalibrating(true);
    calibRef.current = [];
    logEvent("calibration_start", position);
    setTimeout(() => {
      const c = calibRef.current ?? [];
      calibRef.current = null;
      setCalibrating(false);
      if (c.length < 10) {
        Alert.alert("Calibração falhou", "Poucas amostras recebidas.");
        return;
      }
      const g: Vec3 = [0, 1, 2].map((i) => c.reduce((a, r) => a + [r.x, r.y, r.z][i], 0) / c.length) as Vec3;
      for (const d of detectorsRef.current) d.setUpReference?.(g);
      setCalibrated(g);
      logEvent("calibration_end", `${g.map((v) => v.toFixed(4)).join(" ")}`);
    }, CALIBRATION_S * 1000);
  };

  useEffect(() => {
    if (sessionId) writeSessionJson();
  }, [calibrated]);

  const toggleTrial = () => {
    if (!trialActive) {
      logEvent("trial_start", activity);
      trialRef.current = { activity, tStart: estimateNative(Date.now()), markers: [] };
      setLastResult(null);
      setTrialActive(true);
      setLocked(true);
    } else {
      logEvent("trial_end", activity);
      setTrialActive(false);
      finishTrial(estimateNative(Date.now()));
    }
  };

  const markNow = () => {
    logEvent("marker", activity);
    trialRef.current?.markers.push(estimateNative(Date.now()));
  };

  /** Espera GRACE_S para os detectores terminarem, pontua e salva a tentativa no aparelho. */
  const finishTrial = (tEnd: number) => {
    const tr = trialRef.current;
    trialRef.current = null;
    if (!tr || !sessionId) return;
    setFinalizing(true);
    setTimeout(async () => {
      const w = { kind: classifyActivity(tr.activity), tStart: tr.tStart, tEnd, markers: tr.markers };
      const hit: Record<string, boolean> = {};
      const nAlarms: Record<string, number> = {};
      for (const d of DETECTOR_NAMES) {
        const times = alarmTimesRef.current[d] ?? [];
        hit[d] = trialHit(w, times);
        nAlarms[d] = alarmsInTrial(w, times).length;
      }
      const rec: TrialRecord = {
        id: `${sessionId}_${Math.round(tr.tStart * 1000)}`,
        createdAt: Date.now(),
        sessionId,
        volunteer: volunteer.trim(),
        position,
        platform: Platform.OS,
        activity: tr.activity,
        kind: w.kind,
        durationS: tEnd - tr.tStart,
        hit,
        nAlarms,
      };
      try {
        await addTrial(rec);
      } catch {
        Alert.alert("Não foi possível salvar o resultado", "Os arquivos CSV da sessão continuam gravados.");
      }
      setLastResult(rec);
      setResultsKey((k) => k + 1);
      setFinalizing(false);
    }, GRACE_S * 1000);
  };

  const endSession = () => {
    if (trialActive) {
      logEvent("trial_end", activity);
      trialRef.current = null; // tentativa interrompida: não é pontuada
    }
    setTrialActive(false);
    writeSessionJson({ ended_at_js_ms: Date.now(), n_samples: countRef.current });
    subRef.current?.remove();
    subRef.current = null;
    setSessionId(null);
  };

  const share = async (name: string) => {
    if (!dirRef.current) return;
    const f = file(name);
    if (!f.exists) return;
    await Sharing.shareAsync(f.uri, { mimeType: name.endsWith(".json") ? "application/json" : "text/csv", dialogTitle: name });
  };

  // ── UI ──
  const Chip = ({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) => (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Estudo de quedas</Text>
          <TouchableOpacity onPress={onExit} disabled={!!sessionId}>
            <Ionicons name="close" size={24} color={sessionId ? "#334155" : "#94A3B8"} />
          </TouchableOpacity>
        </View>

        <View style={styles.tabs}>
          {(["coleta", "resultados"] as const).map((t) => (
            <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t === "coleta" ? "Coleta" : "Resultados"}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {tab === "resultados" ? (
          <StudyResults detectors={DETECTOR_NAMES} refreshKey={resultsKey} />
        ) : !sessionId ? (
          <>
            <Text style={styles.label}>ID do voluntário</Text>
            <TextInput style={styles.input} value={volunteer} onChangeText={setVolunteer} placeholder="ex.: V01" placeholderTextColor="#64748B" />
            <Text style={styles.label}>Modelo do aparelho</Text>
            <TextInput style={styles.input} value={model} onChangeText={setModel} placeholder="ex.: Galaxy A15" placeholderTextColor="#64748B" />
            <Text style={styles.label}>Posição do celular</Text>
            <View style={styles.chips}>
              {POSITIONS.map((p) => (
                <Chip key={p} label={p} active={position === p} onPress={() => setPosition(p)} />
              ))}
            </View>
            <TouchableOpacity style={styles.primary} onPress={startSession}>
              <Text style={styles.primaryText}>Iniciar sessão</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.stat}>
              Sessão {sessionId} · {position} · {Platform.OS}
            </Text>
            <Text style={[styles.stat, rateHz < 50 && styles.warn]}>
              Taxa medida: {rateHz.toFixed(1)} Hz {rateHz < 50 ? "(abaixo de 50 Hz!)" : ""} · {nSamples} amostras
            </Text>

            <TouchableOpacity style={[styles.secondary, calibrating && styles.disabled]} onPress={calibrate} disabled={calibrating || trialActive}>
              <Text style={styles.secondaryText}>
                {calibrating ? `Calibrando… fique em pé e parado (${CALIBRATION_S} s)` : calibrated ? "Recalibrar (5 s em pé)" : "Calibrar (5 s em pé)"}
              </Text>
            </TouchableOpacity>

            <Text style={styles.label}>Atividade da tentativa</Text>
            <View style={styles.chips}>
              {ACTIVITIES.map((a) => (
                <Chip key={a} label={a} active={activity === a} onPress={() => !trialActive && setActivity(a)} />
              ))}
            </View>

            <TouchableOpacity
              style={[styles.primary, trialActive && styles.stop, (!calibrated || finalizing) && styles.disabled]}
              onPress={toggleTrial}
              disabled={!calibrated || finalizing}
            >
              <Text style={styles.primaryText}>
                {finalizing ? `Aguardando os detectores (${GRACE_S} s)…` : trialActive ? "Parar tentativa" : "Iniciar tentativa"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.secondary, !trialActive && styles.disabled]} onPress={markNow} disabled={!trialActive}>
              <Text style={styles.secondaryText}>Marcar instante (ex.: queda agora)</Text>
            </TouchableOpacity>

            {lastResult && (
              <>
                <Text style={styles.label}>Resultado da última tentativa (salvo)</Text>
                <TrialCard trial={lastResult} detectors={DETECTOR_NAMES} />
              </>
            )}

            <Text style={styles.label}>Alarmes na sessão (não notificam ninguém)</Text>
            {DETECTOR_NAMES.map((d) => (
              <Text key={d} style={styles.stat}>
                {meta(d).label}: {alarmCounts[d] ?? 0}
              </Text>
            ))}

            <TouchableOpacity style={[styles.secondary, { marginTop: 20 }, finalizing && styles.disabled]} onPress={endSession} disabled={finalizing}>
              <Text style={styles.secondaryText}>Encerrar sessão</Text>
            </TouchableOpacity>
          </>
        )}

        {tab === "coleta" && dirRef.current && !sessionId && (
          <>
            <Text style={styles.label}>Exportar última sessão</Text>
            <View style={styles.chips}>
              {["samples.csv", "events.csv", "alarms.csv", "session.json"].map((n) => (
                <Chip key={n} label={n} active={false} onPress={() => share(n)} />
              ))}
            </View>
          </>
        )}
      </ScrollView>

      {locked && (
        <TouchableOpacity style={styles.lock} activeOpacity={1} onLongPress={() => setLocked(false)} delayLongPress={2000}>
          <Ionicons name="lock-closed" size={48} color="#94A3B8" />
          <Text style={styles.lockText}>Tela travada durante a tentativa</Text>
          <Text style={styles.lockSub}>Segure 2 s para destravar</Text>
          <Text style={styles.lockSub}>{activity}</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#070b19" },
  tabs: { flexDirection: "row", backgroundColor: "#111827", borderRadius: 12, padding: 4, gap: 4 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: "center" },
  tabActive: { backgroundColor: "#4ECDC4" },
  tabText: { color: "#CBD5E1", fontWeight: "600" },
  tabTextActive: { color: "#070b19" },
  container: { padding: 20, paddingTop: 40, gap: 10 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { color: "#F8FAFC", fontSize: 20, fontWeight: "700" },
  label: { color: "#94A3B8", fontSize: 13, marginTop: 12 },
  input: { backgroundColor: "#111827", color: "#F8FAFC", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#1F2937" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: "#111827", borderWidth: 1, borderColor: "#1F2937" },
  chipActive: { backgroundColor: "#4ECDC4", borderColor: "#4ECDC4" },
  chipText: { color: "#CBD5E1", fontSize: 13 },
  chipTextActive: { color: "#070b19", fontWeight: "700" },
  primary: { backgroundColor: "#4ECDC4", padding: 16, borderRadius: 12, alignItems: "center", marginTop: 16 },
  primaryText: { color: "#070b19", fontWeight: "700", fontSize: 16 },
  stop: { backgroundColor: "#F87171" },
  secondary: { borderWidth: 1, borderColor: "#4ECDC4", padding: 14, borderRadius: 12, alignItems: "center", marginTop: 10 },
  secondaryText: { color: "#4ECDC4", fontWeight: "600" },
  disabled: { opacity: 0.4 },
  stat: { color: "#CBD5E1", fontSize: 13 },
  warn: { color: "#F87171" },
  lock: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#000000EE", alignItems: "center", justifyContent: "center", gap: 10 },
  lockText: { color: "#F8FAFC", fontSize: 18, fontWeight: "700" },
  lockSub: { color: "#94A3B8", fontSize: 14 },
});
