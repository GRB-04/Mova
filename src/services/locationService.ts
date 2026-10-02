import * as Location from "expo-location";
import { SafePlace } from "../types";

// Lugar padrão inicial (Casa)
export const DEFAULT_SAFE_PLACES: SafePlace[] = [
  {
    id: "place_casa",
    name: "Casa",
    icon: "home",
    lat: -1.425,
    lng: -48.455,
    radiusMeters: 100,
    address: "Passagem Elvira, Belém - PA",
  },
];

export interface SuggestedPlace {
  name: string;
  address: string;
  icon: string;
  lat: number;
  lng: number;
  radiusMeters: number;
}

// Sugestões de locais reais de Belém (baseado na vizinhança e UNAMA)
export const SUGGESTED_BELEM_PLACES: SuggestedPlace[] = [
  {
    name: "UNAMA - Campus Alcindo Cacela",
    address: "Av. Alcindo Cacela, 287, Umarizal, Belém, PA",
    icon: "school",
    lat: -1.4428,
    lng: -48.4795,
    radiusMeters: 150,
  },
  {
    name: "Innovatec",
    address: "Passagem Elvira, 168, Belém, PA",
    icon: "business",
    lat: -1.4258,
    lng: -48.4552,
    radiusMeters: 80,
  },
  {
    name: "Studio e Estética Ana Barros",
    address: "Passagem Gaspar Dutra, 86, Belém, PA",
    icon: "fitness",
    lat: -1.4262,
    lng: -48.4545,
    radiusMeters: 80,
  },
  {
    name: "Graça Depil",
    address: "Passagem Elvira, 50, Belém, PA",
    icon: "business",
    lat: -1.4252,
    lng: -48.4555,
    radiusMeters: 80,
  },
  {
    name: "Laboratório de Bioquímica Campus II",
    address: "Passagem Matilde, 147, Belém, PA",
    icon: "medkit",
    lat: -1.4271,
    lng: -48.4538,
    radiusMeters: 100,
  },
  {
    name: "Hospital Porto Dias",
    address: "Av. Almirante Barroso, 1454, Marco, Belém, PA",
    icon: "medkit",
    lat: -1.4335,
    lng: -48.4628,
    radiusMeters: 150,
  },
  {
    name: "Supermercados Líder & Magazan",
    address: "Av. Almirante Barroso, Belém, PA",
    icon: "cart",
    lat: -1.4312,
    lng: -48.4655,
    radiusMeters: 120,
  },
  {
    name: "Barreira Tabacaria",
    address: "Passagem Gaspar Dutra, 58, Belém, PA",
    icon: "cart",
    lat: -1.4265,
    lng: -48.4542,
    radiusMeters: 60,
  },
  {
    name: "Pizza's da Glenda",
    address: "Passagem Elvira, 38, Belém, PA",
    icon: "restaurant",
    lat: -1.4249,
    lng: -48.4558,
    radiusMeters: 60,
  },
  {
    name: "Depósito da Priscila",
    address: "Passagem Gaspar Dutra, 44, Belém, PA",
    icon: "cart",
    lat: -1.4268,
    lng: -48.4540,
    radiusMeters: 60,
  },
];

export const EXAMPLE_PLACES: SafePlace[] = [
  {
    id: "ex_casa",
    name: "Casa",
    icon: "home",
    lat: -1.425,
    lng: -48.455,
    radiusMeters: 100,
    address: "Passagem Elvira, Belém - PA",
  },
];

/**
 * Fórmula de Haversine para calcular a distância exata em metros entre dois pontos geográficos
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Raio da Terra em metros
  const radLat1 = (lat1 * Math.PI) / 180;
  const radLat2 = (lat2 * Math.PI) / 180;
  const deltaLat = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(radLat1) * Math.cos(radLat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

/**
 * Verifica em qual lugar confiável as coordenadas se encontram
 */
export function findMatchingSafePlace(
  lat: number,
  lng: number,
  places: SafePlace[]
): SafePlace | null {
  for (const place of places) {
    const dist = calculateDistanceMeters(lat, lng, place.lat, place.lng);
    if (dist <= place.radiusMeters) {
      return place;
    }
  }
  return null;
}

/**
 * Solicita permissão de GPS e obtém as coordenadas atuais com proteção contra travamento (timeout)
 */
export async function getCurrentDeviceLocation(): Promise<{ lat: number; lng: number } | null> {
  try {
    const { status: existingStatus } = await Location.getForegroundPermissionsAsync();
    let finalStatus = existingStatus;

    if (finalStatus !== "granted") {
      const permissionResponse = await Location.requestForegroundPermissionsAsync();
      finalStatus = permissionResponse.status;
    }

    if (finalStatus !== "granted") {
      return null;
    }

    const locationPromise = Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000));

    const result = await Promise.race([locationPromise, timeoutPromise]);
    if (result && "coords" in result) {
      return {
        lat: result.coords.latitude,
        lng: result.coords.longitude,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Monitoramento contínuo em tempo real (atualiza a cada 1 metro deslocado para detectar poucos passos)
 */
export async function startWatchingLocation(
  onLocation: (coords: { lat: number; lng: number }) => void
): Promise<(() => void) | null> {
  try {
    const { status: existingStatus } = await Location.getForegroundPermissionsAsync();
    let finalStatus = existingStatus;

    if (finalStatus !== "granted") {
      const permissionResponse = await Location.requestForegroundPermissionsAsync();
      finalStatus = permissionResponse.status;
    }

    if (finalStatus !== "granted") {
      return null;
    }

    const subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 1000,
        distanceInterval: 1, // Dispara a cada 1 metro deslocado!
      },
      (loc) => {
        if (loc?.coords) {
          onLocation({
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
          });
        }
      }
    );

    return () => subscription.remove();
  } catch {
    return null;
  }
}
