# 🚶 Mova

> Aplicativo de monitoramento e segurança para idosos com detecção de quedas, zonas seguras e comunicação familiar em tempo real.

---

## 📱 Sobre o Projeto

O **Mova** é um aplicativo mobile desenvolvido com **Expo + React Native** inspirado no Life360, focado na segurança e bem-estar de idosos. Ele permite que cuidadores acompanhem em tempo real a localização, o estado de saúde e os eventos do familiar monitorado.

### ✨ Funcionalidades

| Funcionalidade | Descrição |
|---|---|
| 🤸 **Detecção de Quedas** | Monitora o acelerômetro e detecta quedas automaticamente |
| 🆘 **SOS Manual** | Botão de emergência acionado pelo próprio idoso |
| 📍 **Zonas Seguras** | Define locais confiáveis (casa, clínica, etc.) com raio configurável |
| 🔔 **Notificações Push** | Cuidador recebe alertas imediatos de quedas, SOS e saída de zonas |
| 🗺️ **Mapa em Tempo Real** | Visualização da localização atual do idoso no mapa |
| 🔋 **Monitor de Bateria** | Exibe o nível de bateria do dispositivo do idoso para o cuidador |
| 🔄 **Sincronização** | Comunicação bidirecional via código de círculo familiar |
| 📋 **Histórico de Eventos** | Registro de quedas, SOSs e entradas/saídas de zonas seguras |

---

## 🏗️ Arquitetura

```
Mova/
├── App.tsx                    # Roteamento principal (Senior/Caregiver)
├── app.json                   # Configuração Expo
├── src/
│   ├── types.ts               # Tipos globais compartilhados
│   ├── screens/
│   │   ├── SeniorScreen.tsx   # Interface do idoso monitorado
│   │   └── CaregiverScreen.tsx# Painel do cuidador (mapa, alertas, histórico)
│   └── services/
│       ├── locationService.ts # Geofencing e rastreamento de localização
│       ├── notificationService.ts # Envio e recebimento de push notifications
│       └── syncService.ts     # Sincronização de estado entre dispositivos
└── assets/                    # Ícones e imagens do app
```

### Fluxo de Dados

```
[Dispositivo do Idoso]
  SeniorScreen → syncService → notificationService
       ↓ (código do círculo)
[Dispositivo do Cuidador]
  CaregiverScreen ← syncService ← notificações push
```

---

## 🛠️ Tecnologias

- **[Expo](https://expo.dev/) ~57** — Framework React Native
- **React Native 0.86** + **React 19**
- **TypeScript 6**
- **expo-sensors** — Acelerômetro para detecção de quedas
- **expo-location** — Rastreamento GPS e geofencing
- **expo-notifications** — Push notifications locais e remotas
- **expo-task-manager** — Tarefas em background
- **expo-battery** — Monitoramento de bateria
- **react-native-maps** — Mapa interativo
- **AsyncStorage** — Persistência local de dados

---

## 🚀 Como Rodar

### Pré-requisitos

- [Node.js](https://nodejs.org/) 18+
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- App **Expo Go** no celular ([Android](https://play.google.com/store/apps/details?id=host.exp.exponent) / [iOS](https://apps.apple.com/app/expo-go/id982107779))

### Instalação

```bash
# Clone o repositório
git clone https://github.com/GRB-04/Mova.git
cd Mova

# Instale as dependências
npm install

# Inicie o servidor de desenvolvimento
npx expo start -c
```

### Executar no Dispositivo

```bash
# Android
npm run android

# iOS
npm run ios

# Web
npm run web
```

Escaneie o QR Code com o app **Expo Go** para testar no seu dispositivo.

---

## 📲 Como Usar

### Modo Idoso (`SeniorScreen`)
1. Abre o app e seleciona **"Sou o Idoso"**
2. O monitoramento de quedas é ativado automaticamente
3. Em caso de queda detectada, um alerta é exibido com contador regressivo
4. Pressione **"Estou Bem"** para cancelar ou **"Preciso de Ajuda"** para acionar socorro
5. Botão **SOS** disponível a qualquer momento

### Modo Cuidador (`CaregiverScreen`)
1. Abre o app e seleciona **"Sou o Cuidador"**
2. Insere o **código do círculo** familiar gerado no dispositivo do idoso
3. Acompanha no **mapa** a localização em tempo real
4. Recebe **notificações push** de todos os eventos
5. Gerencia **zonas seguras** diretamente pelo app

---

## 🔒 Permissões

| Permissão | Uso |
|---|---|
| `ACCESS_FINE_LOCATION` | Rastreamento GPS do idoso |
| `RECEIVE_BOOT_COMPLETED` | Manter monitoramento após reinicialização |
| `POST_NOTIFICATIONS` | Enviar alertas ao cuidador |
| `FOREGROUND_SERVICE` | Monitoramento contínuo em background |

---

## 📄 Licença

Este projeto está licenciado sob a [MIT License](LICENSE).

---

<div align="center">
  <p>Feito com ❤️ para proteger quem amamos</p>
</div>
