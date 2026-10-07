// Armazenamento local (no aparelho) dos resultados das tentativas.
// Usa o AsyncStorage, que já é dependência do app: persiste ao fechar/abrir o app.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { TrialRecord } from "./scoring";

const KEY = "@mova_study_trials_v1";

export async function loadTrials(): Promise<TrialRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as TrialRecord[]) : [];
  } catch {
    return [];
  }
}

async function save(trials: TrialRecord[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(trials));
}

export async function addTrial(t: TrialRecord): Promise<void> {
  const all = await loadTrials();
  all.push(t);
  await save(all);
}

export async function deleteTrial(id: string): Promise<TrialRecord[]> {
  const all = (await loadTrials()).filter((t) => t.id !== id);
  await save(all);
  return all;
}

export async function clearTrials(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
