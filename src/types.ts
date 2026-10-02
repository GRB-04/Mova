// ─────────────────────────────────────────────
// MOVA — Tipos Globais Compartilhados (Inspirado no Life360)
// ─────────────────────────────────────────────

export type UserRole = "senior" | "caregiver";

export interface AccelData {
  x: number;
  y: number;
  z: number;
}

export type EventStatus =
  | "confirmado_bem"
  | "socorro_solicitado"
  | "sem_resposta"
  | "sos_manual"
  | "chegada_lugar"
  | "saida_lugar"
  | "bateria_baixa";

export type EventType = "queda" | "zona_segura" | "sos" | "bateria";

export interface EventRecord {
  id: number;
  time: string;
  type: EventType;
  magnitude?: number;
  status: EventStatus;
  description: string;
}

export interface SafePlace {
  id: string;
  name: string;
  icon: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  address: string;
}

export interface CaregiverProfile {
  name: string;
  roleInCircle: string;
  circleName: string;
  phone?: string;
}

export interface SeniorProfile {
  name: string;
  avatarEmoji: string;
  emergencyPhone: string;
  relationship?: string;
  notes?: string;
}

export interface CommunityAlert {
  id: string;
  type: "senior_lost" | "emergency_help";
  title: string;
  name: string;
  description: string;
  lastSeenLocation: string;
  lastSeenTime: string;
  contactPhone: string;
  radiusKm: number;
  status: "searching" | "found";
  avatarEmoji?: string;
}

export interface MovaGlobalState {
  isMonitoring: boolean;
  isFallActive: boolean;
  isEmergencyActive: boolean;
  emergencyReason: "ajuda" | "timeout" | "sos" | "geofence";
  lastFallMagnitude: number;
  emergencyTimestamp?: number;
  dismissedEmergencyTimestamp?: number;

  // Cadastro do Cuidador & Círculo
  caregiverProfile: CaregiverProfile;
  isOnboardingCompleted: boolean;

  // Perfil Real do Idoso Monitorado (Life360)
  seniorProfile: SeniorProfile;

  // Bateria do Idoso (visível para o cuidador)
  batteryLevel: number; // 0 a 100
  isCharging: boolean;

  // Monitoramento de Lugares Confiáveis (Life360)
  currentPlaceId: string | null; // ID do lugar atual ou null se em trânsito
  currentPlaceName: string; // Ex: "Casa do Idoso" ou "Em trânsito / Rua"
  placeSinceText: string; // Ex: "Está aqui há 1 d, 4 h" ou "Saiu há 25 min"
  timeOutOfPlaceMinutes: number; // Minutos fora de locais seguros
  isOutOfSafePlace: boolean;
  safePlaces: SafePlace[];

  // Rede de Proteção Comunitária (Alertas de Idosos Desorientados & Pets)
  communityAlerts: CommunityAlert[];

  // Código do Círculo Familiar (Life360) e Coordenadas Reais do Idoso
  circleCode: string;
  seniorCoords?: { lat: number; lng: number };

  events: EventRecord[];
  lastHeartbeat: string;
}

