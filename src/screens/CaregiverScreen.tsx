import { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  Linking,
  Modal,
  TextInput,
  Dimensions,
  Share,
  Vibration,
  Platform,
  SafeAreaView,
  StatusBar,
  PanResponder,
} from "react-native";
import MapView, { Marker, Circle } from "react-native-maps";
import { useAudioPlayer, setAudioModeAsync } from "expo-audio";
import { useKeepAwake } from "expo-keep-awake";
import { Ionicons } from "@expo/vector-icons";
import { syncService } from "../services/syncService";
import {
  getCurrentDeviceLocation,
  SUGGESTED_BELEM_PLACES,
  SuggestedPlace,
} from "../services/locationService";
import { MovaGlobalState, SafePlace, CommunityAlert } from "../types";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface CaregiverScreenProps {
  onReset?: () => void;
}

type TabType = "places" | "senior" | "network" | "history" | "demo";

export default function CaregiverScreen({ onReset }: CaregiverScreenProps) {
  useKeepAwake();
  const [globalState, setGlobalState] = useState<MovaGlobalState>(syncService.getState());
  const [deviceCoords, setDeviceCoords] = useState<{ lat: number; lng: number }>({
    lat: -1.425,
    lng: -48.455,
  });

  const mapRef = useRef<MapView | null>(null);

  // Controle de expansão do Painel Inferior (Bottom Sheet)
  // false = ~370px (confortável), true = 82% da tela (amplo e espaçoso)
  const [isSheetExpanded, setIsSheetExpanded] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<TabType>("places");

  // Modais Funcionais dos Botões Superiores
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showCircleModal, setShowCircleModal] = useState<boolean>(false);
  const [showNotificationCenter, setShowNotificationCenter] = useState<boolean>(false);
  const [showSOSModal, setShowSOSModal] = useState<boolean>(false);

  // Modais do Fluxo Completo de Locais (Screenshots 1, 2, 3 e 4)
  const [showManagePlacesModal, setShowManagePlacesModal] = useState<boolean>(false);
  const [showAddPlaceSearchModal, setShowAddPlaceSearchModal] = useState<boolean>(false);
  const [showAddedConfirmationModal, setShowAddedConfirmationModal] = useState<boolean>(false);
  const [lastAddedPlace, setLastAddedPlace] = useState<SuggestedPlace | null>(null);

  // Busca de locais
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Configurações e formulário editável
  const [customEmergencyPhone, setCustomEmergencyPhone] = useState<string>("192");
  const [soundAlertsEnabled, setSoundAlertsEnabled] = useState<boolean>(true);
  const [geofenceAlertsEnabled, setGeofenceAlertsEnabled] = useState<boolean>(true);

  // Áudio da Sirene de Emergência do Cuidador
  const emergencyPlayer = useAudioPlayer(require("../../assets/alarm.wav"));

  useEffect(() => {
    try {
      setAudioModeAsync({ playsInSilentMode: true });
    } catch {}
  }, []);

  // Rastreamento de alarmes silenciados
  const lastHandledTimestampRef = useRef<number>(0);
  const silencedTimestampsRef = useRef<Set<number>>(new Set());

  const stopEmergencyAudioAndVibration = () => {
    try {
      if (Platform.OS !== "web") {
        Vibration.cancel();
      }
      emergencyPlayer.pause();
      emergencyPlayer.seekTo(0);
    } catch {}
  };

  const startEmergencyAudioAndVibration = () => {
    try {
      if (soundAlertsEnabled) {
        if (Platform.OS !== "web") {
          Vibration.vibrate([0, 800, 300, 800, 300, 800], true);
        }
        emergencyPlayer.loop = true;
        emergencyPlayer.volume = 1.0;
        emergencyPlayer.seekTo(0);
        emergencyPlayer.play();
      }
    } catch {}
  };

  // Assinatura ao estado global em tempo real
  useEffect(() => {
    const unsubscribe = syncService.subscribe((newState) => {
      setGlobalState(newState);

      const ts = newState.emergencyTimestamp || 0;
      if (newState.isEmergencyActive && ts > 0) {
        if (!silencedTimestampsRef.current.has(ts)) {
          if (ts !== lastHandledTimestampRef.current) {
            lastHandledTimestampRef.current = ts;
            startEmergencyAudioAndVibration();
            handleCenterOnSenior();
          }
        }
      } else {
        stopEmergencyAudioAndVibration();
      }
    });

    return () => {
      unsubscribe();
      stopEmergencyAudioAndVibration();
    };
  }, [soundAlertsEnabled]);

  // GPS do cuidador
  useEffect(() => {
    const initGPS = async () => {
      const coords = await getCurrentDeviceLocation();
      if (coords) {
        setDeviceCoords(coords);
      }
    };
    initGPS();
  }, []);

  const {
    isEmergencyActive,
    batteryLevel,
    isCharging,
    isOutOfSafePlace,
    safePlaces,
    seniorProfile,
    events,
    circleCode,
    lastHeartbeat,
    caregiverProfile,
    emergencyTimestamp,
    currentPlaceName,
    placeSinceText,
    communityAlerts,
  } = globalState;

  // Coordenadas do idoso: GPS real ou leve deslocamento
  const seniorCoords = globalState.seniorCoords || {
    lat: deviceCoords.lat + 0.0006,
    lng: deviceCoords.lng - 0.0006,
  };

  const seniorDisplayName = seniorProfile?.name?.trim() || "Larissa";
  const caregiverDisplayName = caregiverProfile?.name?.trim() || "Gabriel";
  const circleDisplayName = caregiverProfile?.circleName?.trim() || "Família Rodrigues Bezerra";

  // Centralizar mapa no idoso
  const handleCenterOnSenior = () => {
    if (mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: seniorCoords.lat,
        longitude: seniorCoords.lng,
        latitudeDelta: 0.006,
        longitudeDelta: 0.006,
      });
    }
  };

  // Centralizar mapa em um local específico
  const handleCenterOnPlace = (lat: number, lng: number) => {
    if (mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: lat,
        longitude: lng,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      });
    }
  };

  // Ligar para o Idoso
  const handleCallSenior = () => {
    stopEmergencyAudioAndVibration();
    const ts = emergencyTimestamp || Date.now();
    silencedTimestampsRef.current.add(ts);
    lastHandledTimestampRef.current = ts;
    syncService.dismissEmergency();

    const phone = seniorProfile?.emergencyPhone || customEmergencyPhone || "192";
    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert("Ligação", `Ligando para ${seniorDisplayName} (${phone})`);
    });
  };

  // Silenciar e Confirmar Atendimento
  const handleDismissEmergency = () => {
    stopEmergencyAudioAndVibration();
    const ts = emergencyTimestamp || Date.now();
    silencedTimestampsRef.current.add(ts);
    lastHandledTimestampRef.current = ts;
    syncService.dismissEmergency();
  };

  // Compartilhar código do círculo
  const handleShareCode = async () => {
    try {
      await Share.share({
        message: `Entre no meu Círculo no aplicativo MOVA!\n\nCódigo do Círculo: ${circleCode}\n\nConecte o celular do idoso para monitoramento de áreas seguras e detecção de quedas ao vivo.`,
      });
    } catch {}
  };

  // Ação Real do Botão Check-in
  const handlePerformCheckIn = () => {
    const timeStr = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    syncService.addEvent({
      id: Date.now(),
      time: timeStr,
      type: "zona_segura",
      status: "confirmado_bem",
      description: `Check-in manual confirmado pelo cuidador ${caregiverDisplayName} às ${timeStr}.`,
    });
    Alert.alert(
      "Check-in Confirmado!",
      `O status de ${seniorDisplayName} foi atualizado com sucesso no círculo familiar às ${timeStr}.`
    );
  };

  // Ação de Selecionar Local (Fluxo Screenshot 3 -> 4)
  const handleSelectSuggestedPlace = (place: SuggestedPlace) => {
    setShowAddPlaceSearchModal(false);
    setLastAddedPlace(place);
    setShowAddedConfirmationModal(true);
  };

  // Confirmação final do Local (Fluxo Screenshot 4 -> 5)
  const handleConfirmAddPlace = () => {
    if (lastAddedPlace) {
      syncService.addCustomPlace({
        name: lastAddedPlace.name,
        icon: lastAddedPlace.icon,
        lat: lastAddedPlace.lat,
        lng: lastAddedPlace.lng,
        radiusMeters: lastAddedPlace.radiusMeters,
        address: lastAddedPlace.address,
      });
      setShowAddedConfirmationModal(false);
      setShowManagePlacesModal(false);
      handleCenterOnPlace(lastAddedPlace.lat, lastAddedPlace.lng);
    }
  };

  // Remover local
  const handleRemovePlace = (placeId: string, placeName: string) => {
    Alert.alert("Remover Área Segura", `Deseja remover "${placeName}" das áreas monitoradas?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Remover",
        style: "destructive",
        onPress: () => syncService.removeSafePlace(placeId),
      },
    ]);
  };

  // Simulações para apresentação ao professor
  const handleSimulateLeave = () => {
    syncService.simulateLeavingClassroom();
    if (mapRef.current && seniorCoords) {
      mapRef.current.animateToRegion({
        latitude: seniorCoords.lat + 0.0004,
        longitude: seniorCoords.lng + 0.0004,
        latitudeDelta: 0.004,
        longitudeDelta: 0.004,
      });
    }
  };

  const handleSimulateReturn = () => {
    syncService.simulateReturningToClassroom();
    if (mapRef.current && seniorCoords) {
      mapRef.current.animateToRegion({
        latitude: seniorCoords.lat,
        longitude: seniorCoords.lng,
        latitudeDelta: 0.004,
        longitudeDelta: 0.004,
      });
    }
  };

  const handleSimulateFall = () => {
    syncService.triggerEmergency("sos", 3.2);
  };

  // Gestor de arrasto para o painel inferior deslizar para cima/baixo
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 10,
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy < -40) {
          setIsSheetExpanded(true);
        } else if (gestureState.dy > 40) {
          setIsSheetExpanded(false);
        }
      },
    })
  ).current;

  // Filtragem da busca de locais
  const filteredPlaces = SUGGESTED_BELEM_PLACES.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ─────────────────────────────────────────────
          1. MAPA EM TELA CHEIA (FULLSCREEN)
         ───────────────────────────────────────────── */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        userInterfaceStyle="dark"
        initialRegion={{
          latitude: seniorCoords.lat,
          longitude: seniorCoords.lng,
          latitudeDelta: 0.012,
          longitudeDelta: 0.012,
        }}
        showsCompass={false}
        showsBuildings={true}
      >
        {/* Áreas Seguras Demarcadas (Círculos Translúcidos Roxos/Azuis) */}
        {safePlaces.map((place) => (
          <Circle
            key={`safe_circle_${place.id}`}
            center={{ latitude: place.lat, longitude: place.lng }}
            radius={place.radiusMeters}
            fillColor="rgba(124, 58, 237, 0.18)"
            strokeColor="#7C3AED"
            strokeWidth={2}
          />
        ))}

        {/* Pinos Roxos de Todos os Locais Cadastrados (Screenshot 5) */}
        {safePlaces.map((place) => (
          <Marker
            key={`safe_marker_${place.id}`}
            coordinate={{ latitude: place.lat, longitude: place.lng }}
            title={place.name}
            description={`Área Segura • Raio de ${place.radiusMeters}m`}
          >
            <View style={styles.placeMarkerPin}>
              <Ionicons name="location" size={18} color="#FFFFFF" />
            </View>
          </Marker>
        ))}

        {/* Marcador do Idoso com Balão de Status (Estilo Life360) */}
        <Marker coordinate={{ latitude: seniorCoords.lat, longitude: seniorCoords.lng }} zIndex={5}>
          <View style={styles.seniorMarkerWrapper}>
            <View style={[styles.speechBubble, isOutOfSafePlace && styles.speechBubbleAlert]}>
              <Ionicons
                name={isOutOfSafePlace ? "warning" : "location"}
                size={13}
                color={isOutOfSafePlace ? "#DC2626" : "#7C3AED"}
                style={{ marginRight: 4 }}
              />
              <Text style={[styles.speechBubbleText, isOutOfSafePlace && styles.speechBubbleTextAlert]}>
                {isOutOfSafePlace
                  ? "Fora da área segura!"
                  : placeSinceText
                  ? `Está aqui há ${placeSinceText}`
                  : "Está em Casa"}
              </Text>
            </View>
            <View style={[styles.speechBeak, isOutOfSafePlace && styles.speechBeakAlert]} />

            <View style={styles.avatarGroup}>
              <View style={[styles.seniorAvatarPin, isEmergencyActive && styles.seniorAvatarPinEmergency]}>
                <Text style={styles.seniorAvatarPinLetter}>
                  {seniorDisplayName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.caregiverMiniBadge}>
                <Text style={styles.caregiverMiniBadgeText}>
                  {caregiverDisplayName.charAt(0).toUpperCase()}
                </Text>
              </View>
            </View>
          </View>
        </Marker>

        {/* Marcador do Cuidador */}
        <Marker coordinate={{ latitude: deviceCoords.lat, longitude: deviceCoords.lng }} zIndex={3}>
          <View style={styles.caregiverMarker}>
            <Text style={styles.caregiverMarkerText}>Você</Text>
          </View>
        </Marker>
      </MapView>

      {/* ─────────────────────────────────────────────
          2. BARRA SUPERIOR FLUTUANTE (TOTALMENTE FUNCIONAL)
         ───────────────────────────────────────────── */}
      <SafeAreaView style={styles.topBarSafe}>
        <View style={styles.topBar}>
          {/* Botão de Configurações ⚙️ (Abre Modal de Configurações) */}
          <TouchableOpacity
            style={styles.topCircleBtn}
            onPress={() => setShowSettingsModal(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="settings" size={20} color="#7C3AED" />
          </TouchableOpacity>

          {/* Pílula com Nome do Círculo Familiar ⌵ (Abre Modal de Membros) */}
          <TouchableOpacity
            style={styles.circlePill}
            onPress={() => setShowCircleModal(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.circlePillText} numberOfLines={1}>
              {circleDisplayName}
            </Text>
            <Ionicons name="chevron-down" size={15} color="#6B7280" />
          </TouchableOpacity>

          {/* Botão de Notificações 🔔 com Badge (Abre Central de Notificações) */}
          <TouchableOpacity
            style={styles.topCircleBtn}
            onPress={() => setShowNotificationCenter(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="notifications" size={20} color="#7C3AED" />
            <View style={styles.badgeCount}>
              <Text style={styles.badgeCountText}>3</Text>
            </View>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* ─────────────────────────────────────────────
          3. BOTÕES FLUTUANTES SOBRE O MAPA (ÚTEIS E DIRETOS)
         ───────────────────────────────────────────── */}
      <View style={[styles.mapActionRow, { bottom: isSheetExpanded ? SCREEN_HEIGHT * 0.84 : 375 }]}>
        <View style={styles.mapActionLeftPills}>
          {/* Botão Check-in (Executa e Registra na Hora) */}
          <TouchableOpacity
            style={styles.floatingPill}
            onPress={handlePerformCheckIn}
            activeOpacity={0.88}
          >
            <Ionicons name="checkmark-circle" size={17} color="#7C3AED" style={{ marginRight: 5 }} />
            <Text style={styles.floatingPillText}>Check-in</Text>
          </TouchableOpacity>

          {/* Botão SOS Emergência (Abre Modal de Ajuda) */}
          <TouchableOpacity
            style={[styles.floatingPill, isEmergencyActive && styles.floatingPillEmergency]}
            onPress={() => setShowSOSModal(true)}
            activeOpacity={0.88}
          >
            <Ionicons
              name="shield-checkmark"
              size={17}
              color={isEmergencyActive ? "#DC2626" : "#7C3AED"}
              style={{ marginRight: 5 }}
            />
            <Text style={[styles.floatingPillText, isEmergencyActive && { color: "#DC2626" }]}>
              {isEmergencyActive ? "SOS ATIVO" : "Configurar o SOS"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.mapActionRightBtns}>
          {/* Botão [+] Adicionar Local Imediato */}
          <TouchableOpacity
            style={styles.mapFabBtn}
            onPress={() => setShowManagePlacesModal(true)}
            activeOpacity={0.88}
          >
            <Ionicons name="add" size={24} color="#7C3AED" />
          </TouchableOpacity>

          {/* Botão de Centralizar / Focar no Idoso */}
          <TouchableOpacity
            style={styles.mapFabBtn}
            onPress={handleCenterOnSenior}
            activeOpacity={0.88}
          >
            <Ionicons name="locate" size={20} color="#7C3AED" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ─────────────────────────────────────────────
          4. PAINEL INFERIOR DO MOVA (BOTTOM SHEET QUE DESLIZA E SOBE)
         ───────────────────────────────────────────── */}
      <View
        style={[
          styles.bottomSheet,
          isSheetExpanded ? styles.bottomSheetFull : styles.bottomSheetComfortable,
        ]}
      >
        {/* Puxador com Gesto de Arrasto e Botão de Expandir/Recolher */}
        <View {...panResponder.panHandlers}>
          <TouchableOpacity
            style={styles.sheetHandleWrapper}
            onPress={() => setIsSheetExpanded(!isSheetExpanded)}
            activeOpacity={0.8}
          >
            <View style={styles.sheetHandle} />
            <View style={styles.handleExpandIndicator}>
              <Ionicons
                name={isSheetExpanded ? "chevron-down" : "chevron-up"}
                size={14}
                color="#64748B"
              />
              <Text style={styles.handleExpandText}>
                {isSheetExpanded ? "Toque para recolher painel" : "Deslize ou toque para expandir"}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Linha de Abas do MOVA */}
        <View style={styles.sheetTabBar}>
          <TouchableOpacity
            style={[styles.sheetTabItem, activeTab === "places" && styles.sheetTabItemActive]}
            onPress={() => {
              setActiveTab("places");
              setIsSheetExpanded(true);
            }}
          >
            <Ionicons
              name="location"
              size={17}
              color={activeTab === "places" ? "#7C3AED" : "#64748B"}
            />
            <Text style={[styles.sheetTabText, activeTab === "places" && styles.sheetTabTextActive]}>
              Locais ({safePlaces.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sheetTabItem, activeTab === "senior" && styles.sheetTabItemActive]}
            onPress={() => setActiveTab("senior")}
          >
            <Ionicons
              name="person"
              size={17}
              color={activeTab === "senior" ? "#7C3AED" : "#64748B"}
            />
            <Text style={[styles.sheetTabText, activeTab === "senior" && styles.sheetTabTextActive]}>
              Idoso
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sheetTabItem, activeTab === "network" && styles.sheetTabItemActive]}
            onPress={() => {
              setActiveTab("network");
              setIsSheetExpanded(true);
            }}
          >
            <Ionicons
              name="people"
              size={17}
              color={activeTab === "network" ? "#7C3AED" : "#64748B"}
            />
            <Text style={[styles.sheetTabText, activeTab === "network" && styles.sheetTabTextActive]}>
              Rede
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sheetTabItem, activeTab === "history" && styles.sheetTabItemActive]}
            onPress={() => {
              setActiveTab("history");
              setIsSheetExpanded(true);
            }}
          >
            <Ionicons
              name="time"
              size={17}
              color={activeTab === "history" ? "#7C3AED" : "#64748B"}
            />
            <Text style={[styles.sheetTabText, activeTab === "history" && styles.sheetTabTextActive]}>
              Histórico
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sheetTabItem, activeTab === "demo" && styles.sheetTabItemActive]}
            onPress={() => {
              setActiveTab("demo");
              setIsSheetExpanded(true);
            }}
          >
            <Ionicons
              name="flask"
              size={17}
              color={activeTab === "demo" ? "#7C3AED" : "#64748B"}
            />
            <Text style={[styles.sheetTabText, activeTab === "demo" && styles.sheetTabTextActive]}>
              Testes
            </Text>
          </TouchableOpacity>
        </View>

        {/* ─── CONTEÚDO ROLÁVEL COM ESPAÇO AMPLO ─── */}
        <ScrollView
          style={styles.sheetScrollView}
          contentContainerStyle={styles.sheetScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* 1. ABA LOCAIS (EXATAMENTE COMO NO SCREENSHOT 1) */}
          {activeTab === "places" && (
            <View>
              {/* Card Ilustrado: Salve os Locais que mais importam (Screenshot 1) */}
              <View style={styles.placesPromoCard}>
                <View style={styles.promoIconsRow}>
                  <View style={styles.promoIconSquare}>
                    <Ionicons name="business" size={32} color="#7C3AED" />
                  </View>
                  <View style={[styles.promoIconSquare, { backgroundColor: "#F3E8FF" }]}>
                    <Ionicons name="home" size={32} color="#9333EA" />
                  </View>
                </View>

                <Text style={styles.promoCardTitle}>Salve os Locais que mais importam</Text>
                <Text style={styles.promoCardSubtitle}>
                  Saiba o momento exato em que o idoso chega ou sai de cada ponto protegido.
                </Text>

                {/* Botão Gerenciar Locais (Abre o fluxo dos Screenshots 2, 3 e 4) */}
                <TouchableOpacity
                  style={styles.btnManagePlaces}
                  onPress={() => setShowManagePlacesModal(true)}
                  activeOpacity={0.88}
                >
                  <Text style={styles.btnManagePlacesText}>Gerenciar Locais</Text>
                </TouchableOpacity>
              </View>

              {/* Lista dos Locais Ativos no Radar */}
              <Text style={styles.sectionTitleSmall}>Locais Cadastrados no Mapa</Text>
              {safePlaces.map((place) => (
                <View key={place.id} style={styles.placeActiveItem}>
                  <View style={styles.placeActivePinIcon}>
                    <Ionicons name="location" size={20} color="#7C3AED" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.placeActiveName}>{place.name}</Text>
                    <Text style={styles.placeActiveAddress}>{place.address}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.placeFocusBtn}
                    onPress={() => handleCenterOnPlace(place.lat, place.lng)}
                  >
                    <Ionicons name="navigate" size={16} color="#7C3AED" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* 2. ABA IDOSO (CARD DO MEMBRO ESTILO LIFE360) */}
          {activeTab === "senior" && (
            <View>
              <View style={styles.memberCardBox}>
                <View style={styles.memberAvatarContainer}>
                  <View style={styles.memberAvatarCircle}>
                    <Text style={styles.memberAvatarCircleText}>
                      {seniorDisplayName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  {/* Pílula de Bateria Sobreposta no Avatar */}
                  <View style={[styles.batteryPillBadge, batteryLevel <= 25 && styles.batteryPillBadgeLow]}>
                    <Ionicons
                      name={isCharging ? "battery-charging" : "battery-full"}
                      size={12}
                      color={batteryLevel <= 25 ? "#DC2626" : "#16A34A"}
                    />
                    <Text style={[styles.batteryPillBadgeText, batteryLevel <= 25 && styles.batteryPillBadgeTextLow]}>
                      {batteryLevel}%
                    </Text>
                  </View>
                </View>

                <View style={styles.memberInfoCol}>
                  <Text style={styles.memberFullName}>{seniorDisplayName}</Text>
                  <Text style={[styles.memberStatusLabel, isOutOfSafePlace && styles.memberStatusLabelAlert]}>
                    {isOutOfSafePlace ? "⚠️ Fora da Área Segura" : "Em Casa"}
                  </Text>
                  <Text style={styles.memberSinceLabel}>
                    {placeSinceText || "Desde 25 de set."}
                  </Text>
                </View>

                {/* Botão de Chamada Imediata */}
                <TouchableOpacity
                  style={styles.memberCallCircleBtn}
                  onPress={handleCallSenior}
                  activeOpacity={0.85}
                >
                  <Ionicons name="call" size={18} color="#7C3AED" />
                </TouchableOpacity>
              </View>

              {/* Botão Grande de Ligar */}
              <TouchableOpacity
                style={styles.btnBigCallSenior}
                onPress={handleCallSenior}
                activeOpacity={0.88}
              >
                <Ionicons name="call" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.btnBigCallSeniorText}>
                  LIGAR PARA {seniorDisplayName.toUpperCase()}
                </Text>
              </TouchableOpacity>

              {/* Botão de Acesso Direto aos Locais */}
              <TouchableOpacity
                style={styles.btnQuickAddPlace}
                onPress={() => setShowManagePlacesModal(true)}
                activeOpacity={0.88}
              >
                <Ionicons name="add-circle-outline" size={20} color="#7C3AED" style={{ marginRight: 8 }} />
                <Text style={styles.btnQuickAddPlaceText}>Adicionar Novo Ponto Seguro no Mapa</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* 3. ABA REDE DE APOIO COMUNITÁRIA */}
          {activeTab === "network" && (
            <View>
              {/* Cabeçalho explicativo */}
              <View style={styles.networkHeaderCard}>
                <View style={styles.networkHeaderIconRow}>
                  <Ionicons name="shield-checkmark" size={26} color="#7C3AED" />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.networkHeaderTitle}>Rede de Proteção Local</Text>
                    <Text style={styles.networkHeaderSub}>
                      Alertas de idosos desorientados e pedidos de apoio de vizinhos a menos de 5 km.
                    </Text>
                  </View>
                </View>
              </View>

              {/* Contador de alertas ativos */}
              <View style={styles.networkAlertsBadgeRow}>
                <View style={styles.networkAlertsBadge}>
                  <Ionicons name="alert-circle" size={14} color="#DC2626" style={{ marginRight: 4 }} />
                  <Text style={styles.networkAlertsBadgeText}>
                    {communityAlerts.filter(a => a.status === "searching").length} alerta(s) ativo(s) na sua região
                  </Text>
                </View>
              </View>

              {/* Lista de alertas comunitários */}
              {communityAlerts.length === 0 ? (
                <View style={styles.networkEmptyBox}>
                  <Ionicons name="checkmark-circle" size={36} color="#16A34A" />
                  <Text style={styles.networkEmptyTitle}>Nenhum alerta na região</Text>
                  <Text style={styles.networkEmptyText}>Sua vizinhança está tranquila. Ótima notícia!</Text>
                </View>
              ) : (
                communityAlerts.map((alert: CommunityAlert) => (
                  <View
                    key={alert.id}
                    style={[
                      styles.networkAlertCard,
                      alert.status === "found" && styles.networkAlertCardFound,
                    ]}
                  >
                    {/* Header do alerta */}
                    <View style={styles.networkAlertHeader}>
                      <View style={[styles.networkAlertTypeTag, alert.type === "emergency_help" && styles.networkAlertTypeTagHelp]}>
                        <Ionicons
                          name={alert.type === "senior_lost" ? "search" : "hand-left"}
                          size={11}
                          color={alert.type === "senior_lost" ? "#DC2626" : "#D97706"}
                          style={{ marginRight: 3 }}
                        />
                        <Text style={[styles.networkAlertTypeText, alert.type === "emergency_help" && styles.networkAlertTypeTextHelp]}>
                          {alert.type === "senior_lost" ? "ALERTA PRATA" : "APOIO EMERGENCIAL"}
                        </Text>
                      </View>
                      <View style={[styles.networkStatusTag, alert.status === "found" && styles.networkStatusTagFound]}>
                        <Text style={[styles.networkStatusText, alert.status === "found" && styles.networkStatusTextFound]}>
                          {alert.status === "found" ? "✓ Encontrado" : "● Procurando"}
                        </Text>
                      </View>
                    </View>

                    {/* Info do idoso */}
                    <View style={styles.networkAlertBody}>
                      <View style={styles.networkAlertAvatarWrap}>
                        <Text style={styles.networkAlertAvatar}>{alert.avatarEmoji || "👴"}</Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.networkAlertName}>{alert.name}</Text>
                        <Text style={styles.networkAlertDesc} numberOfLines={2}>{alert.description}</Text>
                      </View>
                    </View>

                    {/* Local e hora */}
                    <View style={styles.networkAlertLocationRow}>
                      <Ionicons name="location-outline" size={13} color="#64748B" style={{ marginRight: 4 }} />
                      <Text style={styles.networkAlertLocation} numberOfLines={1}>{alert.lastSeenLocation}</Text>
                    </View>
                    <View style={styles.networkAlertTimeRow}>
                      <Ionicons name="time-outline" size={13} color="#64748B" style={{ marginRight: 4 }} />
                      <Text style={styles.networkAlertTime}>Último avistamento: {alert.lastSeenTime}</Text>
                    </View>

                    {/* Botão de contato */}
                    {alert.status === "searching" && (
                      <TouchableOpacity
                        style={styles.networkCallBtn}
                        onPress={() =>
                          Linking.openURL(`tel:${alert.contactPhone}`).catch(() =>
                            Alert.alert("Contato", `Ligue para: ${alert.contactPhone}`)
                          )
                        }
                        activeOpacity={0.85}
                      >
                        <Ionicons name="call" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <Text style={styles.networkCallBtnText}>Contatar Família: {alert.contactPhone}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))
              )}
            </View>
          )}

          {/* 4. ABA HISTÓRICO */}
          {activeTab === "history" && (
            <View>
              <Text style={styles.sectionTitleSmall}>Registro de Chegadas e Saídas</Text>
              {events && events.length > 0 ? (
                events.map((ev) => (
                  <View key={ev.id} style={styles.historyCardItem}>
                    <Ionicons
                      name={
                        ev.type === "sos"
                          ? "alert-circle"
                          : ev.type === "queda"
                          ? "warning"
                          : "location"
                      }
                      size={20}
                      color={
                        ev.type === "sos"
                          ? "#DC2626"
                          : ev.type === "queda"
                          ? "#D97706"
                          : "#7C3AED"
                      }
                    />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.historyEventText}>{ev.description}</Text>
                      <Text style={styles.historyEventDate}>{ev.time}</Text>
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.emptyHistoryBox}>
                  <Ionicons name="time-outline" size={32} color="#94A3B8" />
                  <Text style={styles.emptyHistoryText}>Nenhum registro de saída ou chegada ainda.</Text>
                </View>
              )}
            </View>
          )}

          {/* 4. ABA TESTES (PROFESSOR) */}
          {activeTab === "demo" && (
            <View style={styles.demoCardBox}>
              <View style={styles.demoHeaderRow}>
                <Ionicons name="flask-outline" size={20} color="#7C3AED" />
                <Text style={styles.demoHeaderTitle}>Demonstração ao Vivo (Apresentação)</Text>
              </View>
              <Text style={styles.demoHeaderSub}>
                Gatilhos imediatos para demonstrar ao professor a saída de áreas seguras e alerta sonoro sem atrasos:
              </Text>

              <View style={styles.demoButtonsStack}>
                <TouchableOpacity
                  style={[styles.demoActionButton, { backgroundColor: "#DC2626" }]}
                  onPress={handleSimulateLeave}
                  activeOpacity={0.88}
                >
                  <Ionicons name="exit-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.demoActionButtonText}>Simular Saída da Sala (Alerta Imediato)</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.demoActionButton, { backgroundColor: "#16A34A" }]}
                  onPress={handleSimulateReturn}
                  activeOpacity={0.88}
                >
                  <Ionicons name="enter-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.demoActionButtonText}>Simular Retorno à Área Segura</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.demoActionButton, { backgroundColor: "#B91C1C" }]}
                  onPress={handleSimulateFall}
                  activeOpacity={0.88}
                >
                  <Ionicons name="warning-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.demoActionButtonText}>Simular Queda (Sirene SOS)</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      </View>

      {/* ─────────────────────────────────────────────
          MODAL 1: GERENCIAR LOCAIS (SCREENSHOT 2)
         ───────────────────────────────────────────── */}
      <Modal visible={showManagePlacesModal} transparent={false} animationType="slide">
        <SafeAreaView style={styles.fullModalSafe}>
          {/* Header com ✕ e Título "Locais" */}
          <View style={styles.fullModalHeader}>
            <TouchableOpacity
              onPress={() => setShowManagePlacesModal(false)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close" size={26} color="#0F172A" />
            </TouchableOpacity>
            <Text style={styles.fullModalHeaderTitle}>Locais</Text>
            <View style={{ width: 26 }} />
          </View>

          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            {/* Opção do Topo: + Adicionar um novo Local */}
            <TouchableOpacity
              style={styles.btnAddPlaceTopRow}
              onPress={() => {
                setSearchQuery("");
                setShowAddPlaceSearchModal(true);
              }}
              activeOpacity={0.8}
            >
              <View style={styles.purplePlusCircle}>
                <Ionicons name="add" size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.btnAddPlaceTopText}>Adicionar um novo Local</Text>
            </TouchableOpacity>

            <View style={styles.dividerLine} />

            {/* Lista dos Locais Cadastrados */}
            {safePlaces.map((place) => (
              <View key={place.id} style={styles.savedPlaceRow}>
                <View style={styles.savedPlacePinCircle}>
                  <Ionicons name="location" size={20} color="#7C3AED" />
                </View>
                <Text style={styles.savedPlaceName}>{place.name}</Text>
                <View style={styles.savedPlaceActions}>
                  <TouchableOpacity
                    onPress={() => handleRemovePlace(place.id, place.name)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={{ marginRight: 14 }}
                  >
                    <Ionicons name="close" size={20} color="#64748B" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() =>
                      Alert.alert(
                        "Notificações do Local",
                        `Você receberá notificações sempre que ${seniorDisplayName} entrar ou sair de ${place.name}.`
                      )
                    }
                  >
                    <Ionicons name="notifications" size={20} color="#7C3AED" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            <View style={styles.dividerLine} />

            {/* Sugestões de Locais Prontos (Exatamente como Screenshot 2) */}
            <TouchableOpacity
              style={styles.suggestionPlaceRow}
              onPress={() => {
                setSearchQuery("Casa");
                setShowAddPlaceSearchModal(true);
              }}
            >
              <View style={[styles.suggestionIconCircle, { backgroundColor: "#EDE9FE" }]}>
                <Ionicons name="home" size={20} color="#7C3AED" />
              </View>
              <Text style={styles.suggestionPlaceText}>Adicione sua casa</Text>
              <Ionicons name="close" size={18} color="#94A3B8" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.suggestionPlaceRow}
              onPress={() => {
                setSearchQuery("UNAMA");
                setShowAddPlaceSearchModal(true);
              }}
            >
              <View style={[styles.suggestionIconCircle, { backgroundColor: "#EDE9FE" }]}>
                <Ionicons name="school" size={20} color="#7C3AED" />
              </View>
              <Text style={styles.suggestionPlaceText}>Adicione sua escola ou faculdade (UNAMA)</Text>
              <Ionicons name="close" size={18} color="#94A3B8" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.suggestionPlaceRow}
              onPress={() => {
                setSearchQuery("Hospital");
                setShowAddPlaceSearchModal(true);
              }}
            >
              <View style={[styles.suggestionIconCircle, { backgroundColor: "#EDE9FE" }]}>
                <Ionicons name="briefcase" size={20} color="#7C3AED" />
              </View>
              <Text style={styles.suggestionPlaceText}>Adicione seu trabalho ou clínica</Text>
              <Ionicons name="close" size={18} color="#94A3B8" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.suggestionPlaceRow}
              onPress={() => {
                setSearchQuery("Academia");
                setShowAddPlaceSearchModal(true);
              }}
            >
              <View style={[styles.suggestionIconCircle, { backgroundColor: "#EDE9FE" }]}>
                <Ionicons name="barbell" size={20} color="#7C3AED" />
              </View>
              <Text style={styles.suggestionPlaceText}>Adicione sua academia ou fisioterapia</Text>
              <Ionicons name="close" size={18} color="#94A3B8" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.suggestionPlaceRow}
              onPress={() => {
                setSearchQuery("Líder");
                setShowAddPlaceSearchModal(true);
              }}
            >
              <View style={[styles.suggestionIconCircle, { backgroundColor: "#EDE9FE" }]}>
                <Ionicons name="cart" size={20} color="#7C3AED" />
              </View>
              <Text style={styles.suggestionPlaceText}>Adicione seu supermercado ou farmácia</Text>
              <Ionicons name="close" size={18} color="#94A3B8" />
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ─────────────────────────────────────────────
          MODAL 2: ADICIONAR UM NOVO LOCAL - BUSCA (SCREENSHOT 3)
         ───────────────────────────────────────────── */}
      <Modal visible={showAddPlaceSearchModal} transparent={false} animationType="slide">
        <SafeAreaView style={styles.fullModalSafe}>
          {/* Header com ← e Título */}
          <View style={styles.fullModalHeader}>
            <TouchableOpacity
              onPress={() => setShowAddPlaceSearchModal(false)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="chevron-back" size={26} color="#0F172A" />
            </TouchableOpacity>
            <Text style={styles.fullModalHeaderTitle}>Adicionar um novo Local</Text>
            <View style={{ width: 26 }} />
          </View>

          {/* Campo de Busca (Screenshot 3) */}
          <View style={styles.searchBarWrapper}>
            <Ionicons name="search" size={18} color="#7C3AED" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchBarInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Pesquisar por endereço ou nome do local..."
              placeholderTextColor="#94A3B8"
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Ionicons name="close-circle" size={18} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          {/* Opção: Localizar no mapa */}
          <TouchableOpacity
            style={styles.locateOnMapRow}
            onPress={async () => {
              const coords = await getCurrentDeviceLocation();
              const lat = coords ? coords.lat : deviceCoords.lat;
              const lng = coords ? coords.lng : deviceCoords.lng;
              handleSelectSuggestedPlace({
                name: "Local do GPS Atual",
                address: "Coordenadas atuais em Belém - PA",
                icon: "location",
                lat,
                lng,
                radiusMeters: 100,
              });
            }}
          >
            <View style={styles.locateIconCircle}>
              <Ionicons name="locate" size={20} color="#7C3AED" />
            </View>
            <Text style={styles.locateOnMapText}>Localizar no mapa (GPS Atual)</Text>
          </TouchableOpacity>

          <View style={styles.suggestionsHeaderBox}>
            <Text style={styles.suggestionsHeaderText}>Sugestões de locais próximos</Text>
          </View>

          {/* Lista de Locais de Belém (Screenshot 3) */}
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            {filteredPlaces.map((place, idx) => (
              <TouchableOpacity
                key={`sug_${idx}`}
                style={styles.suggestionResultRow}
                onPress={() => handleSelectSuggestedPlace(place)}
                activeOpacity={0.7}
              >
                <View style={styles.suggestionResultPin}>
                  <Ionicons name="location" size={20} color="#7C3AED" />
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={styles.suggestionResultTitle}>{place.name}</Text>
                  <Text style={styles.suggestionResultAddress}>{place.address}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ─────────────────────────────────────────────
          MODAL 3: CONFIRMAÇÃO DE LOCAL ADICIONADO (SCREENSHOT 4)
         ───────────────────────────────────────────── */}
      <Modal visible={showAddedConfirmationModal} transparent animationType="fade">
        <View style={styles.confirmationModalOverlay}>
          <View style={styles.confirmationCard}>
            {/* Mini Mapa de Preview (Screenshot 4) */}
            <View style={styles.miniMapWindow}>
              {lastAddedPlace && (
                <MapView
                  style={StyleSheet.absoluteFill}
                  userInterfaceStyle="light"
                  initialRegion={{
                    latitude: lastAddedPlace.lat,
                    longitude: lastAddedPlace.lng,
                    latitudeDelta: 0.004,
                    longitudeDelta: 0.004,
                  }}
                  scrollEnabled={false}
                  zoomEnabled={false}
                  pitchEnabled={false}
                  rotateEnabled={false}
                >
                  <Circle
                    center={{ latitude: lastAddedPlace.lat, longitude: lastAddedPlace.lng }}
                    radius={lastAddedPlace.radiusMeters}
                    fillColor="rgba(124, 58, 237, 0.22)"
                    strokeColor="#7C3AED"
                    strokeWidth={2}
                  />
                  <Marker coordinate={{ latitude: lastAddedPlace.lat, longitude: lastAddedPlace.lng }}>
                    <View style={styles.miniMapPin}>
                      <Ionicons name="location" size={20} color="#7C3AED" />
                    </View>
                  </Marker>
                </MapView>
              )}
            </View>

            {/* Conteúdo: "[Nome] adicionado" (Screenshot 4) */}
            <View style={styles.confirmationContent}>
              <Text style={styles.confirmationTitle}>
                {lastAddedPlace?.name} adicionado
              </Text>
              <Text style={styles.confirmationSubtitle}>
                Você será notificado quando os membros do seu círculo chegarem a este local ou saírem dele.
              </Text>

              {/* Botão Entendi (Screenshot 4) */}
              <TouchableOpacity
                style={styles.btnUnderstand}
                onPress={handleConfirmAddPlace}
                activeOpacity={0.88}
              >
                <Text style={styles.btnUnderstandText}>Entendi</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─────────────────────────────────────────────
          MODAL 4: CONFIGURAÇÕES DO CUIDADOR ⚙️
         ───────────────────────────────────────────── */}
      <Modal visible={showSettingsModal} transparent animationType="slide">
        <View style={styles.sheetModalOverlay}>
          <View style={styles.sheetModalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalHeaderTitle}>Configurações do Cuidador</Text>
              <TouchableOpacity onPress={() => setShowSettingsModal(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.configSectionTitle}>CÍRCULO FAMILIAR</Text>
              <View style={styles.configInfoBox}>
                <Text style={styles.configInfoLabel}>Círculo Ativo:</Text>
                <Text style={styles.configInfoValue}>{circleDisplayName}</Text>
                <Text style={styles.configInfoLabel}>Código de Convite:</Text>
                <Text style={styles.configCodeText}>{circleCode}</Text>
              </View>

              <TouchableOpacity style={styles.btnShareCodeSmall} onPress={handleShareCode}>
                <Ionicons name="share-social" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.btnShareCodeSmallText}>Compartilhar Código</Text>
              </TouchableOpacity>

              <Text style={styles.configSectionTitle}>PERFIL DO IDOSO MONITORADO</Text>
              <View style={styles.configInfoBox}>
                <Text style={styles.configInfoLabel}>Nome:</Text>
                <Text style={styles.configInfoValue}>{seniorDisplayName}</Text>
                <Text style={styles.configInfoLabel}>Telefone de Socorro / Emergência:</Text>
                <TextInput
                  style={styles.configInput}
                  value={customEmergencyPhone}
                  onChangeText={setCustomEmergencyPhone}
                  placeholder="192 ou (91) 98888-0000"
                  placeholderTextColor="#94A3B8"
                  keyboardType="phone-pad"
                />
              </View>

              <Text style={styles.configSectionTitle}>PREFERÊNCIAS DE ALERTA</Text>
              <TouchableOpacity
                style={styles.toggleRow}
                onPress={() => setSoundAlertsEnabled(!soundAlertsEnabled)}
              >
                <Text style={styles.toggleRowText}>Sirene de Emergência Sonora</Text>
                <Ionicons
                  name={soundAlertsEnabled ? "toggle" : "toggle-outline"}
                  size={32}
                  color={soundAlertsEnabled ? "#7C3AED" : "#94A3B8"}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.toggleRow}
                onPress={() => setGeofenceAlertsEnabled(!geofenceAlertsEnabled)}
              >
                <Text style={styles.toggleRowText}>Avisos de Saída da Área Segura</Text>
                <Ionicons
                  name={geofenceAlertsEnabled ? "toggle" : "toggle-outline"}
                  size={32}
                  color={geofenceAlertsEnabled ? "#7C3AED" : "#94A3B8"}
                />
              </TouchableOpacity>

              {/* Botão de Desconectar / Trocar de Círculo */}
              <TouchableOpacity
                style={styles.btnExitCircleRed}
                onPress={() => {
                  setShowSettingsModal(false);
                  if (onReset) onReset();
                }}
              >
                <Ionicons name="log-out-outline" size={18} color="#DC2626" style={{ marginRight: 6 }} />
                <Text style={styles.btnExitCircleRedText}>Trocar de Círculo / Desconectar</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─────────────────────────────────────────────
          MODAL 5: CÍRCULO FAMILIAR ⌵ (MEMBROS E CONVITE)
         ───────────────────────────────────────────── */}
      <Modal visible={showCircleModal} transparent animationType="slide">
        <View style={styles.sheetModalOverlay}>
          <View style={styles.sheetModalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalHeaderTitle}>{circleDisplayName}</Text>
              <TouchableOpacity onPress={() => setShowCircleModal(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.circleModalSub}>
              Membros conectados transmitindo localização e status em tempo real:
            </Text>

            {/* Membro 1: Larissa (Idoso) */}
            <View style={styles.circleMemberRow}>
              <View style={styles.circleMemberAvatar}>
                <Text style={styles.circleMemberAvatarText}>
                  {seniorDisplayName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.circleMemberName}>{seniorDisplayName}</Text>
                <Text style={styles.circleMemberRole}>
                  Idoso monitorado • Bateria: {batteryLevel}%
                </Text>
              </View>
              <View style={styles.circleOnlineTag}>
                <View style={styles.circleOnlineDot} />
                <Text style={styles.circleOnlineText}>Ao Vivo</Text>
              </View>
            </View>

            {/* Membro 2: Gabriel (Cuidador) */}
            <View style={styles.circleMemberRow}>
              <View style={[styles.circleMemberAvatar, { backgroundColor: "#0F172A" }]}>
                <Text style={styles.circleMemberAvatarText}>
                  {caregiverDisplayName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.circleMemberName}>{caregiverDisplayName}</Text>
                <Text style={styles.circleMemberRole}>Cuidador Principal • Administrador</Text>
              </View>
            </View>

            <View style={styles.circleCodeBoxBig}>
              <Text style={styles.circleCodeBoxLabel}>CÓDIGO DE CONVITE DO CÍRCULO</Text>
              <Text style={styles.circleCodeBoxCode}>{circleCode}</Text>
            </View>

            <TouchableOpacity style={styles.btnShareCodeFull} onPress={handleShareCode}>
              <Ionicons name="share-social" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.btnShareCodeFullText}>Convidar Membro para o Círculo</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─────────────────────────────────────────────
          MODAL 6: CENTRAL DE NOTIFICAÇÕES 🔔
         ───────────────────────────────────────────── */}
      <Modal visible={showNotificationCenter} transparent animationType="slide">
        <View style={styles.sheetModalOverlay}>
          <View style={styles.sheetModalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalHeaderTitle}>Notificações Recentes</Text>
              <TouchableOpacity onPress={() => setShowNotificationCenter(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.notificationItem}>
                <View style={[styles.notificationIconBox, { backgroundColor: "#EDE9FE" }]}>
                  <Ionicons name="location" size={18} color="#7C3AED" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.notificationItemTitle}>{seniorDisplayName} chegou em Casa</Text>
                  <Text style={styles.notificationItemSub}>Entrou na cerca virtual de 100m • Há 15 minutos</Text>
                </View>
              </View>

              <View style={styles.notificationItem}>
                <View style={[styles.notificationIconBox, { backgroundColor: "#FEF2F2" }]}>
                  <Ionicons name="battery-dead" size={18} color="#DC2626" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.notificationItemTitle}>Bateria do Idoso em {batteryLevel}%</Text>
                  <Text style={styles.notificationItemSub}>Lembre o idoso de colocar o celular no carregador.</Text>
                </View>
              </View>

              <View style={styles.notificationItem}>
                <View style={[styles.notificationIconBox, { backgroundColor: "#DCFCE7" }]}>
                  <Ionicons name="checkmark-circle" size={18} color="#16A34A" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.notificationItemTitle}>Check-in Realizado</Text>
                  <Text style={styles.notificationItemSub}>Cuidador {caregiverDisplayName} confirmou presença.</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.btnDismissNotifications}
                onPress={() => setShowNotificationCenter(false)}
              >
                <Text style={styles.btnDismissNotificationsText}>Fechar</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─────────────────────────────────────────────
          MODAL 7: CONFIGURAR O SOS 🛟
         ───────────────────────────────────────────── */}
      <Modal visible={showSOSModal} transparent animationType="slide">
        <View style={styles.sheetModalOverlay}>
          <View style={styles.sheetModalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalHeaderTitle}>Configurar o SOS de Emergência</Text>
              <TouchableOpacity onPress={() => setShowSOSModal(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.circleModalSub}>
              Em caso de queda ou acionamento do botão de pânico pelo idoso, o alarme tocará no volume máximo e ligará para este contato:
            </Text>

            <Text style={styles.configInfoLabel}>Número de Socorro / SAMU:</Text>
            <TextInput
              style={styles.configInput}
              value={customEmergencyPhone}
              onChangeText={setCustomEmergencyPhone}
              placeholder="192 ou telefone do familiar"
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
            />

            <TouchableOpacity
              style={styles.btnTestSOS}
              onPress={() => {
                setShowSOSModal(false);
                syncService.triggerEmergency("sos", 3.0);
              }}
            >
              <Ionicons name="warning" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.btnTestSOSText}>Testar Disparo da Sirene de Socorro</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btnDismissNotifications, { marginTop: 10 }]}
              onPress={() => setShowSOSModal(false)}
            >
              <Text style={styles.btnDismissNotificationsText}>Salvar e Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─────────────────────────────────────────────
          MODAL DE EMERGÊNCIA EM TELA CHEIA (SOS)
         ───────────────────────────────────────────── */}
      <Modal visible={isEmergencyActive} transparent={false} animationType="slide">
        <SafeAreaView style={styles.emergencyFullScreen}>
          <View style={styles.emergencyFullContent}>
            <View style={styles.emergencyAlertIconBox}>
              <Ionicons name="notifications" size={54} color="#FFFFFF" />
            </View>

            <Text style={styles.emergencyFullTitle}>PEDIDO DE SOCORRO!</Text>
            <Text style={styles.emergencyFullSeniorName}>{seniorDisplayName}</Text>
            <Text style={styles.emergencyFullSub}>
              Alerta de emergência acionado no celular do idoso às {lastHeartbeat || "agora"}.
            </Text>

            <View style={styles.emergencyLocationBox}>
              <Ionicons name="location" size={16} color="#FCA5A5" style={{ marginRight: 6 }} />
              <Text style={styles.emergencyLocationText}>
                {currentPlaceName || "Localização transmitida ao vivo no mapa"}
              </Text>
            </View>

            <View style={styles.emergencyFullActions}>
              <TouchableOpacity
                style={styles.btnCallSeniorEmergencyFull}
                onPress={handleCallSenior}
                activeOpacity={0.88}
              >
                <Ionicons name="call" size={20} color="#991B1B" style={{ marginRight: 8 }} />
                <Text style={styles.btnCallSeniorEmergencyFullText}>
                  LIGAR PARA {seniorDisplayName.toUpperCase()}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.btnDismissEmergencyFull}
                onPress={handleDismissEmergency}
                activeOpacity={0.85}
              >
                <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.btnDismissEmergencyFullText}>
                  Silenciar / Confirmar Atendimento
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A",
  },

  // ─── TOP BAR FLUTUANTE ───
  topBarSafe: {
    position: "absolute",
    top: Platform.OS === "android" ? 38 : 10,
    left: 16,
    right: 16,
    zIndex: 10,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 4,
  },
  badgeCount: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: "#EF4444",
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeCountText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
  circlePill: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: SCREEN_WIDTH * 0.65,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 4,
  },
  circlePillText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1E1B4B",
  },

  // ─── PIN DO IDOSO NO MAPA ───
  seniorMarkerWrapper: {
    alignItems: "center",
  },
  speechBubble: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  speechBubbleAlert: {
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#DC2626",
  },
  speechBubbleText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1E1B4B",
  },
  speechBubbleTextAlert: {
    color: "#DC2626",
  },
  speechBeak: {
    width: 0,
    height: 0,
    backgroundColor: "transparent",
    borderStyle: "solid",
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 6,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#FFFFFF",
    marginBottom: 4,
  },
  speechBeakAlert: {
    borderTopColor: "#DC2626",
  },
  avatarGroup: {
    position: "relative",
  },
  seniorAvatarPin: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#7C3AED",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  seniorAvatarPinEmergency: {
    backgroundColor: "#DC2626",
    borderColor: "#FCA5A5",
  },
  seniorAvatarPinLetter: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },
  caregiverMiniBadge: {
    position: "absolute",
    bottom: -2,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#A78BFA",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  caregiverMiniBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
  caregiverMarker: {
    backgroundColor: "#1E1B4B",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  caregiverMarkerText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  placeMarkerPin: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#7C3AED",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },

  // ─── BOTÕES FLUTUANTES SOBRE O MAPA ───
  mapActionRow: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    zIndex: 9,
  },
  mapActionLeftPills: {
    flexDirection: "row",
    gap: 8,
  },
  floatingPill: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  floatingPillEmergency: {
    borderWidth: 1.5,
    borderColor: "#DC2626",
  },
  floatingPillText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E1B4B",
  },
  mapActionRightBtns: {
    gap: 10,
  },
  mapFabBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },

  // ─── BOTTOM SHEET DO MOVA ───
  bottomSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 12,
    paddingTop: 8,
  },
  bottomSheetComfortable: {
    height: 360,
  },
  bottomSheetFull: {
    height: SCREEN_HEIGHT * 0.82,
  },
  sheetHandleWrapper: {
    paddingVertical: 6,
    alignItems: "center",
  },
  sheetHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#CBD5E1",
  },
  handleExpandIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  handleExpandText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
  },

  // ─── BARRA DE ABAS DO PAINEL ───
  sheetTabBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  sheetTabItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 5,
  },
  sheetTabItemActive: {
    backgroundColor: "#EDE9FE",
  },
  sheetTabText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
  },
  sheetTabTextActive: {
    color: "#7C3AED",
    fontWeight: "700",
  },

  sheetScrollView: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  sheetScrollContent: {
    paddingBottom: 40,
  },

  // ─── CARD ILUSTRADO DOS LOCAIS (SCREENSHOT 1) ───
  placesPromoCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 22,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 16,
  },
  promoIconsRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 12,
  },
  promoIconSquare: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: "#EDE9FE",
    alignItems: "center",
    justifyContent: "center",
  },
  promoCardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "center",
    marginBottom: 6,
  },
  promoCardSubtitle: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 16,
    paddingHorizontal: 10,
  },
  btnManagePlaces: {
    backgroundColor: "#E2E8F0",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 16,
    width: "100%",
    alignItems: "center",
  },
  btnManagePlacesText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
  },

  sectionTitleSmall: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 10,
  },
  placeActiveItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  placeActivePinIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#EDE9FE",
    alignItems: "center",
    justifyContent: "center",
  },
  placeActiveName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
  },
  placeActiveAddress: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  placeFocusBtn: {
    padding: 8,
  },

  // ─── CARD DO IDOSO ───
  memberCardBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 20,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  memberAvatarContainer: {
    position: "relative",
  },
  memberAvatarCircle: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: "#7C3AED",
    alignItems: "center",
    justifyContent: "center",
  },
  memberAvatarCircleText: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
  },
  batteryPillBadge: {
    position: "absolute",
    bottom: -6,
    left: 4,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  batteryPillBadgeLow: {
    borderColor: "#DC2626",
    backgroundColor: "#FEF2F2",
  },
  batteryPillBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#16A34A",
  },
  batteryPillBadgeTextLow: {
    color: "#DC2626",
  },
  memberInfoCol: {
    flex: 1,
    marginLeft: 14,
  },
  memberFullName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  memberStatusLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#16A34A",
    marginTop: 2,
  },
  memberStatusLabelAlert: {
    color: "#DC2626",
  },
  memberSinceLabel: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  memberCallCircleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#EDE9FE",
    alignItems: "center",
    justifyContent: "center",
  },
  btnBigCallSenior: {
    backgroundColor: "#7C3AED",
    borderRadius: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  btnBigCallSeniorText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  btnQuickAddPlace: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F5F3FF",
    borderWidth: 1,
    borderColor: "#DDD6FE",
    borderRadius: 16,
    paddingVertical: 12,
    marginTop: 10,
  },
  btnQuickAddPlaceText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#7C3AED",
  },

  // ─── HISTÓRICO ───
  historyCardItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  historyEventText: {
    fontSize: 13,
    color: "#1E293B",
  },
  historyEventDate: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 2,
  },
  emptyHistoryBox: {
    alignItems: "center",
    paddingVertical: 24,
  },
  emptyHistoryText: {
    fontSize: 13,
    color: "#94A3B8",
    marginTop: 8,
  },

  // ─── TESTES ───
  demoCardBox: {
    backgroundColor: "#F5F3FF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#DDD6FE",
  },
  demoHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  demoHeaderTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#6D28D9",
    marginLeft: 6,
  },
  demoHeaderSub: {
    fontSize: 12,
    color: "#7C3AED",
    marginBottom: 12,
    lineHeight: 16,
  },
  demoButtonsStack: {
    gap: 8,
  },
  demoActionButton: {
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  demoActionButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },

  // ─── FULLSCREEN MODAL (GERENCIAR LOCAIS / SCREENSHOT 2) ───
  fullModalSafe: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  fullModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  fullModalHeaderTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
  },
  btnAddPlaceTopRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  purplePlusCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#7C3AED",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  btnAddPlaceTopText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#7C3AED",
  },
  dividerLine: {
    height: 1,
    backgroundColor: "#F1F5F9",
  },
  savedPlaceRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F8FAFC",
  },
  savedPlacePinCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F5F3FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  savedPlaceName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    flex: 1,
  },
  savedPlaceActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  suggestionPlaceRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F8FAFC",
  },
  suggestionIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  suggestionPlaceText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0F172A",
    flex: 1,
  },

  // ─── BUSCA DE LOCAIS (SCREENSHOT 3) ───
  searchBarWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    marginHorizontal: 20,
    marginVertical: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchBarInput: {
    flex: 1,
    fontSize: 14,
    color: "#0F172A",
  },
  locateOnMapRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  locateIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F5F3FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  locateOnMapText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  suggestionsHeaderBox: {
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  suggestionsHeaderText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#94A3B8",
  },
  suggestionResultRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  suggestionResultPin: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F5F3FF",
    alignItems: "center",
    justifyContent: "center",
  },
  suggestionResultTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  suggestionResultAddress: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },

  // ─── CONFIRMAÇÃO DE LOCAL ADICIONADO (SCREENSHOT 4) ───
  confirmationModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  confirmationCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    width: "100%",
    maxWidth: 360,
    overflow: "hidden",
  },
  miniMapWindow: {
    height: 160,
    width: "100%",
    backgroundColor: "#F1F5F9",
  },
  miniMapPin: {
    alignItems: "center",
    justifyContent: "center",
  },
  confirmationContent: {
    padding: 20,
    alignItems: "center",
  },
  confirmationTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1E1B4B",
    textAlign: "center",
    marginBottom: 8,
  },
  confirmationSubtitle: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  btnUnderstand: {
    backgroundColor: "#7C3AED",
    width: "100%",
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
  },
  btnUnderstandText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },

  // ─── MODAIS SECUNDÁRIOS ───
  sheetModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheetModalCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    maxHeight: SCREEN_HEIGHT * 0.75,
  },
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
  },
  configSectionTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#94A3B8",
    letterSpacing: 1,
    marginTop: 14,
    marginBottom: 6,
  },
  configInfoBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  configInfoLabel: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 4,
  },
  configInfoValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 6,
  },
  configCodeText: {
    fontSize: 20,
    fontWeight: "900",
    color: "#7C3AED",
    letterSpacing: 2,
    marginTop: 2,
  },
  configInput: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: "#0F172A",
    marginTop: 4,
  },
  btnShareCodeSmall: {
    backgroundColor: "#7C3AED",
    borderRadius: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  btnShareCodeSmallText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    padding: 14,
    borderRadius: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  toggleRowText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
  },
  btnExitCircleRed: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEF2F2",
    borderRadius: 14,
    paddingVertical: 12,
    marginTop: 20,
    marginBottom: 20,
  },
  btnExitCircleRedText: {
    color: "#DC2626",
    fontSize: 13,
    fontWeight: "700",
  },

  // ─── CÍRCULO MODAL ───
  circleModalSub: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 18,
    marginBottom: 14,
  },
  circleMemberRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  circleMemberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: "#7C3AED",
    alignItems: "center",
    justifyContent: "center",
  },
  circleMemberAvatarText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },
  circleMemberName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  circleMemberRole: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  circleOnlineTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  circleOnlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#16A34A",
    marginRight: 4,
  },
  circleOnlineText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#16A34A",
  },
  circleCodeBoxBig: {
    backgroundColor: "#F5F3FF",
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#7C3AED",
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 10,
    marginBottom: 12,
  },
  circleCodeBoxLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6D28D9",
    letterSpacing: 1,
    marginBottom: 4,
  },
  circleCodeBoxCode: {
    fontSize: 26,
    fontWeight: "900",
    color: "#5B21B6",
    letterSpacing: 3,
  },
  btnShareCodeFull: {
    backgroundColor: "#7C3AED",
    borderRadius: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  btnShareCodeFullText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },

  // ─── NOTIFICAÇÕES ───
  notificationItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  notificationIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  notificationItemTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
  },
  notificationItemSub: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  btnDismissNotifications: {
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 10,
  },
  btnDismissNotificationsText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#64748B",
  },

  // ─── SOS MODAL ───
  btnTestSOS: {
    backgroundColor: "#DC2626",
    borderRadius: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },
  btnTestSOSText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },

  // ─── EMERGÊNCIA TELA CHEIA ───
  emergencyFullScreen: {
    flex: 1,
    backgroundColor: "#991B1B",
    justifyContent: "center",
  },
  emergencyFullContent: {
    alignItems: "center",
    paddingHorizontal: 24,
  },
  emergencyAlertIconBox: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emergencyFullTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 1,
  },
  emergencyFullSeniorName: {
    color: "#FECACA",
    fontSize: 20,
    fontWeight: "800",
    marginTop: 4,
  },
  emergencyFullSub: {
    color: "#FEE2E2",
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 16,
  },
  emergencyLocationBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.25)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    marginBottom: 24,
  },
  emergencyLocationText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  emergencyFullActions: {
    width: "100%",
    gap: 12,
  },
  btnCallSeniorEmergencyFull: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  btnCallSeniorEmergencyFullText: {
    color: "#991B1B",
    fontSize: 15,
    fontWeight: "800",
  },
  btnDismissEmergencyFull: {
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  btnDismissEmergencyFullText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },

  // ─── REDE DE APOIO COMUNITÁRIA ───
  networkHeaderCard: {
    backgroundColor: "#F5F3FF",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#DDD6FE",
  },
  networkHeaderIconRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  networkHeaderTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#4C1D95",
    marginBottom: 2,
  },
  networkHeaderSub: {
    fontSize: 12,
    color: "#6D28D9",
    lineHeight: 17,
  },
  networkAlertsBadgeRow: {
    marginBottom: 10,
    flexDirection: "row",
  },
  networkAlertsBadge: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  networkAlertsBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#DC2626",
  },
  networkEmptyBox: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 8,
  },
  networkEmptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#16A34A",
  },
  networkEmptyText: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
  },
  networkAlertCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  networkAlertCardFound: {
    opacity: 0.6,
    borderColor: "#BBF7D0",
    backgroundColor: "#F0FDF4",
  },
  networkAlertHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  networkAlertTypeTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  networkAlertTypeTagHelp: {
    backgroundColor: "#FFFBEB",
    borderColor: "#FDE68A",
  },
  networkAlertTypeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#DC2626",
    letterSpacing: 0.5,
  },
  networkAlertTypeTextHelp: {
    color: "#D97706",
  },
  networkStatusTag: {
    backgroundColor: "#FEF2F2",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  networkStatusTagFound: {
    backgroundColor: "#DCFCE7",
  },
  networkStatusText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#DC2626",
  },
  networkStatusTextFound: {
    color: "#16A34A",
  },
  networkAlertBody: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  networkAlertAvatarWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#E2E8F0",
  },
  networkAlertAvatar: {
    fontSize: 26,
  },
  networkAlertName: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 3,
  },
  networkAlertDesc: {
    fontSize: 12,
    color: "#475569",
    lineHeight: 17,
  },
  networkAlertLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 3,
  },
  networkAlertLocation: {
    fontSize: 12,
    color: "#64748B",
    flex: 1,
  },
  networkAlertTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  networkAlertTime: {
    fontSize: 12,
    color: "#64748B",
  },
  networkCallBtn: {
    backgroundColor: "#7C3AED",
    borderRadius: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  networkCallBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});
