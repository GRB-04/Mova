import { Platform } from "react-native";

// No Android dentro do Expo Go (SDK 53+), expo-notifications lança erro fatal
// ao importar PushTokenManager. No iOS (iPhone) e em builds nativos de produção,
// funciona normalmente.
let Notifications: any = null;
try {
  Notifications = require("expo-notifications");
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch {
  Notifications = null;
}

class NotificationService {
  private isInitialized = false;
  private responseSubscription: any = null;
  private onEstouBemCallback: (() => void) | null = null;
  private onPedirAjudaCallback: (() => void) | null = null;

  public async init(
    onEstouBem?: () => void,
    onPedirAjuda?: () => void
  ): Promise<boolean> {
    if (onEstouBem) this.onEstouBemCallback = onEstouBem;
    if (onPedirAjuda) this.onPedirAjudaCallback = onPedirAjuda;

    if (!Notifications) return false;
    if (this.isInitialized) return true;

    try {
      // 1. Solicita permissão do usuário
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        return false;
      }

      // 2. Cria canal Android com prioridade MÁXIMA (se aplicável)
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("mova_emergencia", {
          name: "Alertas de Emergência e Queda Mova",
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 500, 200, 500],
          lightColor: "#FF3B30",
          sound: "default",
          enableVibrate: true,
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          bypassDnd: true,
        });

        await Notifications.setNotificationChannelAsync("mova_lugares", {
          name: "Lugares Confiáveis e Bateria",
          importance: Notifications.AndroidImportance.HIGH,
          sound: "default",
          enableVibrate: true,
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        });
      }

      // 3. Registra Categoria Interativa com Botões ("Estou Bem" e "Pedir Ajuda")
      await Notifications.setNotificationCategoryAsync("FALL_ALERT", [
        {
          identifier: "ESTOU_BEM",
          buttonTitle: "Estou Bem",
          options: {
            opensAppToForeground: false,
          },
        },
        {
          identifier: "PEDIR_AJUDA",
          buttonTitle: "Pedir Ajuda",
          options: {
            opensAppToForeground: true,
            isDestructive: true,
          },
        },
      ]);

      // 4. Escuta os cliques nas ações da notificação
      this.responseSubscription = Notifications.addNotificationResponseReceivedListener(
        (response: any) => {
          const actionId = response.actionIdentifier;
          if (actionId === "ESTOU_BEM") {
            if (this.onEstouBemCallback) {
              this.onEstouBemCallback();
            }
          } else if (actionId === "PEDIR_AJUDA" || actionId === Notifications.DEFAULT_ACTION_IDENTIFIER) {
            if (actionId === "PEDIR_AJUDA" && this.onPedirAjudaCallback) {
              this.onPedirAjudaCallback();
            }
          }
        }
      );

      this.isInitialized = true;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Notificação Imediata de Queda (Dispara na Tela Bloqueada com botões)
   */
  public async notifyFallDetected(magnitude: number): Promise<string | null> {
    if (!Notifications) return null;
    try {
      await this.init();

      const notifId = await Notifications.scheduleNotificationAsync({
        content: {
          title: "Alerta de Queda! Você está bem?",
          subtitle: "Toque para responder",
          body: `Impacto de ${magnitude.toFixed(1)}g detectado. Responda em 30s antes do chamado de socorro.`,
          categoryIdentifier: "FALL_ALERT",
          sound: true,
          priority: Notifications.AndroidNotificationPriority.MAX,
          channelId: "mova_emergencia",
          data: { type: "queda", magnitude },
        },
        trigger: null,
      });

      return notifId;
    } catch {
      return null;
    }
  }

  /**
   * Disparo programado (ex: 4 segundos) para permitir que o usuário bloqueie a tela do aparelho
   */
  public async scheduleDelayedFallTest(seconds = 4): Promise<void> {
    if (!Notifications) return;
    try {
      await this.init();

      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Alerta de Queda! Você está bem?",
          subtitle: "Toque para responder",
          body: "Responda: [Estou Bem] ou [Pedir Ajuda].",
          categoryIdentifier: "FALL_ALERT",
          sound: true,
          priority: Notifications.AndroidNotificationPriority.MAX,
          channelId: "mova_emergencia",
          data: { type: "queda", magnitude: 2.8 },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds,
        },
      });
    } catch {
      // Ignora erro
    }
  }

  /**
   * Notificação de Chegada ou Saída de Lugar Confiável (Estilo Life360)
   */
  public async notifyPlaceEvent(
    placeName: string,
    type: "chegada" | "saida",
    seniorName = "João"
  ): Promise<void> {
    if (!Notifications) return;
    try {
      await this.init();

      const isChegada = type === "chegada";
      await Notifications.scheduleNotificationAsync({
        content: {
          title: isChegada ? `${seniorName} chegou em ${placeName}` : `ALERTA: ${seniorName} saiu de ${placeName}!`,
          body: isChegada
            ? `${seniorName} está dentro da área segura (${placeName}).`
            : `${seniorName} saiu da área segura (${placeName})! Verifique no mapa ao vivo.`,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
          channelId: "mova_lugares",
          data: { type: "lugar", placeName, event: type },
        },
        trigger: null,
      });
    } catch {
      // Ignora erro se não permitido
    }
  }

  /**
   * Notificação de Bateria Fraca (Estilo Life360)
   */
  public async notifyLowBattery(level: number): Promise<void> {
    if (!Notifications) return;
    try {
      await this.init();

      await Notifications.scheduleNotificationAsync({
        content: {
          title: `Bateria do idoso em ${level}%`,
          body: "Lembre o idoso de colocar o aparelho no carregador para não pausar a proteção.",
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
          channelId: "mova_lugares",
          data: { type: "bateria", level },
        },
        trigger: null,
      });
    } catch {
      // Ignora
    }
  }

  /**
   * Notificação de Emergência no Aparelho do Cuidador
   */
  public async notifyEmergencyCaregiver(
    seniorName = "João",
    locationText = "Sala de Aula / Campus"
  ): Promise<void> {
    if (!Notifications) return;
    try {
      await this.init();
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `EMERGÊNCIA: ${seniorName.toUpperCase()} PEDIU SOCORRO!`,
          subtitle: "Atenção Imediata!",
          body: `${seniorName} acionou o Botão de Pânico no MOVA!\nLocal: ${locationText}\nToque para ver a localização no mapa e ligar agora.`,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.MAX,
          channelId: "mova_emergencia",
          data: { type: "sos" },
        },
        trigger: null,
      });
    } catch {}
  }
  public async dismissAlerts(): Promise<void> {
    if (!Notifications) return;
    try {
      await Notifications.dismissAllNotificationsAsync();
    } catch {
      // Ignora
    }
  }

  public setCallbacks(onEstouBem: () => void, onPedirAjuda: () => void) {
    this.onEstouBemCallback = onEstouBem;
    this.onPedirAjudaCallback = onPedirAjuda;
  }
}

export const notificationService = new NotificationService();
