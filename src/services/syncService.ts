import * as Battery from "expo-battery";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MovaGlobalState, EventRecord, SafePlace, SeniorProfile, CaregiverProfile } from "../types";
import { DEFAULT_SAFE_PLACES, EXAMPLE_PLACES, calculateDistanceMeters } from "./locationService";
import { notificationService } from "./notificationService";

// Servidores públicos e de alta disponibilidade do ntfy
const CLOUD_SERVERS = [
  "https://ntfy.tedomum.fr",
  "https://ntfy.envs.net",
];

// ID único por instância do app para evitar que um dispositivo processe
// suas próprias mensagens enviadas
const DEVICE_ID = `mova_${Math.random().toString(36).slice(2, 9)}_${Date.now()}`;

type StateListener = (state: MovaGlobalState) => void;

class SyncManager {
  private state: MovaGlobalState;
  private listeners: Set<StateListener> = new Set();
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private batteryInterval: ReturnType<typeof setInterval> | null = null;
  private lastProcessedMsgId = "";
  private processedMsgIds = new Set<string>();
  private lastNotifiedEmergencyTimestamp = Date.now();
  private lastDismissedEmergencyTimestamp = 0;
  private ws: WebSocket | null = null;
  private wsReconnectTimer: any = null;

  constructor() {
    this.state = {
      isMonitoring: true,
      isFallActive: false,
      isEmergencyActive: false,
      emergencyReason: "ajuda",
      lastFallMagnitude: 0,

      // Cadastro do Cuidador & Círculo
      caregiverProfile: {
        name: "Gabriel Rodrigues Bezerra",
        roleInCircle: "Filho / Filha",
        circleName: "Família Rodrigues Bezerra",
        phone: "(91) 98888-0000",
      },
      isOnboardingCompleted: false,

      // Perfil Real do Idoso Monitorado (Life360)
      seniorProfile: {
        name: "",
        avatarEmoji: "",
        emergencyPhone: "192",
        relationship: "Familiar",
        notes: "",
      },

      // Bateria lida do dispositivo real (inicia em 0 até leitura real)
      batteryLevel: 0,
      isCharging: false,

      // Lugares Confiáveis (definidos manualmente pelo cuidador)
      currentPlaceId: null,
      currentPlaceName: "Aguardando cadastro de área segura",
      placeSinceText: "Nenhum local cadastrado",
      timeOutOfPlaceMinutes: 0,
      isOutOfSafePlace: false,
      safePlaces: DEFAULT_SAFE_PLACES,

      // Rede de Proteção Local (Alertas de Idosos Desorientados na Vizinhança - Raio de 5 km)
      communityAlerts: [
        {
          id: "alert_1",
          type: "senior_lost",
          title: "ALERTA PRATA: Idoso Desorientado",
          name: "Sr. Manoel Silva (78 anos)",
          description: "Saiu de casa desorientado. Camisa azul polo e calça bege. Portador de lapsos de memória.",
          lastSeenLocation: "Av. Almirante Barroso, próximo ao Bosque (Belém)",
          lastSeenTime: "Hoje às 16:20",
          contactPhone: "(91) 98122-3344",
          radiusKm: 5,
          status: "searching",
          avatarEmoji: "👴",
        },
        {
          id: "alert_2",
          type: "emergency_help",
          title: "APOIO EMERGENCIAL DE VIZINHANÇA",
          name: "Dona Maria Antônia (82 anos)",
          description: "Cuidadora solicitou acompanhamento temporário. Idosa em cadeira de rodas.",
          lastSeenLocation: "Rua do Utinga, Marco (Belém)",
          lastSeenTime: "Hoje às 15:45",
          contactPhone: "(91) 98877-6655",
          radiusKm: 3,
          status: "searching",
          avatarEmoji: "👵",
        },
      ],

      // Código do Círculo Familiar (Life360)
      circleCode: "2AD-PLG",
      seniorCoords: undefined,

      events: [],
      lastHeartbeat: new Date().toLocaleTimeString("pt-BR"),
    };

    this.initSavedProfile();
    this.initBattery();
    this.startCloudListening();
  }

