import { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  SafeAreaView,
  Image,
  ActivityIndicator,
  TextInput,
  Share,
  Animated,
  Easing,
  ScrollView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import SeniorScreen from "./src/screens/SeniorScreen";
import CaregiverScreen from "./src/screens/CaregiverScreen";
import { UserRole } from "./src/types";
import { syncService } from "./src/services/syncService";
import { notificationService } from "./src/services/notificationService";

const STORAGE_KEY_ROLE = "@mova_device_role";
const STORAGE_KEY_CIRCLE_CODE = "@mova_circle_code";
const STORAGE_KEY_ONBOARDED = "@mova_onboarded";
const STORAGE_KEY_SENIOR_PROFILE = "@mova_senior_profile";

// Gera um código legível estilo Life360 (ex: "3FX-K9P")
function generateCircleCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const part1 = Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  const part2 = Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `${part1}-${part2}`;
}

type OnboardingStep = "circle" | "role" | "senior_setup" | "caregiver_setup" | "done";

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [step, setStep] = useState<OnboardingStep>("circle");
  const [role, setRole] = useState<UserRole | null>(null);

  // Passo 1 — Círculo
  const [circleMode, setCircleMode] = useState<"create" | "join" | null>(null);
  const [circleCode, setCircleCode] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [generatedCode, setGeneratedCode] = useState("");

  // Passo 3 — Identificação
  const [seniorName, setSeniorName] = useState("");
  const [seniorPhone, setSeniorPhone] = useState("");
  const [seniorEmoji, setSeniorEmoji] = useState("");
  const [caregiverName, setCaregiverName] = useState("Gabriel");

  // Animação de entrada de tela
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const fadeIn = () => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  // Mantém circleCode do header sincronizado com o syncService
  useEffect(() => {
    const unsub = syncService.subscribe((state) => {
      if (state.circleCode && state.circleCode !== circleCode) {
        setCircleCode(state.circleCode);
      }
    });
    return () => unsub();
  }, [circleCode]);

  // Carrega estado salvo no boot
  useEffect(() => {
    const boot = async () => {
      try {
        const [savedRole, savedCode, savedOnboarded, savedProfile] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_ROLE),
          AsyncStorage.getItem(STORAGE_KEY_CIRCLE_CODE),
          AsyncStorage.getItem(STORAGE_KEY_ONBOARDED),
          AsyncStorage.getItem(STORAGE_KEY_SENIOR_PROFILE),
        ]);

        if (savedProfile) {
          try {
            const p = JSON.parse(savedProfile);
            if (p.name) setSeniorName(p.name);
            if (p.avatarEmoji) setSeniorEmoji(p.avatarEmoji);
            if (p.emergencyPhone) setSeniorPhone(p.emergencyPhone);
          } catch {}
        }

        if (
          savedOnboarded === "true" &&
          (savedRole === "senior" || savedRole === "caregiver") &&
          savedCode
        ) {
          syncService.updateCircleCode(savedCode);
          setCircleCode(savedCode);
          setRole(savedRole as UserRole);
          setStep("done");
        }

        // Inicializa permissões e canais de notificação com prioridade máxima
        notificationService.init();
      } catch {
        // Fallback: recomeça do onboarding
      } finally {
        setIsLoading(false);
        fadeIn();
      }
    };
    boot();

    return () => {
      syncService.cleanup();
    };
  }, []);

  const goTo = (next: OnboardingStep) => {
    setStep(next);
    fadeIn();
  };

  // ─── Passo 1A: Criar Círculo ────────────────────────────────────────────────
  const handleCreateCircle = () => {
    const code = generateCircleCode();
    setGeneratedCode(code);
    setCircleCode(code);
    setCircleMode("create");
    fadeIn();
  };

  const handleShareCode = async () => {
    try {
      await Share.share({
        message: `Entre no meu Círculo no aplicativo MOVA!\n\nCódigo de Convite: ${generatedCode}\n\nAbra o app MOVA no seu celular, toque em "Entrar em um Círculo" e digite este código para nos conectarmos em tempo real.`,
      });
    } catch {}
  };

  const confirmCreateCircle = async () => {
    syncService.updateCircleCode(generatedCode);
    await AsyncStorage.setItem(STORAGE_KEY_CIRCLE_CODE, generatedCode);
    goTo("role");
  };

  // ─── Passo 1B: Entrar em Círculo ────────────────────────────────────────────
  const handleJoinCircle = async () => {
    const trimmed = codeInput.trim().toUpperCase();
    if (trimmed.length < 5) return;
    setCircleCode(trimmed);
    syncService.updateCircleCode(trimmed);
    await AsyncStorage.setItem(STORAGE_KEY_CIRCLE_CODE, trimmed);
    goTo("role");
  };

  // ─── Passo 2: Papel do Aparelho ─────────────────────────────────────────────
  const handleSelectRole = async (selected: UserRole) => {
    setRole(selected);
    await AsyncStorage.setItem(STORAGE_KEY_ROLE, selected);

    if (selected === "senior") {
      goTo("senior_setup");
    } else {
      goTo("caregiver_setup");
    }
  };

  // ─── Passo 3A: Configurar Aparelho do Idoso ─────────────────────────────────
  const handleSaveSeniorSetup = async () => {
    const finalName = seniorName.trim() || "Idoso";
    const profile = {
      name: finalName,
      emergencyPhone: seniorPhone.trim() || "192",
      avatarEmoji: seniorEmoji,
    };

    syncService.updateProfile(profile);
    await AsyncStorage.setItem(STORAGE_KEY_SENIOR_PROFILE, JSON.stringify(profile));
    await AsyncStorage.setItem(STORAGE_KEY_ONBOARDED, "true");
    goTo("done");
  };

  // ─── Passo 3B: Configurar Painel do Cuidador ────────────────────────────────
  const handleSaveCaregiverSetup = async () => {
    if (seniorName.trim()) {
      const profile = {
        name: seniorName.trim(),
        emergencyPhone: seniorPhone.trim() || "192",
        avatarEmoji: seniorEmoji,
      };
      syncService.updateProfile(profile);
      await AsyncStorage.setItem(STORAGE_KEY_SENIOR_PROFILE, JSON.stringify(profile));
    }

    syncService.updateCaregiverProfile({
      name: caregiverName.trim() || "Cuidador",
    });

    await AsyncStorage.setItem(STORAGE_KEY_ONBOARDED, "true");
    goTo("done");
  };

  // ─── Reset / Reconfigurar ───────────────────────────────────────────────────
  const handleReset = async () => {
    await Promise.all([
      AsyncStorage.removeItem(STORAGE_KEY_ROLE),
      AsyncStorage.removeItem(STORAGE_KEY_CIRCLE_CODE),
      AsyncStorage.removeItem(STORAGE_KEY_ONBOARDED),
      AsyncStorage.removeItem(STORAGE_KEY_SENIOR_PROFILE),
    ]);
    setRole(null);
    setCircleCode("");
    setCircleMode(null);
    setCodeInput("");
    setGeneratedCode("");
    setSeniorName("");
    goTo("circle");
  };

  // ─── TELA DE CARREGAMENTO ───────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color="#4ECDC4" size="large" />
      </View>
    );
  }

  // ─── TELA PRINCIPAL (APÓS CONEXÃO) ──────────────────────────────────────────
  if (step === "done") {
    if (role === "caregiver") {
      return (
        <View style={{ flex: 1, backgroundColor: "#070b19" }}>
          <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
          <CaregiverScreen onReset={handleReset} />
        </View>
      );
    }

    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#070b19" />
        <View style={styles.screenContainer}>
          {/* Barra superior de status do Círculo para o Idoso */}
          <View style={styles.topMiniBar}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={[styles.miniDot, { backgroundColor: "#2da44e" }]} />
              <Text style={styles.miniBarTitle}>Aparelho do Idoso</Text>
              <View style={styles.codeChip}>
                <Text style={styles.codeChipText}>Círculo: {circleCode}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.btnSwitch}
              onPress={handleReset}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="swap-horizontal" size={13} color="#4ECDC4" style={{ marginRight: 4 }} />
              <Text style={styles.btnSwitchText}>Reconfigurar</Text>
            </TouchableOpacity>
          </View>

          <SeniorScreen />
        </View>
      </SafeAreaView>
    );
  }

  // ─── FLUXO DE CONEXÃO / ONBOARDING ──────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#070b19" />
      <ScrollView
        contentContainerStyle={styles.onboardingScroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.onboardingContainer, { opacity: fadeAnim }]}>
          {/* Logo */}
          <Image
            source={require("./assets/mova-logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />

          {/* ─────────────────────────────────────────────
              PASSO 1: CRIAR OU ENTRAR EM UM CÍRCULO
             ───────────────────────────────────────────── */}
          {step === "circle" && (
            <View style={styles.stepBox}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>Passo 1 de 3</Text>
              </View>
              <Text style={styles.stepTitle}>Conectar os Celulares</Text>
              <Text style={styles.stepSub}>
                Assim como no Life360, os aparelhos se comunicam através do mesmo Círculo Familiar.
              </Text>

              {circleMode === null && (
                <View style={{ gap: 14, width: "100%" }}>
                  <TouchableOpacity
                    style={styles.bigOptionBtn}
                    onPress={handleCreateCircle}
                    activeOpacity={0.85}
                  >
                    <View style={styles.bigOptionIconWrap}>
                      <Ionicons name="add-circle-outline" size={26} color="#4ECDC4" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.bigOptionTitle}>Criar novo Círculo</Text>
                      <Text style={styles.bigOptionSub}>
                        Gera um código para compartilhar com a família
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.4)" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.bigOptionBtn, { borderColor: "rgba(78, 205, 196, 0.35)" }]}
                    onPress={() => {
                      setCircleMode("join");
                      fadeIn();
                    }}
                    activeOpacity={0.85}
                  >
                    <View style={styles.bigOptionIconWrap}>
                      <Ionicons name="enter-outline" size={26} color="#4ECDC4" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.bigOptionTitle}>Entrar em um Círculo</Text>
                      <Text style={styles.bigOptionSub}>
                        Insira o código que você gerou no outro celular
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.4)" />
                  </TouchableOpacity>
                </View>
              )}

              {/* Criar → Exibir código gerado */}
              {circleMode === "create" && (
                <View style={{ gap: 16, width: "100%", alignItems: "center" }}>
                  <Text style={styles.generatedCodeLabel}>Seu Código de Círculo:</Text>
                  <View style={styles.generatedCodeBox}>
                    <Text style={styles.generatedCodeText}>{generatedCode}</Text>
                  </View>
                  <Text style={styles.generatedCodeHint}>
                    Compartilhe este código ou digite no segundo celular na opção "Entrar em um Círculo".
                  </Text>

                  <TouchableOpacity
                    style={styles.btnShare}
                    onPress={handleShareCode}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="share-social-outline" size={18} color="#FFFFFF" />
                    <Text style={styles.btnShareText}>Compartilhar (WhatsApp, etc.)</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.btnPrimary}
                    onPress={confirmCreateCircle}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.btnPrimaryText}>Continuar com este Código →</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      setCircleMode(null);
                      fadeIn();
                    }}
                  >
                    <Text style={styles.linkBack}>← Voltar</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Entrar em Círculo existente */}
              {circleMode === "join" && (
                <View style={{ gap: 16, width: "100%", alignItems: "center" }}>
                  <Text style={styles.inputLabel}>Digite o Código do Círculo:</Text>
                  <TextInput
                    style={styles.codeInput}
                    value={codeInput}
                    onChangeText={setCodeInput}
                    placeholder="Ex: 8WL-ZF3"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={7}
                  />
                  <Text style={styles.inputHint}>
                    Digite o código de 6 dígitos gerado no primeiro celular.
                  </Text>

                  <TouchableOpacity
                    style={[styles.btnPrimary, codeInput.trim().length < 5 && { opacity: 0.5 }]}
                    onPress={handleJoinCircle}
                    disabled={codeInput.trim().length < 5}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.btnPrimaryText}>Entrar no Círculo →</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      setCircleMode(null);
                      fadeIn();
                    }}
                  >
                    <Text style={styles.linkBack}>← Voltar</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* ─────────────────────────────────────────────
              PASSO 2: QUAL É O PAPEL DESTE CELULAR?
             ───────────────────────────────────────────── */}
          {step === "role" && (
            <View style={styles.stepBox}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>Passo 2 de 3</Text>
              </View>

              <View style={styles.circleCodeDisplay}>
                <Text style={styles.circleCodeDisplayLabel}>Círculo Conectado:</Text>
                <Text style={styles.circleCodeDisplayCode}>{circleCode}</Text>
              </View>

              <Text style={styles.stepTitle}>Quem vai usar este celular?</Text>
              <Text style={styles.stepSub}>
                Selecione o papel deste aparelho no Círculo Familiar:
              </Text>

              <View style={{ gap: 14, width: "100%" }}>
                <TouchableOpacity
                  style={[styles.roleCard, { borderColor: "rgba(45, 164, 78, 0.4)" }]}
                  onPress={() => handleSelectRole("senior")}
                  activeOpacity={0.85}
                >
                  <View
                    style={[
                      styles.roleIconWrap,
                      { backgroundColor: "rgba(45, 164, 78, 0.15)", borderColor: "#2da44e" },
                    ]}
                  >
                    <Ionicons name="person-outline" size={28} color="#2da44e" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.roleCardTitle}>Aparelho do Idoso</Text>
                    <Text style={styles.roleCardDesc}>
                      Fica no bolso do idoso: detecção de quedas, botão de pânico SOS e envio de GPS contínuo.
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.3)" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.roleCard, { borderColor: "rgba(142, 68, 173, 0.4)" }]}
                  onPress={() => handleSelectRole("caregiver")}
                  activeOpacity={0.85}
                >
                  <View
                    style={[
                      styles.roleIconWrap,
                      { backgroundColor: "rgba(142, 68, 173, 0.15)", borderColor: "#8E44AD" },
                    ]}
                  >
                    <Ionicons name="shield-checkmark-outline" size={28} color="#8E44AD" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.roleCardTitle}>Painel do Cuidador / Familiar</Text>
                    <Text style={styles.roleCardDesc}>
                      Fica com você: mapa em tempo real, áreas seguras, bateria e sirene de alerta quando o idoso precisar.
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.3)" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ─────────────────────────────────────────────
              PASSO 3A: CADASTRO NO APARELHO DO IDOSO
             ───────────────────────────────────────────── */}
          {step === "senior_setup" && (
            <View style={styles.stepBox}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>Passo 3 de 3</Text>
              </View>
              <Text style={styles.stepTitle}>Quem vai usar este aparelho?</Text>
              <Text style={styles.stepSub}>
                Informe o nome da pessoa idosa para personalizar a tela e os alertas enviados à família:
              </Text>

              <Text style={styles.inputLabel}>Nome do Idoso:</Text>
              <TextInput
                style={styles.textInput}
                value={seniorName}
                onChangeText={setSeniorName}
                placeholder="Ex: Seu João, Dona Maria"
                placeholderTextColor="rgba(255,255,255,0.3)"
                autoCorrect={false}
              />

              <Text style={styles.inputLabel}>Telefone de Emergência (opcional):</Text>
              <TextInput
                style={styles.textInput}
                value={seniorPhone}
                onChangeText={setSeniorPhone}
                placeholder="Ex: (91) 98888-7777 ou 192"
                placeholderTextColor="rgba(255,255,255,0.3)"
                keyboardType="phone-pad"
              />

              <TouchableOpacity
                style={[styles.btnPrimary, !seniorName.trim() && { opacity: 0.5 }]}
                onPress={handleSaveSeniorSetup}
                disabled={!seniorName.trim()}
                activeOpacity={0.85}
              >
                <Text style={styles.btnPrimaryText}>Ativar Proteção do Idoso</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ─────────────────────────────────────────────
              PASSO 3B: CADASTRO NO PAINEL DO CUIDADOR
             ───────────────────────────────────────────── */}
          {step === "caregiver_setup" && (
            <View style={styles.stepBox}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>Passo 3 de 3</Text>
              </View>
              <Text style={styles.stepTitle}>Identificação do Cuidador</Text>
              <Text style={styles.stepSub}>
                Configure como você aparecerá no círculo e confirme os dados da pessoa que você cuida:
              </Text>

              <Text style={styles.inputLabel}>Seu Nome (Cuidador):</Text>
              <TextInput
                style={styles.textInput}
                value={caregiverName}
                onChangeText={setCaregiverName}
                placeholder="Ex: Gabriel"
                placeholderTextColor="rgba(255,255,255,0.3)"
                autoCorrect={false}
              />

              <Text style={styles.inputLabel}>Nome do Idoso que você monitora:</Text>
              <TextInput
                style={styles.textInput}
                value={seniorName}
                onChangeText={setSeniorName}
                placeholder="Ex: Seu João (ou aguarde ele conectar)"
                placeholderTextColor="rgba(255,255,255,0.3)"
                autoCorrect={false}
              />

              <TouchableOpacity
                style={styles.btnPrimary}
                onPress={handleSaveCaregiverSetup}
                activeOpacity={0.85}
              >
                <Text style={styles.btnPrimaryText}>Acessar Painel do Cuidador →</Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#070b19" },
  loadingScreen: {
    flex: 1,
    backgroundColor: "#070b19",
    alignItems: "center",
    justifyContent: "center",
  },
  screenContainer: { flex: 1 },

  // Onboarding
  onboardingScroll: { flexGrow: 1, paddingBottom: 40 },
  onboardingContainer: { flex: 1, paddingHorizontal: 24, paddingTop: 24, alignItems: "center" },
  logo: { width: 160, height: 70, tintColor: "#FFFFFF", marginBottom: 20 },

  stepBox: { width: "100%", alignItems: "center", gap: 14 },
  stepBadge: {
    backgroundColor: "rgba(78, 205, 196, 0.15)",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(78, 205, 196, 0.35)",
  },
  stepBadgeText: { color: "#4ECDC4", fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  stepTitle: { color: "#FFFFFF", fontSize: 24, fontWeight: "900", textAlign: "center", marginTop: 4 },
  stepSub: { color: "rgba(255,255,255,0.6)", fontSize: 13, textAlign: "center", lineHeight: 20, marginBottom: 6 },

  bigOptionBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#131b31",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1.5,
    borderColor: "rgba(45, 164, 78, 0.35)",
    gap: 14,
  },
  bigOptionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(78, 205, 196, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  bigOptionTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  bigOptionSub: { color: "rgba(255,255,255,0.55)", fontSize: 11, marginTop: 2, lineHeight: 15 },

  generatedCodeLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  generatedCodeBox: {
    backgroundColor: "rgba(78, 205, 196, 0.12)",
    borderRadius: 16,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderWidth: 2,
    borderColor: "rgba(78, 205, 196, 0.45)",
  },
  generatedCodeText: { color: "#4ECDC4", fontSize: 36, fontWeight: "900", letterSpacing: 6 },
  generatedCodeHint: { color: "rgba(255,255,255,0.55)", fontSize: 12, textAlign: "center", lineHeight: 18 },

  btnShare: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    width: "100%",
    justifyContent: "center",
  },
  btnShareIcon: { fontSize: 18 },
  btnShareText: { color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: "700" },

  codeInput: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    color: "#4ECDC4",
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 4,
    textAlign: "center",
    borderWidth: 1.5,
    borderColor: "rgba(78, 205, 196, 0.35)",
  },
  inputHint: { color: "rgba(255,255,255,0.45)", fontSize: 11, textAlign: "center", lineHeight: 16 },

  btnPrimary: {
    width: "100%",
    backgroundColor: "#1f6feb",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 4,
    shadowColor: "#1f6feb",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },
  btnPrimaryText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  linkBack: { color: "rgba(255,255,255,0.45)", fontSize: 12, fontWeight: "700", marginTop: 4 },

  circleCodeDisplay: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(78, 205, 196, 0.1)",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "rgba(78, 205, 196, 0.3)",
  },
  circleCodeDisplayLabel: { color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: "700" },
  circleCodeDisplayCode: { color: "#4ECDC4", fontSize: 13, fontWeight: "900", letterSpacing: 1 },

  roleCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#131b31",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1.5,
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  roleIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
  },
  roleCardTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  roleCardDesc: { color: "rgba(255,255,255,0.55)", fontSize: 11, lineHeight: 16, marginTop: 3 },
  roleArrow: { color: "rgba(255,255,255,0.3)", fontSize: 20, fontWeight: "900" },

  inputLabel: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 12,
    fontWeight: "700",
    alignSelf: "flex-start",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  textInput: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
    color: "#FFFFFF",
    fontSize: 15,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  emojiRow: { flexDirection: "row", gap: 10, justifyContent: "center", width: "100%" },
  emojiBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.1)",
  },
  emojiBtnActive: { backgroundColor: "rgba(78, 205, 196, 0.2)", borderColor: "#4ECDC4" },

  // Barra de status após conexão
  topMiniBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
    backgroundColor: "rgba(13, 20, 36, 0.97)",
  },
  miniDot: { width: 7, height: 7, borderRadius: 4 },
  miniBarTitle: { color: "rgba(255,255,255,0.75)", fontSize: 11, fontWeight: "800" },
  codeChip: {
    backgroundColor: "rgba(78,205,196,0.12)",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "rgba(78,205,196,0.3)",
    marginLeft: 6,
  },
  codeChipText: { color: "#4ECDC4", fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  btnSwitch: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  btnSwitchText: { color: "rgba(255,255,255,0.45)", fontSize: 10, fontWeight: "700" },
});
