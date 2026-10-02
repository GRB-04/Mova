import { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Modal,
  Platform,
  Image,
} from "react-native";
import { Accelerometer } from "expo-sensors";
import type { EventSubscription } from "expo-modules-core";
import { useAudioPlayer, setAudioModeAsync } from "expo-audio";
import { Ionicons } from "@expo/vector-icons";
import { syncService } from "../services/syncService";
import { getCurrentDeviceLocation, startWatchingLocation } from "../services/locationService";
import { notificationService } from "../services/notificationService";
import { useKeepAwake } from "expo-keep-awake";
import { MovaGlobalState } from "../types";

const FALL_THRESHOLD = 2.5;
const UPDATE_INTERVAL_MS = 100;
const CONFIRMATION_TIMEOUT_SEC = 30;

function calcMagnitude(x: number, y: number, z: number): number {
  return Math.sqrt(x * x + y * y + z * z);
}

export default function SeniorScreen() {
  // Mantém a tela ativa e o processador acordado para monitorar
  useKeepAwake();

  const [globalState, setGlobalState] = useState<MovaGlobalState>(syncService.getState());
  const [showConfirmation, setShowConfirmation] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(CONFIRMATION_TIMEOUT_SEC);
  const [lastFallMag, setLastFallMag] = useState<number>(0);

  const subscriptionRef = useRef<EventSubscription | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isFallHandlingRef = useRef<boolean>(false);

  // Áudio do Alarme
  const player = useAudioPlayer(require("../../assets/alarm.wav"));

  useEffect(() => {
    try {
      setAudioModeAsync({ playsInSilentMode: true });
    } catch {}
  }, []);

  // Notificações
  useEffect(() => {
    notificationService.init(
      () => handleConfirmWell(),
      () => handleRequestHelp()
    );
    notificationService.setCallbacks(
      () => handleConfirmWell(),
      () => handleRequestHelp()
    );
  }, []);

  // Assina sincronização com o serviço global
  useEffect(() => {
    const unsubscribe = syncService.subscribe((newState) => {
      setGlobalState(newState);
      if (!newState.isEmergencyActive && !newState.isFallActive) {
        setShowConfirmation(false);
        isFallHandlingRef.current = false;
        stopAlarm();
      }
    });
    return () => unsubscribe();
  }, []);

  // Envio contínuo de GPS real para a nuvem em tempo real (dispara a cada metro andado!)
  useEffect(() => {
    let cleanupWatcher: (() => void) | null = null;
    let isMounted = true;

    const initWatcher = async () => {
      // 1. Pega coordenadas imediatas
      const initial = await getCurrentDeviceLocation();
      if (initial && isMounted) {
        syncService.updateSeniorGPS(initial.lat, initial.lng);
      }

      // 2. Registra stream contínuo de alta precisão (Location.watchPositionAsync)
      cleanupWatcher = await startWatchingLocation((coords) => {
        if (isMounted) {
          syncService.updateSeniorGPS(coords.lat, coords.lng);
        }
      });
    };

    initWatcher();

    // Fallback de polling para garantir transmissão contínua a cada 2 segundos
    const locInterval = setInterval(async () => {
      const coords = await getCurrentDeviceLocation();
      if (coords && isMounted) {
        syncService.updateSeniorGPS(coords.lat, coords.lng);
      }
    }, 2000);

    return () => {
      isMounted = false;
      if (cleanupWatcher) cleanupWatcher();
      clearInterval(locInterval);
    };
  }, []);

  // Acelerômetro
  useEffect(() => {
    Accelerometer.setUpdateInterval(UPDATE_INTERVAL_MS);

    subscriptionRef.current = Accelerometer.addListener((measurement) => {
      const { x, y, z } = measurement;
      const mag = calcMagnitude(x, y, z);

      if (mag > FALL_THRESHOLD && !isFallHandlingRef.current) {
        triggerFallAlert(mag);
      }
    });

    return () => {
      if (subscriptionRef.current) subscriptionRef.current.remove();
    };
  }, []);

  const playAlarm = () => {
    try {
      player.loop = true;
      player.volume = 1.0;
      player.seekTo(0);
      player.play();
    } catch {}
  };

  const stopAlarm = () => {
    try {
      player.pause();
      player.seekTo(0);
    } catch {}
  };

  const triggerFallAlert = (mag: number) => {
    isFallHandlingRef.current = true;
    setLastFallMag(mag);

    syncService.updateState({
      isFallActive: true,
      lastFallMagnitude: mag,
    });

    setShowConfirmation(true);
    setCountdown(CONFIRMATION_TIMEOUT_SEC);
    playAlarm();

    notificationService.notifyFallDetected(mag);

    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
          stopAlarm();
          setShowConfirmation(false);
          syncService.triggerEmergency("timeout", lastFallMag);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleConfirmWell = () => {
    stopAlarm();
    notificationService.dismissAlerts();
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setShowConfirmation(false);
    isFallHandlingRef.current = false;
    syncService.dismissEmergency();
  };

  const handleRequestHelp = () => {
    stopAlarm();
    notificationService.dismissAlerts();
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setShowConfirmation(false);
    syncService.triggerEmergency("ajuda");
  };

  const handleManualSOS = () => {
    stopAlarm();
    playAlarm();
    syncService.triggerEmergency("sos");
  };

  const handleDismissEmergency = () => {
    stopAlarm();
    notificationService.dismissAlerts();
    syncService.dismissEmergency();
    isFallHandlingRef.current = false;
  };

  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      stopAlarm();
    };
  }, []);

  const seniorName = globalState.seniorProfile?.name?.trim() || "João";

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      {/* ─────────────────────────────────────────────
          MODAL 1: VOCÊ ESTÁ BEM? (Checagem de Queda)
         ───────────────────────────────────────────── */}
      <Modal visible={showConfirmation} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderBadge}>
              <Ionicons name="warning-outline" size={24} color="#f59e0b" />
              <Text style={styles.modalBadgeText}>POSSÍVEL IMPACTO DETECTADO</Text>
            </View>

            <Text style={styles.modalTitle}>Você está bem?</Text>
            <Text style={styles.modalSubtitle}>
              Sentimos um impacto brusco no celular.
            </Text>

            <View style={styles.timerBox}>
              <Text style={styles.timerLabel}>Aviso aos cuidadores em:</Text>
              <Text style={styles.timerCount}>{countdown}s</Text>
            </View>

            <View style={styles.actionButtonsContainer}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.btnWell]}
                onPress={handleConfirmWell}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark-circle" size={26} color="#2ecc71" />
                <View>
                  <Text style={styles.btnWellTitle}>ESTOU BEM</Text>
                  <Text style={styles.btnWellSub}>Desligar alarme e continuar</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.btnHelp]}
                onPress={handleRequestHelp}
                activeOpacity={0.8}
              >
                <Ionicons name="alert-circle" size={26} color="#FFFFFF" />
                <View>
                  <Text style={styles.btnHelpTitle}>PRECISO DE AJUDA</Text>
                  <Text style={styles.btnHelpSub}>Avisar cuidador agora</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─────────────────────────────────────────────
          MODAL 2: ALERTA DE SOCORRO ATIVO
         ───────────────────────────────────────────── */}
      <Modal visible={globalState.isEmergencyActive} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, styles.emergencyCard]}>
            <View style={styles.emergencyIconCircle}>
              <Ionicons name="notifications" size={38} color="#e63946" />
            </View>

            <Text style={styles.emergencyTitle}>PEDIDO DE SOCORRO ENVIADO</Text>

            <Text style={styles.emergencyReason}>
              {globalState.emergencyReason === "ajuda"
                ? "Você solicitou ajuda pelo aplicativo."
                : globalState.emergencyReason === "sos"
                ? "Botão de Pânico acionado."
                : "Impacto identificado sem confirmação."}
            </Text>

            <View style={styles.contactsBox}>
              <View style={styles.contactItem}>
                <Ionicons name="checkmark-circle-outline" size={18} color="#2ecc71" />
                <Text style={styles.contactText}>Familiar / Cuidador Notificado</Text>
              </View>
              <View style={styles.contactItem}>
                <Ionicons name="checkmark-circle-outline" size={18} color="#2ecc71" />
                <Text style={styles.contactText}>Sua localização foi compartilhada</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.btnDismissEmergency}
              onPress={handleDismissEmergency}
              activeOpacity={0.85}
            >
              <Text style={styles.btnDismissText}>ESTOU SEGURO / CANCELAR ALERTA</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* CABEÇALHO */}
      <View style={styles.header}>
        <Image
          source={require("../../assets/mova-logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      {/* ─────────────────────────────────────────────
          CARD PRINCIPAL: STATUS DIRETO E LIMPO
         ───────────────────────────────────────────── */}
      <View style={styles.heroProtectionCard}>
        <View style={styles.shieldCircle}>
          <Ionicons name="shield-checkmark" size={38} color="#4ECDC4" />
        </View>
        <Text style={styles.protectionTitle}>Olá, {seniorName}.</Text>
        <Text style={styles.protectionSubtitle}>
          O MOVA está ativo em segundo plano cuidando de você.
        </Text>
      </View>

      {/* ─────────────────────────────────────────────
          CARD: BOTÃO DE PÂNICO SOS (EM DESTAQUE)
         ───────────────────────────────────────────── */}
      <TouchableOpacity style={styles.sosHeroButton} onPress={handleManualSOS} activeOpacity={0.88}>
        <View style={styles.sosIconBox}>
          <Ionicons name="alert-circle" size={34} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.sosHeroTitle}>BOTÃO DE PÂNICO</Text>
          <Text style={styles.sosHeroSub}>
            Toque aqui se precisar de ajuda urgente ou sentir mal-estar
          </Text>
        </View>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 40,
    gap: 18,
  },
  header: {
    paddingTop: 14,
    paddingBottom: 4,
    alignItems: "center",
  },
  logo: {
    width: 150,
    height: 65,
    tintColor: "#FFFFFF",
  },

  // Card de Proteção
  heroProtectionCard: {
    backgroundColor: "#131b31",
    borderRadius: 22,
    paddingVertical: 28,
    paddingHorizontal: 22,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  shieldCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(78, 205, 196, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(78, 205, 196, 0.3)",
  },
  protectionTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 8,
  },
  protectionSubtitle: {
    color: "rgba(255, 255, 255, 0.75)",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 280,
  },

  // Botão de Pânico
  sosHeroButton: {
    backgroundColor: "#e63946",
    borderRadius: 20,
    paddingVertical: 22,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    shadowColor: "#e63946",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  sosIconBox: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  sosHeroTitle: {
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  sosHeroSub: {
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },

  // Modais
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: "#131b31",
    borderRadius: 24,
    padding: 24,
    width: "100%",
    maxWidth: 380,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
  },
  modalHeaderBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
  },
  modalBadgeText: {
    color: "#f59e0b",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  modalTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 6,
  },
  modalSubtitle: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 20,
  },
  timerBox: {
    backgroundColor: "#070b19",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    width: "100%",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  timerLabel: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },
  timerCount: {
    color: "#f59e0b",
    fontSize: 36,
    fontWeight: "900",
  },
  actionButtonsContainer: {
    width: "100%",
    gap: 12,
  },
  actionBtn: {
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  btnWell: {
    backgroundColor: "rgba(46, 204, 113, 0.15)",
    borderWidth: 1.5,
    borderColor: "#2ecc71",
  },
  btnWellTitle: {
    color: "#2ecc71",
    fontSize: 16,
    fontWeight: "900",
  },
  btnWellSub: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 12,
    marginTop: 2,
  },
  btnHelp: {
    backgroundColor: "#e63946",
  },
  btnHelpTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },
  btnHelpSub: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 12,
    marginTop: 2,
  },

  // Modal 2
  emergencyCard: {
    borderWidth: 2,
    borderColor: "#e63946",
  },
  emergencyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(230, 57, 70, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emergencyTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 8,
  },
  emergencyReason: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 20,
  },
  contactsBox: {
    backgroundColor: "#070b19",
    borderRadius: 14,
    padding: 16,
    width: "100%",
    gap: 10,
    marginBottom: 20,
  },
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  contactText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  btnDismissEmergency: {
    backgroundColor: "#1e293b",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
  },
  btnDismissText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
});