  private async initSavedProfile() {
    try {
      const saved = await AsyncStorage.getItem("@mova_senior_profile");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.name) {
          this.state.seniorProfile = {
            ...this.state.seniorProfile,
            ...parsed,
          };
          this.notifyLocal();
        }
      }
    } catch {
      // Ignora erro de leitura inicial
    }
  }

  private getCloudTopic(): string {
    const clean = (this.state.circleCode || "2AD-PLG").toLowerCase().replace(/[^a-z0-9]/g, "");
    return `mova_circle_${clean || "2adplg"}`;
  }

  public getState(): MovaGlobalState {
    return this.state;
  }

  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public updateState(partial: Partial<MovaGlobalState>, broadcastCloud = true) {
    this.state = {
      ...this.state,
      ...partial,
      lastHeartbeat: new Date().toLocaleTimeString("pt-BR"),
    };
    this.notifyLocal();

    if (broadcastCloud) {
      this.sendToCloud(partial);
    }
  }

  public addEvent(event: EventRecord) {
    const updatedEvents = [event, ...this.state.events].slice(0, 25);
    this.updateState({ events: updatedEvents }, true);
  }

  public triggerEmergency(reason: "sos" | "ajuda" | "timeout" | "geofence" = "sos", magnitude?: number) {
    const ts = Date.now();
    const newEvent: EventRecord = {
      id: ts,
      time: new Date(ts).toLocaleTimeString("pt-BR"),
      type: "sos",
      magnitude,
      status: "sos_manual",
      description:
        reason === "sos"
          ? "Botão SOS de pânico acionado pelo idoso."
          : reason === "ajuda"
          ? "Pedido de ajuda urgente solicitado pelo idoso."
          : "Alerta de emergência automático acionado.",
    };
    const updatedEvents = [newEvent, ...this.state.events].slice(0, 25);
    this.updateState(
      {
        isEmergencyActive: true,
        isFallActive: false,
        emergencyReason: reason,
        emergencyTimestamp: ts,
        events: updatedEvents,
      },
      true
    );
  }

  public dismissEmergency() {
    const dismissTs = Math.max(this.state.emergencyTimestamp || 0, Date.now());
    this.lastDismissedEmergencyTimestamp = dismissTs;
    this.lastNotifiedEmergencyTimestamp = dismissTs;

    this.updateState(
      {
        isEmergencyActive: false,
        isFallActive: false,
        emergencyTimestamp: 0,
        dismissedEmergencyTimestamp: dismissTs,
      },
      true
    );
  }

  // ─────────────────────────────────────────────
  // Gerenciamento de Perfil e Cadastro
  // ─────────────────────────────────────────────
  public updateProfile(profile: Partial<SeniorProfile>) {
    const updated = {
      ...this.state.seniorProfile,
      ...profile,
    };
    this.updateState({
      seniorProfile: updated,
    }, true);
    AsyncStorage.setItem("@mova_senior_profile", JSON.stringify(updated)).catch(() => {});
  }

  public updateCaregiverProfile(profile: Partial<CaregiverProfile>) {
    this.updateState({
      caregiverProfile: {
        ...this.state.caregiverProfile,
        ...profile,
      },
    });
  }

  public completeOnboarding() {
    this.updateState({
      isOnboardingCompleted: true,
    });
  }

  public resetOnboarding() {
    this.updateState({
      isOnboardingCompleted: false,
      safePlaces: [],
      currentPlaceId: null,
      currentPlaceName: "Aguardando cadastro de área segura",
      placeSinceText: "Nenhum local cadastrado",
      isOutOfSafePlace: false,
      timeOutOfPlaceMinutes: 0,
    });
  }

  // ─────────────────────────────────────────────
  // Gerenciamento Manual de Lugares Confiáveis
  // ─────────────────────────────────────────────
  public setHomePlace(lat: number, lng: number, address = "Localização atual (Belém - PA)") {
    const homePlace: SafePlace = {
      id: "place_casa",
      name: "Minha Casa",
      icon: "home",
      lat,
      lng,
      radiusMeters: 100,
      address,
    };
    const otherPlaces = this.state.safePlaces.filter((p) => p.id !== "place_casa" && p.name !== "Minha Casa");
    this.updateState({
      safePlaces: [homePlace, ...otherPlaces],
      currentPlaceId: homePlace.id,
      currentPlaceName: homePlace.name,
      placeSinceText: "Definido agora",
    }, true);
  }

  public setClassroomPlace(lat: number, lng: number, address = "Sala de Aula / Campus") {
    const classroomPlace: SafePlace = {
      id: "place_sala",
      name: "Sala de Aula",
      icon: "fitness",
      lat,
      lng,
      radiusMeters: 5, // Raio ultracurto (5m) para disparar com poucos passos até a porta
      address,
    };
    const otherPlaces = this.state.safePlaces.filter((p) => p.id !== "place_sala" && p.name !== "Sala de Aula");
    this.updateState({
      safePlaces: [classroomPlace, ...otherPlaces],
      currentPlaceId: classroomPlace.id,
      currentPlaceName: classroomPlace.name,
      placeSinceText: "Definido agora",
      isOutOfSafePlace: false,
    }, true);
  }
  public addCustomPlace(place: {
    name: string;
    icon: string;
    lat: number;
    lng: number;
    radiusMeters: number;
    address: string;
  }) {
    const newPlace: SafePlace = {
      id: "place_" + Date.now(),
      name: place.name,
      icon: place.icon,
      lat: place.lat,
      lng: place.lng,
      radiusMeters: place.radiusMeters,
      address: place.address,
    };

    const newEvents: EventRecord = {
      id: Date.now(),
      time: new Date().toLocaleTimeString("pt-BR"),
      type: "zona_segura",
      status: "chegada_lugar",
      description: `Área segura cadastrada: ${place.name} (Raio de ${place.radiusMeters}m).`,
    };

    const isFirst = this.state.safePlaces.length === 0;

    this.updateState({
      safePlaces: [...this.state.safePlaces, newPlace],
      currentPlaceId: isFirst ? newPlace.id : this.state.currentPlaceId,
      currentPlaceName: isFirst ? newPlace.name : this.state.currentPlaceName,
      placeSinceText: isFirst ? "Definido agora" : this.state.placeSinceText,
      events: [newEvents, ...this.state.events],
    });
  }

  public updatePlaceRadius(placeId: string, radiusMeters: number) {
    const updated = this.state.safePlaces.map((p) =>
      p.id === placeId ? { ...p, radiusMeters } : p
    );
    this.updateState({ safePlaces: updated });
  }

  public updatePlaceLocation(placeId: string, lat: number, lng: number, address: string) {
    const updated = this.state.safePlaces.map((p) =>
      p.id === placeId ? { ...p, lat, lng, address } : p
    );
    this.updateState({ safePlaces: updated });
  }

  public removeSafePlace(placeId: string) {
    const filtered = this.state.safePlaces.filter((p) => p.id !== placeId);
    const wasCurrent = this.state.currentPlaceId === placeId;

    this.updateState({
      safePlaces: filtered,
      currentPlaceId: wasCurrent ? (filtered.length > 0 ? filtered[0].id : null) : this.state.currentPlaceId,
      currentPlaceName: wasCurrent
        ? (filtered.length > 0 ? filtered[0].name : "Nenhum local cadastrado")
        : this.state.currentPlaceName,
    });
  }

  // ─────────────────────────────────────────────
  // Rede Comunitária (Idoso Desorientado & Pet)
  // ─────────────────────────────────────────────
  public addCommunityAlert(alert: Omit<import("../types").CommunityAlert, "id">) {
    const newAlert: import("../types").CommunityAlert = {
      ...alert,
      id: "alert_" + Date.now(),
    };
    this.updateState({
      communityAlerts: [newAlert, ...this.state.communityAlerts],
    }, true);
  }

  public resolveCommunityAlert(alertId: string) {
    const updated = this.state.communityAlerts.map((a) =>
      a.id === alertId ? { ...a, status: "found" as const } : a
    );
    this.updateState({ communityAlerts: updated }, true);
  }

  public loadExamplePlaces() {
    this.updateState({
      safePlaces: EXAMPLE_PLACES,
      currentPlaceId: EXAMPLE_PLACES[0].id,
      currentPlaceName: EXAMPLE_PLACES[0].name,
      placeSinceText: "Está aqui agora",
    });
  }

  public clearAllPlaces() {
    this.updateState({
      safePlaces: [],
      currentPlaceId: null,
      currentPlaceName: "Aguardando cadastro de área segura",
      placeSinceText: "Nenhum local cadastrado",
    });
  }

  // ─────────────────────────────────────────────
  // Verificação Real de Coordenadas GPS contra Lugares
  // ─────────────────────────────────────────────
  public checkLocationUpdate(lat: number, lng: number) {
    if (this.state.safePlaces.length === 0) return;

    let matchedPlace: SafePlace | null = null;

    for (const p of this.state.safePlaces) {
      const dist = calculateDistanceMeters(lat, lng, p.lat, p.lng);
      if (dist <= p.radiusMeters) {
        matchedPlace = p;
        break;
      }
    }

    if (matchedPlace) {
      if (this.state.currentPlaceId !== matchedPlace.id || this.state.isOutOfSafePlace) {
        // Chegou no lugar
        const seniorName = this.state.seniorProfile?.name?.trim() || "João";
        const desc = `${seniorName} chegou em ${matchedPlace.name}.`;
        this.addEvent({
          id: Date.now(),
          time: new Date().toLocaleTimeString("pt-BR"),
          type: "zona_segura",
          status: "chegada_lugar",
          description: desc,
        });

        notificationService.notifyPlaceEvent(matchedPlace.name, "chegada", seniorName);

        this.updateState({
          currentPlaceId: matchedPlace.id,
          currentPlaceName: matchedPlace.name,
          placeSinceText: "Chegou agora",
          isOutOfSafePlace: false,
          timeOutOfPlaceMinutes: 0,
        }, true);
      }
    } else {
      if (this.state.currentPlaceId !== null || !this.state.isOutOfSafePlace) {
        // Saiu do lugar
        const prevName = this.state.currentPlaceName || this.state.safePlaces[0]?.name || "Área Segura";
        const seniorName = this.state.seniorProfile?.name?.trim() || "João";
        const desc = `${seniorName} saiu de ${prevName}. Fora da área segura!`;
        this.addEvent({
          id: Date.now(),
          time: new Date().toLocaleTimeString("pt-BR"),
          type: "zona_segura",
          status: "saida_lugar",
          description: desc,
        });

        notificationService.notifyPlaceEvent(prevName, "saida", seniorName);

        this.updateState({
          currentPlaceId: null,
          currentPlaceName: `Fora de ${prevName}`,
          placeSinceText: `Saiu de ${prevName} há instantes`,
          isOutOfSafePlace: true,
          timeOutOfPlaceMinutes: 1,
        }, true);
      }
    }
  }

  // ─────────────────────────────────────────────
  // Monitoramento de Bateria Real
  // ─────────────────────────────────────────────
  private async initBattery() {
    try {
      const level = await Battery.getBatteryLevelAsync();
      const state = await Battery.getBatteryStateAsync();
      if (level >= 0) {
        const pct = Math.round(level * 100);
        const charging = state === Battery.BatteryState.CHARGING;
        this.updateState({ batteryLevel: pct, isCharging: charging }, false);
      }
    } catch {
      // Usa valor inicial se não disponível
    }

    this.batteryInterval = setInterval(async () => {
      try {
        const level = await Battery.getBatteryLevelAsync();
        const state = await Battery.getBatteryStateAsync();
        if (level >= 0) {
          const pct = Math.round(level * 100);
          const charging = state === Battery.BatteryState.CHARGING;
          if (pct !== this.state.batteryLevel || charging !== this.state.isCharging) {
            this.updateState({ batteryLevel: pct, isCharging: charging }, true);
            if (pct <= 15 && !charging) {
              this.addEvent({
                id: Date.now(),
                time: new Date().toLocaleTimeString("pt-BR"),
                type: "bateria",
                status: "bateria_baixa",
                description: `Bateria do idoso está em ${pct}% — Lembre o idoso de carregar!`,
              });
              notificationService.notifyLowBattery(pct);
            }
          }
        }
      } catch {
        // Ignora
      }
    }, 15000);
  }

  // ─────────────────────────────────────────────
  // Simulações Didáticas (Estilo Life360 para a Apresentação)
  // ─────────────────────────────────────────────

  public simulateArrivalAt(placeId: string) {
    const place = this.state.safePlaces.find((p) => p.id === placeId) || this.state.safePlaces[0];
    if (!place) return;

    const newEvent: EventRecord = {
      id: Date.now(),
      time: new Date().toLocaleTimeString("pt-BR"),
      type: "zona_segura",
      status: "chegada_lugar",
      description: `Chegou em ${place.name}.`,
    };
    this.addEvent(newEvent);
    notificationService.notifyPlaceEvent(place.name, "chegada");

    this.updateState({
      currentPlaceId: place.id,
      currentPlaceName: place.name,
      placeSinceText: "Chegou agora",
      isOutOfSafePlace: false,
      timeOutOfPlaceMinutes: 0,
    });
  }

  public simulateDepartureFromCurrent(minutesAgo = 25) {
    const previousName = this.state.currentPlaceName || "Casa do Idoso";
    const newEvent: EventRecord = {
      id: Date.now(),
      time: new Date().toLocaleTimeString("pt-BR"),
      type: "zona_segura",
      status: "saida_lugar",
      description: `Saiu de ${previousName}. Em trânsito há ${minutesAgo} min.`,
    };
    this.addEvent(newEvent);
    notificationService.notifyPlaceEvent(previousName, "saida", `há ${minutesAgo} min`);

    this.updateState({
      currentPlaceId: null,
      currentPlaceName: "Em trânsito / Rua",
      placeSinceText: `Saiu de ${previousName} há ${minutesAgo} min`,
      isOutOfSafePlace: true,
      timeOutOfPlaceMinutes: minutesAgo,
    });
  }

  public simulateLowBattery(level = 10) {
    const newEvent: EventRecord = {
      id: Date.now(),
      time: new Date().toLocaleTimeString("pt-BR"),
      type: "bateria",
      status: "bateria_baixa",
      description: `A bateria do idoso está em ${level}% — Lembre de carregar o aparelho!`,
    };
    this.addEvent(newEvent);
    notificationService.notifyLowBattery(level);

    this.updateState({
      batteryLevel: level,
      isCharging: false,
    });
  }

  public updateCircleCode(newCode: string) {
    const formatted = newCode.trim().toUpperCase();
    this.updateState({ circleCode: formatted }, false);
    this.restartCloudListening();
    // Envia estado atual de imediato para o novo círculo
    this.sendToCloud({
      circleCode: formatted,
      seniorProfile: this.state.seniorProfile,
      safePlaces: this.state.safePlaces,
      batteryLevel: this.state.batteryLevel,
    });
  }

  public updateSeniorGPS(lat: number, lng: number) {
    this.updateState({
      seniorCoords: { lat, lng },
    }, true);
    this.checkLocationUpdate(lat, lng);
  }

  private notifyLocal() {
    this.listeners.forEach((fn) => fn(this.state));
  }

  private async sendToCloud(data: Partial<MovaGlobalState>) {
    const envelope = JSON.stringify({
      type: "MOVA_SYNC",
      deviceId: DEVICE_ID,
      payload: data,
      timestamp: Date.now(),
    });
    const topic = this.getCloudTopic();

    // Envia para os servidores em paralelo com TTL de 12 horas
    await Promise.allSettled(
      CLOUD_SERVERS.map((server) =>
        fetch(`${server}/${topic}`, {
          method: "POST",
          body: envelope,
          headers: {
            "Content-Type": "text/plain",
            "X-TTL": "43200",
            "X-Priority": data.isEmergencyActive ? "5" : "3",
            "X-Title": data.isEmergencyActive ? "EMERGENCIA MOVA" : "MOVA SYNC",
          },
        })
      )
    );
  }

  public getLocationDisplayText(coords?: { lat: number; lng: number }): string {
    if (this.state.currentPlaceName && this.state.currentPlaceName !== "Aguardando cadastro de área segura") {
      return this.state.isOutOfSafePlace
        ? `Fora de ${this.state.currentPlaceName}`
        : `Em ${this.state.currentPlaceName}`;
    }
    return "Localização ao vivo no mapa";
  }

  public simulateLeavingClassroom() {
    const sala = this.state.safePlaces.find((p) => p.id === "place_sala") || this.state.safePlaces[0];
    const baseLat = sala ? sala.lat : (this.state.seniorCoords?.lat || -1.425);
    const baseLng = sala ? sala.lng : (this.state.seniorCoords?.lng || -48.455);
    const placeName = sala ? sala.name : "Sala de Aula";

    // 0.0001 graus é ~11m (mais que o dobro do raio de 5m da sala)
    const outsideLat = baseLat + 0.0001;
    const outsideLng = baseLng + 0.0001;

    const seniorName = this.state.seniorProfile?.name?.trim() || "João";
    const desc = `${seniorName} saiu de ${placeName}. Fora da área segura!`;

    const newEvent: EventRecord = {
      id: Date.now(),
      time: new Date().toLocaleTimeString("pt-BR"),
      type: "zona_segura",
      status: "saida_lugar",
      description: desc,
    };

    notificationService.notifyPlaceEvent(placeName, "saida", seniorName);

    this.updateState({
      seniorCoords: { lat: outsideLat, lng: outsideLng },
      currentPlaceId: null,
      currentPlaceName: `Fora de ${placeName}`,
      placeSinceText: `Saiu de ${placeName} há instantes`,
      isOutOfSafePlace: true,
      timeOutOfPlaceMinutes: 1,
      events: [newEvent, ...this.state.events].slice(0, 25),
    }, true);
  }

  public simulateReturningToClassroom() {
    const sala = this.state.safePlaces.find((p) => p.id === "place_sala") || this.state.safePlaces[0];
    const baseLat = sala ? sala.lat : (this.state.seniorCoords?.lat || -1.425);
    const baseLng = sala ? sala.lng : (this.state.seniorCoords?.lng || -48.455);
    const placeName = sala ? sala.name : "Sala de Aula";

    const seniorName = this.state.seniorProfile?.name?.trim() || "João";
    const desc = `${seniorName} retornou para ${placeName}.`;

    const newEvent: EventRecord = {
      id: Date.now(),
      time: new Date().toLocaleTimeString("pt-BR"),
      type: "zona_segura",
      status: "chegada_lugar",
      description: desc,
    };

    notificationService.notifyPlaceEvent(placeName, "chegada", seniorName);

    this.updateState({
      seniorCoords: { lat: baseLat, lng: baseLng },
      currentPlaceId: sala ? sala.id : "place_sala",
      currentPlaceName: placeName,
      placeSinceText: "Retornou agora",
      isOutOfSafePlace: false,
      timeOutOfPlaceMinutes: 0,
      events: [newEvent, ...this.state.events].slice(0, 25),
    }, true);
  }

  private processRawCloudMessage(raw: any): boolean {
    if (!raw?.id) return false;

    // Atualiza cursor mais recente
    this.lastProcessedMsgId = raw.id;

    // Desduplicação por ID
    if (this.processedMsgIds.has(raw.id)) return false;
    this.processedMsgIds.add(raw.id);
    if (this.processedMsgIds.size > 200) {
      const [first] = this.processedMsgIds;
      this.processedMsgIds.delete(first);
    }

    if (!raw?.message) return false;
    let msg: any = null;
    try {
      msg = JSON.parse(raw.message);
    } catch {
      return false;
    }

    if (
      msg?.type === "MOVA_SYNC" &&
      msg?.payload &&
      msg?.deviceId !== DEVICE_ID
    ) {
      const incoming = { ...msg.payload };

      // Tratamento de Alarme e Emergência
      if (incoming.isEmergencyActive) {
        const emTs = incoming.emergencyTimestamp || msg.timestamp || 0;

        // SE O ALARME JÁ FOI DESCARTADO OU SILENCIADO ANTERIORMENTE:
        if (emTs <= this.lastDismissedEmergencyTimestamp) {
          // Desativa o sinalizador para não reativar o alarme nem tocar som
          incoming.isEmergencyActive = false;
          incoming.emergencyTimestamp = 0;
        } else {
          // Alarme NOVO e RECENTE (< 30s)
          const isFresh = Math.abs(Date.now() - emTs) < 30000;
          if (isFresh && emTs > this.lastNotifiedEmergencyTimestamp) {
            this.lastNotifiedEmergencyTimestamp = emTs;
            const name = incoming.seniorProfile?.name || this.state.seniorProfile?.name || "João";
            const placeText = this.state.currentPlaceName ? `Em ${this.state.currentPlaceName}` : "Sala de Aula / Campus";
            notificationService.notifyEmergencyCaregiver(name, placeText);
          }
        }
      } else if (incoming.isEmergencyActive === false) {
        // Alarme cancelado pela outra ponta
        if (incoming.dismissedEmergencyTimestamp) {
          this.lastDismissedEmergencyTimestamp = Math.max(
            this.lastDismissedEmergencyTimestamp,
            incoming.dismissedEmergencyTimestamp
          );
        }
        notificationService.dismissAlerts();
      }

      // Se o idoso enviou coordenadas, recalcula área segura (geofencing)
      if (incoming.seniorCoords) {
        this.checkLocationUpdate(incoming.seniorCoords.lat, incoming.seniorCoords.lng);
      }

      this.state = {
        ...this.state,
        ...incoming,
        seniorProfile: incoming.seniorProfile
          ? {
              ...this.state.seniorProfile,
              ...incoming.seniorProfile,
            }
          : this.state.seniorProfile,
        lastHeartbeat: new Date().toLocaleTimeString("pt-BR"),
      };

      if (incoming.seniorProfile?.name) {
        AsyncStorage.setItem(
          "@mova_senior_profile",
          JSON.stringify(this.state.seniorProfile)
        ).catch(() => {});
      }

      return true;
    }

    return false;
  }

  private connectWebSocket() {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }

    try {
      const topic = this.getCloudTopic();
      const wsUrl = `wss://ntfy.sh/${topic}/ws`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onmessage = (event) => {
        try {
          if (!event?.data) return;
          const raw = JSON.parse(event.data);
          if (this.processRawCloudMessage(raw)) {
            this.notifyLocal();
          }
        } catch {}
      };

      this.ws.onerror = () => {};

      this.ws.onclose = () => {
        this.ws = null;
        if (!this.wsReconnectTimer) {
          this.wsReconnectTimer = setTimeout(() => {
            this.wsReconnectTimer = null;
            this.connectWebSocket();
          }, 2500);
        }
      };
    } catch {}
  }

  private startCloudListening() {
    this.connectWebSocket();

    this.pollInterval = setInterval(async () => {
      try {
        const topic = this.getCloudTopic();
        // Na primeira requisição, recupera apenas mensagens dos últimos 30 segundos
        const since = this.lastProcessedMsgId ? this.lastProcessedMsgId : (Math.floor(Date.now() / 1000) - 30);

        let lines: string[] = [];

        for (const server of CLOUD_SERVERS) {
          try {
            const url = `${server}/${topic}/json?poll=1&since=${since}`;
            const res = await fetch(url);
            if (res.ok) {
              const text = await res.text().catch(() => "");
              const parsed = text.trim().split("\n").filter(Boolean);
              if (parsed.length > 0) {
                lines = parsed;
                break;
              }
            }
          } catch {}
        }

        if (lines.length === 0) return;

        let stateChanged = false;
        for (const line of lines) {
          try {
            const raw = JSON.parse(line);
            if (this.processRawCloudMessage(raw)) {
              stateChanged = true;
            }
          } catch {}
        }

        if (stateChanged) {
          this.notifyLocal();
        }
      } catch {}
    }, 1500);
  }

  public restartCloudListening() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    this.lastProcessedMsgId = "";
    this.processedMsgIds.clear();
    this.startCloudListening();
  }

  public cleanup() {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    if (this.wsReconnectTimer) {
      clearTimeout(this.wsReconnectTimer);
      this.wsReconnectTimer = null;
    }
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    if (this.batteryInterval) {
      clearInterval(this.batteryInterval);
      this.batteryInterval = null;
    }
    this.listeners.clear();
  }
}

export const syncService = new SyncManager();
