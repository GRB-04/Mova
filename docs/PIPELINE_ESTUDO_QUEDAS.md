# Pipeline do estudo: replicação de 3 algoritmos de detecção de queda no celular (Mova)

> **Para o agente de IA que vai executar este documento:** leia tudo antes de começar. Aqui está o contexto completo do projeto, as decisões já tomadas, as especificações dos 3 algoritmos (com o grau de confiança de cada parâmetro) e as etapas na ordem em que devem ser feitas. Siga as etapas na ordem. Ao final de cada etapa existe um critério de "pronto". Não pule etapas sem avisar a equipe.

---

## 0. Contexto

### 0.1 O projeto
- **Mova** é um app em **Expo SDK 57 / React Native 0.86 / TypeScript** que usa os sensores do próprio celular para detectar quedas de idosos e avisar cuidadores.
- É um **projeto de faculdade (UNAMA)**. A equipe precisa entregar um **artigo científico** e tem **pouco tempo**.
- O detector caseiro anterior errava muito (muitos falsos positivos, poucos acertos).
- **Estado do repositório:** só existe o template em branco do Expo (`App.tsx` placeholder). O `README.md` descreve uma arquitetura planejada (`src/screens/SeniorScreen.tsx`, `src/services/...`) que **ainda não existe** aqui. `expo-sensors` **não está instalado**. Todo o código de detecção será escrito do zero.
- O `AGENTS.md` do repositório exige ler a documentação versionada do Expo (https://docs.expo.dev/versions/v57.0.0/) antes de escrever código. Se `docs.expo.dev` estiver bloqueado, a mesma documentação está no GitHub: `https://github.com/expo/expo/tree/main/docs/pages/versions/v57.0.0/sdk/` (`accelerometer.mdx`, `sensors.mdx`, `devicemotion.mdx`, `filesystem.mdx`, `keep-awake.mdx`, `sharing.mdx`).

### 0.2 A decisão de pesquisa (já tomada, não rediscutir)
Em vez de criar um modelo de IA novo, a equipe vai fazer um **estudo de replicação / avaliação comparativa**:

> **Pergunta do artigo:** algoritmos de detecção de queda publicados na literatura mantêm o desempenho que os autores relataram quando são reimplementados e executados num smartphone comum, com o app Mova? Em especial: quantos **falsos positivos** eles geram?

Isso é ciência válida mesmo que o resultado seja "os algoritmos pioram muito no celular". O artigo **não depende** de o detector funcionar bem; depende de **medir direito**.

### 0.3 Os 3 algoritmos escolhidos (todos replicáveis sem contatar os autores)
| ID | Algoritmo | Tipo | De onde vem a especificação |
|---|---|---|---|
| **A1** | **Kangas et al. 2008**, variante "2" (início da queda + impacto em 1 s + postura em 2 s) | Limiar multifase | Bagalà et al. 2012 (PLoS ONE, acesso aberto) + porte Android open source "Guardian" (licença MIT) |
| **A2** | **Bourke et al. 2010**, "Bourke3" (VELOCIDADE + IMPACTO + POSTURA) | Limiar multifase | Bagalà et al. 2012 (PLoS ONE, acesso aberto), texto completo lido |
| **A3** | **PIPTO**, Moutsis, Tsintotas & Gasteratos 2023 | Limiar multifase recente | Código público dos autores (Python e C++) + artigo de acesso aberto (Sensors) |

Os três são **de limiar**: **não precisam de treino**. Dados só são necessários para **avaliar**.

### 0.4 O estudo-modelo
**Bagalà F, Becker C, Cappello A, Chiari L, Aminian K, Hausdorff JM, Zijlstra W, Klenk J. "Evaluation of Accelerometer-Based Fall Detection Algorithms on Real-World Falls." PLoS ONE 2012;7(5):e37062. doi:10.1371/journal.pone.0037062.**
- Reimplementou 13 algoritmos publicados e os testou em **29 quedas reais** de idosos (sensor na lombar).
- Sensibilidade (SE) média de **57,0% ± 27,3%** e especificidade (SP) média de **83,0% ± 30,3%**, muito pior do que os artigos originais diziam.
- Entre **3 e 85 alarmes falsos por dia** em gravações de 24 h.
- **Bourke3** teve o melhor equilíbrio: SE 82,8%, SP 96,7%, cerca de 5 alarmes falsos/dia.
- **Kangas:** menos de 9 alarmes falsos/dia, mas sensibilidade abaixo de 55%.
- Uma cópia do texto completo está em: `https://raw.githubusercontent.com/cstahmer/text_mining_with_r/master/data/plosONE/0037062.txt`

O estudo Mova é "o Bagalà, só que no celular". Os resultados devem ser comparados diretamente com os dele.

### 0.5 Status de confiança das informações deste documento
A pesquisa foi feita com acesso limitado à internet (sites acadêmicos bloqueados). Por isso **cada parâmetro tem um status**:
- ✅ **lido na fonte** (texto do artigo ou código dos autores)
- 🟡 **fonte secundária** (outro artigo ou código que cita o original; é preciso conferir no PDF original antes de publicar)
- ⚠️ **suposição nossa** (não está em nenhuma fonte; é decisão de implementação e precisa ser **declarada no artigo como adaptação**)

**Regra:** nenhum número 🟡 ou ⚠️ entra no artigo como fato sem conferência no PDF. A Etapa 1 cuida disso.

---

## 1. Visão geral do pipeline

```
ETAPA 1  Conferir os parâmetros nos PDFs              (humanos, ~1 dia)
ETAPA 2  Preparar o projeto e o módulo de detecção    (agente)
ETAPA 3  Implementar A1 Kangas + testes unitários     (agente)
ETAPA 4  Baixar a SisFall e criar o script de replay  (agente)
ETAPA 5  Avaliar A1 na SisFall                        (agente)
ETAPA 6  Implementar e avaliar A2 Bourke3             (agente)
ETAPA 7  Implementar e avaliar A3 PIPTO               (agente)
ETAPA 8  Tela de coleta + detectores no app           (agente)
ETAPA 9  Teste no celular com voluntários             (humanos)
ETAPA 10 Analisar os dados do celular                 (agente)
ETAPA 11 Tabelas e figuras para o artigo              (agente + humanos)
(OPCIONAL) Etapa 12 LTMM: alarmes falsos/dia em vida real de idosos
```

**Princípio central de arquitetura:** cada algoritmo é uma **classe TypeScript pura**, sem nenhuma dependência de React Native, que recebe amostras e devolve eventos. **O mesmo arquivo** roda:
1. no Node, num script que reproduz as bases públicas (avaliação offline), e
2. dentro do app, ligado ao acelerômetro (avaliação no celular).

Isso garante que o que foi medido offline é exatamente o que roda no celular.

**Prazo:** o teste precisa ser **rápido**. O objetivo mínimo é ter os 3 algoritmos rodando no celular e uma tabela comparativa para sustentar o artigo. Priorize ter tudo funcionando de ponta a ponta antes de refinar.

---

## ETAPA 1: Conferir os parâmetros nos PDFs (humanos)

Baixar e ler:
1. **Bagalà et al. 2012**, PLoS ONE (gratuito). Seções sobre Kangas e Bourke3, mais a **Tabela S1** (material suplementar com os parâmetros de cada algoritmo).
2. **Kangas et al. 2008**, "Comparison of low-complexity fall detection algorithms for body attached accelerometers", *Gait & Posture* 28(2):285-291, doi:10.1016/j.gaitpost.2008.01.003. Pago, tentar pela biblioteca da UNAMA ou Periódicos CAPES. Se não conseguir, use os valores do Bagalà e declare isso.
3. **Bourke et al. 2010**, "Evaluation of waist-mounted tri-axial accelerometer based fall-detection algorithms during scripted and continuous unscripted activities", *Journal of Biomechanics* 43(15):3051-3057. Pago, mesma estratégia. **O DOI não foi confirmado; conferir antes de citar.**
4. **Moutsis SN, Tsintotas KA, Gasteratos A. "PIPTO: Precise Inertial-Based Pipeline for Threshold-Based Fall Detection Using Three-Axis Accelerometers."** *Sensors* 2023;23(18):7951 (gratuito). Também em PMC10534597.

Preencher a tabela abaixo (colunas "Conferido no PDF?" e "Valor no PDF") e salvar como `docs/parametros_conferidos.md`. **O agente deve usar os valores conferidos se forem diferentes dos daqui.**

**Pronto quando:** cada parâmetro marcado 🟡 nas seções 3, 6 e 7 tiver um valor conferido, ou a anotação "não encontrado, mantém suposição".

---

## ETAPA 2: Preparar o projeto

### 2.1 Dependências
```bash
npx expo install expo-sensors expo-file-system expo-sharing expo-keep-awake
npm i -D tsx vitest   # rodar TS no Node e testes
```

### 2.2 `app.json`: obrigatório
```json
{
  "expo": {
    "android": {
      "permissions": ["android.permission.HIGH_SAMPLING_RATE_SENSORS"]
    },
    "plugins": [
      ["expo-sensors", { "motionPermission": "O Mova usa os sensores de movimento para detectar quedas." }]
    ]
  }
}
```
**Por que isso é crítico:** sem `HIGH_SAMPLING_RATE_SENSORS`, o expo-sensors registra o acelerômetro no Android 12+ em `SENSOR_DELAY_NORMAL`, cerca de **5 Hz**, num build de desenvolvimento/EAS. Isso é inútil para detectar queda. O Expo Go já tem essa permissão, mas um build próprio não. **Essa pode ter sido uma das causas do péssimo desempenho do detector antigo.** Isto foi verificado no código-fonte do expo-sensors (`SensorSubscription.kt`, PR #17177).

### 2.3 Estrutura de pastas
```
src/
  detection/
    types.ts            # Sample, FallEvent, Detector
    resample.ts         # reamostragem linear para grade uniforme
    filters.ts          # Butterworth 2ª ordem (Kangas)
    kangas.ts           # A1
    bourke3.ts          # A2
    pipto.ts            # A3
    __tests__/          # testes com sinais sintéticos
  screens/
    RecorderScreen.tsx  # coleta + detectores ao vivo (Etapa 8)
scripts/
  datasets/sisfall.ts   # loader da SisFall
  replay.ts             # roda os detectores sobre a base e calcula métricas
data/                   # bases baixadas (NÃO commitar; adicionar ao .gitignore)
results/                # CSVs de saída das avaliações
```

### 2.4 Interface comum (`src/detection/types.ts`)
```ts
export type Sample = { t: number; ax: number; ay: number; az: number }; // t em SEGUNDOS, aceleração em g COM gravidade
export type FallEvent = { t: number; algorithm: string; details?: Record<string, number | string> };
export interface Detector {
  readonly name: string;
  push(s: Sample): FallEvent[]; // recebe amostras na ordem e devolve os alarmes disparados nesta amostra
  reset(): void;
}
```
**Convenções obrigatórias:**
- Aceleração em **g** (1 g = 9,80665 m/s²) **com gravidade incluída**: em repouso, |a| ≈ 1 g.
- Nunca usar `DeviceMotion.acceleration`, que tem a gravidade removida.
- Tempo em segundos.
- Cada detector reamostra internamente para a taxa dele (Kangas 50 Hz; Bourke3 100 Hz ou 50 Hz; PIPTO conforme o código), ou recebe já reamostrado. Escolha um padrão e documente.

**Pronto quando:** `npx tsc --noEmit` passa e a estrutura existe.

---

## ETAPA 3: Implementar A1 (Kangas 2008, variante 2)

### 3.1 Referência
- **Original:** Kangas M, Konttila A, Lindgren P, Winblad I, Jämsä T. *Gait & Posture* 2008;28(2):285-291. doi:10.1016/j.gaitpost.2008.01.003.
- **Reimplementação independente:** Bagalà 2012 (variantes 1a-1d, 2a-2b, 3a-3c).
- **Porte de código aberto (MIT):** `https://raw.githubusercontent.com/frequently-falling-coder/experimental-fall-detector-android-app/HEAD/fall-detector/src/main/java/altermarkive/guardian/Detector.kt`. O README diz que é "algorithm number 2" do Kangas 2008. **Leia esse arquivo**: ele tem as constantes e os filtros prontos.
- **Desempenho original (lab, 3 voluntários):** SE 76-97%, SP 100% na cintura.
- **Reavaliação em quedas reais (Bagalà):** menos de 9 alarmes falsos/dia, SE abaixo de 55%.
- **Vida real (Kangas 2015, mesmo grupo, não verificado):** 80% das quedas (12/15), 0,049 alarmes falsos por hora.

### 3.2 Sinal e pré-processamento
- **Taxa:** **50 Hz uniforme**. Reamostrar com interpolação linear numa grade de 20 ms (como o Guardian faz). 🟡
- **Unidade:** g com gravidade. 🟡
- **Filtros (por eixo):** Butterworth de 2ª ordem, corte em **0,25 Hz**, para fs = 50 Hz. 🟡 (Guardian; o filtro original não foi confirmado)
  - **LPF:** `xv0=xv1; xv1=xv2; xv2 = in/4.143204922e+03; yv0=yv1; yv1=yv2; yv2 = (xv0 + xv2) + 2*xv1 + (-0.9565436765*yv0) + (1.9555782403*yv1)`
  - **HPF:** `xv2 = in/1.022463023e+00; yv2 = (xv0 + xv2) - 2*xv1 + (-0.9565436765*yv0) + (1.9555782403*yv1)`
  - Os coeficientes **só valem para 50 Hz**. Se mudar a taxa, recalcule.
  - Ignore alarmes nos primeiros ~8 s (aquecimento do filtro). ⚠️

### 3.3 Atributos
- `SV_TOT = |a|` (bruto)
- `SV_D = |HPF(a)|`
- `SV_MaxMin = |(max−min) de cada eixo nos últimos 5 amostras (0,1 s)|`
- `Z2 = (SV_TOT² − SV_D² − 1) / 2`

### 3.4 Parâmetros
| Parâmetro | Valor | Status |
|---|---|---|
| Início da queda | `SV_TOT` cruza para baixo de **0,6 g** | 🟡 Bagalà + Guardian |
| Janela para achar o impacto | **1,0 s** após o início | 🟡 Bagalà + Guardian |
| Impacto `SV_TOT` | **≥ 2,0 g** | 🟡 Guardian |
| Impacto `SV_D` | **≥ 1,7 g** | 🟡 Guardian |
| Impacto `SV_MaxMin` | **≥ 2,0 g** | 🟡 Guardian |
| Impacto `Z2` | **≥ 1,5 g** | 🟡 Guardian |
| Checagem de postura | **2,0 s** após a **última** amostra de impacto | 🟡 Bagalà + Guardian |
| Janela de média da postura | **0,4 s** (20 amostras) | 🟡 |
| Deitado se | média da componente vertical do LPF **≤ 0,5 g** (equivale a inclinação ≥ 60°) | 🟡 Bagalà |
| Período refratário após alarme | 10 s | ⚠️ |
| Referência "em pé" `u_up` | vetor LPF médio durante **5 s de calibração em pé** | ⚠️ (adaptação para celular) |

**Atenção:** qual sinal de impacto é a variante "2a" e qual é a "2b" **não foi confirmado** (os símbolos sumiram no texto do Bagalà). O Guardian combina **os 4 sinais com OU**. Implementar:
- **`kangas-guardian`**: os 4 sinais com OU (é o que o código aberto faz). **Esta é a variante principal.**
- Uma flag para testar cada sinal isolado (`SVTOT`, `SVD`, `SVMAXMIN`, `Z2`), caso o PDF confirme o mapeamento.
- Não implementar a variante 3 (o limiar de velocidade é desconhecido).

### 3.5 Pseudocódigo (por amostra a 50 Hz)
```
estado: fallTimer=-1, impactTimer=-1, lastAlarm=-inf, svPrev

1. decrementa fallTimer e impactTimer se > -1
2. L = LPF(a); H = HPF(a)
   SVTOT=|a|; SVD=|H|; SVMAXMIN=|range5(a)|; Z2=(SVTOT²-SVD²-1)/2
3. se svPrev >= 0.6 e SVTOT < 0.6: fallTimer = 50 (1 s)
4. se fallTimer > -1 e (SVTOT>=2.0 ou SVD>=1.7 ou SVMAXMIN>=2.0 ou Z2>=1.5):
       impactTimer = 100 (2 s); tImpact = t       // re-arma a cada amostra acima do limiar
5. se impactTimer == 0:
       m = média dos últimos 20 valores de dot(L, u_up)
       se m <= 0.5 e t - lastAlarm >= 10: EMITE QUEDA; lastAlarm = t
6. svPrev = SVTOT
```

### 3.6 A regra de postura no celular (adaptação crítica)
- **Original:** usa o eixo vertical de um sensor fixo na cintura.
- **Guardian:** usa o eixo z do celular (`média LPF z > 0,5` = deitado). Só funciona com o celular em pé na cintura e a tela para fora. Dispara sempre que o celular fica deitado de face para cima.
- **Implementar as duas** (`postureMode: 'faithful' | 'guardian'`) e reportar ambas no artigo.
- **`faithful`:** calibrar `u_up` com 5 s em pé e testar `mean(dot(L, u_up)) <= 0.5`.

### 3.7 Testes unitários (sinais sintéticos)
1. 1 g constante por 30 s → **sem alarme**.
2. Queda a 0,3 g por 0,3 s → pico de 3 g → vetor de gravidade girado 90° por 5 s → **1 alarme**.
3. Mesmo sinal, mas a gravidade volta à posição em pé → **sem alarme**.
4. Pico de 3 g **sem** queda a menos de 0,6 g antes → **sem alarme**.

**Pronto quando:** testes passando e `tsc` limpo.

---

## ETAPA 4: SisFall + script de replay

### 4.1 Sobre a SisFall
- **Citação:** Sucerquia A, López JD, Vargas-Bonilla JF. "SisFall: A Fall and Movement Dataset." *Sensors* 2017;17(1):198. doi:10.3390/s17010198.
- **Acesso (correção importante):** a página oficial (`http://sistemic.udea.edu.co/en/investigacion/proyectos/english-falls/`) está reportada como **quebrada**. Alternativas:
  1. Material suplementar do artigo no MDPI (`https://www.mdpi.com/1424-8220/17/1/198`).
  2. Espelho não oficial em CSV no GitHub: `https://github.com/krishna-karthikk/SisFall-Dataset` (38 pastas: SA01-SA23, SE01-SE15). Não tem licença; usar para trabalhar, mas **citar a fonte oficial**.
  3. Se nada funcionar, escrever para os autores.
- **Dispositivo:** sensor próprio na **cintura** com ADXL345 (±16 g, 13 bits), MMA8451Q (±8 g, 14 bits) e giroscópio ITG3200.
- **Taxa:** **200 Hz** (confirmado em dois loaders independentes).
- **Arquivos:** um `.txt` por tentativa, nome `{D##|F##}_{SA##|SE##}_R##.txt`, com 9 colunas separadas por vírgula (ADXL xyz, ITG xyz, MMA xyz). As linhas terminam com `;`.
- **Conversão para g (ADXL345):** `g = raw * 32 / 8192`, ou seja (2·16)/2¹³. 🟡 (loaders). Conferir no Readme oficial da base.
- **Sujeitos:** 23 jovens (SA01-SA23, 19-30 anos) e 15 idosos (SE01-SE15, 60-75 anos 🟡). **Os idosos fizeram só atividades do dia a dia (ADLs)**, exceto um (SE06, que tem quedas).
- **Quedas:** 15 tipos (F01-F15: escorregões, tropeços, desmaio, queda ao sentar/levantar etc.), 5 repetições de 15 s.
- **ADLs:** 19 tipos (D01-D19). **Atenção especial** à D11 ("tenta levantar e desaba na cadeira") e à D18 ("tropeça andando"): são **quase-quedas**, os melhores testes de falso positivo.
- **Loaders de referência:** `github.com/Dawn2310/Fall-detection-multidataset` (`src/data_loader.py`), `github.com/shinjimori/Analyze_SisFall`.

### 4.2 Pré-processamento para simular o celular
1. Usar o canal **ADXL345** e converter para g.
2. **Filtro anti-aliasing** (passa-baixa de ~20 Hz) e depois **decimar 200 → 50 Hz** (fator 4), ou para 100 Hz no Bourke3.
3. **Saturar (clip)** em ±8 g para simular o acelerômetro de um celular. Rodar também sem clip e reportar os dois.
4. **Posicionamento:** cintura equivale a "celular no cinto/pochete". Não é bolso. Deixar isso claro no artigo.

### 4.3 Script `scripts/replay.ts`
```
para cada arquivo da SisFall:
    carrega → converte → reamostra → para cada detector: reset(); push() em cada amostra
    registra: arquivo, sujeito, tipo (F/D), código da atividade, nº de alarmes, horários
saída: results/sisfall_<detector>.csv
```
**Pontuação** (definir assim no artigo):
- **Arquivo de queda (F##):** **VP** se houver ≥ 1 alarme no arquivo; senão **FN**. (A SisFall não traz o instante exato do impacto, então a pontuação é por arquivo.)
- **Arquivo de ADL (D##):** **FP** se houver qualquer alarme; senão **VN**.

**Métricas:**
- Sensibilidade = VP/(VP+FN)
- Especificidade = VN/(VN+FP)
- Precisão
- F1
- Intervalo de confiança de 95% (Wilson) para SE e SP

**Reportar separadamente:** jovens (SA) × idosos (SE), e a taxa de FP por código de ADL. Assim fica visível **quais atividades causam falso positivo**.

**Pronto quando:** `npx tsx scripts/replay.ts --dataset sisfall --detector kangas` gera o CSV e imprime a tabela de métricas.

---

## ETAPA 5: Avaliar A1 na SisFall
- Rodar `kangas-guardian` com `postureMode=faithful` e com `postureMode=guardian`.
- **Comparar com o publicado:** SE 76-97% e SP 100% no lab original; SE < 55% e < 9 alarmes falsos/dia em quedas reais (Bagalà).
- Gerar o **funil por estágio** (quantos arquivos passaram em cada etapa: início da queda → impacto → postura → alarme). Isso mostra **qual estágio elimina os falsos positivos**.

**Pronto quando:** `results/sisfall_kangas*.csv` e um resumo em `results/RESUMO.md`.

---

## ETAPA 6: Implementar e avaliar A2 (Bourke3)

### 6.1 Referência
- **Original:** Bourke AK, van de Ven P, Gamble M, O'Connor R, Murphy K, Bogan E, McQuade E, Finucane P, Ó Laighin G, Nelson J. *J Biomech* 2010;43(15):3051-3057.
- **Desempenho original (segundo o Bagalà):** SE 100% e SP 100% em quedas simuladas, **0,6 falso positivo por dia** em 52,4 h de vida real de idosos. Existe outra fonte que diz SE 94,6% e 0,94 FP/dia: **conferir no PDF**.
- **Quedas reais (Bagalà 2012):** SE 82,8%, SP 96,7%, cerca de 5 alarmes falsos/dia. Foi o melhor dos 13 algoritmos.
- **Não existe implementação aberta** do Bourke3 no GitHub: a do Mova será a primeira em celular, desde que se confirme que ninguém fez antes.

### 6.2 Parâmetros (texto do Bagalà 2012)
| Parâmetro | Valor | Status |
|---|---|---|
| SV | √(ax²+ay²+az²), em g, com gravidade | 🟡 |
| LFT (limiar inferior) | **0,65 g** | 🟡 ("the SV exceeds the LFT (0.65 g) and the UFT (2.8 g)") |
| UFT (limiar de impacto) | **2,8 g** | 🟡 |
| Tempo da borda de descida (SV abaixo de LFT pela última vez até passar UFT) | **600 ms** (queda se ≤) | 🟡 valor; ⚠️ direção ≤ |
| Tempo da borda de subida (última vez que passa LFT até passar UFT) | **350 ms** (queda se ≤) | 🟡 valor; ⚠️ direção ≤ |
| Velocidade vertical | **≤ −0,7 m/s** | 🟡 |
| Como calcular a velocidade | integral de (SV − 1 g)·9,80665·dt, do último cruzamento de 1 g para baixo antes da queda (no máximo 1 s antes do impacto) até o impacto; zerar a cada candidato | ⚠️ |
| Janela de postura | de **t+1 s a t+3 s** após o impacto | 🟡 |
| Deitado se | ângulo com a referência "em pé" **> 60°** em **mais de 75%** da janela | 🟡 |
| Vetor gravidade | média móvel de 0,5 s do acelerômetro | ⚠️ |
| Referência "em pé" | 5 s de calibração em pé | ⚠️ |
| Taxa | 100 Hz reamostrado (mínimo 50 Hz) | ⚠️ (o original não foi confirmado; o Bagalà diz "50 a 250 Hz") |
| Refratário | ignorar novos cruzamentos de UFT até t+3 s (candidato aceito) ou t+0,5 s (rejeitado) | ⚠️ |

### 6.3 Pseudocódigo
```
a cada amostra (100 Hz):
  sv = |a|
  se nenhum candidato pendente e sv cruzou UFT para cima:
      tImp = t
      tUp   = último cruzamento de LFT para cima antes de tImp
      tDown = último cruzamento de LFT para baixo antes de tUp
      edgeOK = (tImp - tDown <= 0.600) e (tImp - tUp <= 0.350)     // flag USE_EDGE_TIMES
      v = integral de (sv-1)*9.80665*dt de tStart até tImp; vMin = mínimo de v
      se edgeOK e vMin <= -0.7: pendente = {tImp}
  se pendente e t >= tImp + 3:
      fração de amostras em [tImp+1, tImp+3] com ângulo(gRef, gAtual) > 60°
      se fração > 0.75: EMITE QUEDA
      pendente = null
```

### 6.4 Testes unitários
1. 1 g constante → sem alarme.
2. 0,3 g por 0,35 s → pico de 3,5 g → deitado → **alarme**.
3. Mesmo sinal sem deitar → sem alarme.
4. 0,3 g por mais de 0,6 s → sem alarme (com `USE_EDGE_TIMES`).

### 6.5 Avaliação
- Mesmo replay da Etapa 4, mas reamostrando a SisFall para **100 Hz**.
- **Análises de sensibilidade:** `USE_EDGE_TIMES=false` e janela de velocidade fixa de 1 s.

**Pronto quando:** testes passando e `results/sisfall_bourke3.csv` gerado.

---

## ETAPA 7: Implementar e avaliar A3 (PIPTO)

### 7.1 Referência e código
- **Artigo:** Moutsis SN, Tsintotas KA, Gasteratos A. *Sensors* 2023;23(18):7951.
- **Código oficial:** `https://github.com/smoutsis/fall_detection_through_acceleration_data`, arquivo principal `python/def_fall.py` (também há versão em C/C++).
- **Desempenho reportado (fonte secundária, conferir nas tabelas do artigo):**
  - Acurácia acima de 99% na KFall e acima de 97% na **SisFall**.
  - SE 90,40% e SP 93,96% na MMsys; SE 91,56% e SP 85,90% na KFall.
  - Há um conflito: 99% de acurácia não combina com 85,9% de SP.
- **Licença do repositório:** não verificada. Conferir antes de reaproveitar código.

### 7.2 O que se sabe do código (lido em `def_fall.py`, 🟡: reler linha a linha)
- **Função:** `fall_detection(df, length, hz)`.
  - `df['v']` = magnitude da aceleração em **m/s²**; `df['time']` = tempo.
  - `g = 9.807`.
- **Limiar baixo:** `min_limit = 6.5 m/s²` (≈ 0,66 g).
- **Limiar alto:** `max_limit = max(v_avg, 20) + 10` m/s² (no mínimo 30 m/s² ≈ 3,06 g).
  - `v_avg` é a **média da gravação inteira**.
- **Estágios:**
  1. Marcar amostras abaixo do limiar baixo e acima do alto.
  2. Agrupar extremos separados por mais de `sub_1 = 50` unidades.
  3. Parear um "baixo" (queda livre) com um "alto" (impacto) dentro de `fall_duration = 105`.
  4. Remover duplicatas.
  5. Rejeitar candidatos mais longos que `fall_limitation = 85`.
  6. Contexto `dist_1 = dist_2 = 100`.
  7. Aceitar se, **depois da queda**, a média da magnitude ficar em (g−2, g+2) com desvio padrão < 2 e mais de 20 amostras, **ou** se o pico superar os altos anteriores.
- **⚠️ Unidade de tempo ambígua:** os limites (50, 105, 85, 100) são comparados num eixo derivado `entry[i] = (time[i]-time[i-1])/10 + entry[i-1] + 100/hz`. **Antes de portar, rode o Python original numa gravação conhecida e verifique o que essas unidades significam.**

### 7.3 Passos
1. Clonar o repo dos autores em `vendor/pipto` (fora do build).
2. Rodar o **Python original** na SisFall (ele já foi avaliado nela) e salvar as saídas.
3. Portar para `src/detection/pipto.ts`.
4. **Teste de equivalência:** o porte TS deve dar **os mesmos alarmes** que o Python original nos mesmos arquivos (tolerância de ±1 amostra).
5. **Adaptação para tempo real (obrigatória, declarar no artigo):** trocar `v_avg` da gravação inteira por uma **média móvel** (ex.: últimos 10-30 s) dentro de um buffer deslizante. Rodar as duas versões (offline original × streaming) na SisFall e reportar a diferença.

**Pronto quando:** teste de equivalência passando e `results/sisfall_pipto.csv` e `results/sisfall_pipto_streaming.csv` gerados.

---

## ETAPA 8: Tela de coleta + detectores no app

### 8.1 Fatos verificados sobre o expo-sensors (SDK 57, lidos no código-fonte)
- **Unidades e gravidade:**
  - `Accelerometer`: em **g**, com gravidade. **É o que os 3 algoritmos usam.**
  - `Gyroscope`: em rad/s.
  - `DeviceMotion`:
    - `accelerationIncludingGravity`: em **m/s²**.
    - `acceleration`: **sem** gravidade. **Não usar.**
- **Horário de cada amostra:** cada evento traz `timestamp` em **segundos desde o boot**, não em horário Unix. Usar esse valor (não a hora de chegada no JS) para reamostrar.
- **Taxa de amostragem no Android:**
  - `setUpdateInterval` é só um "freio" de software, com comparação estrita `>`. A taxa entregue fica **abaixo** da pedida. Para ≥ 50 Hz, peça **15 ms**.
  - Sem `setUpdateInterval`, o padrão é 100 ms (< 10 Hz).
- **Taxa de amostragem no iOS:** a taxa pedida é respeitada (normalmente até ≥ 100 Hz). Peça 20 ms para 50 Hz.
- **Diferenças entre plataformas:** Android e iOS têm **sinais dos eixos diferentes** (issue #19229). A magnitude não é afetada; a calibração de "em pé" absorve o resto.
- **Sem segundo plano:** **o expo-sensors para de ler quando o app vai para segundo plano ou a tela apaga.**
  - Para o estudo: app **aberto em primeiro plano** e tela ligada com `expo-keep-awake`.
  - **Declarar isso como limitação no artigo.**
  - Monitoramento real em segundo plano exigiria um módulo nativo com foreground service; fica como trabalho futuro.

### 8.2 `RecorderScreen.tsx`
1. `useKeepAwake()`.
2. Formulário: id do voluntário, posição do celular (cinto / bolso da calça / bolso da camisa / bolsa / mão), plataforma e modelo do aparelho.
3. Botão **Calibrar**: 5 s em pé e parado; calcula `u_up` / `gRef`.
4. Botões **Iniciar / Parar tentativa** e marcadores de evento: "queda", "sentou rápido", "celular caiu" etc. Gravar em `events.csv` com `Date.now()`.
5. Assinar `Accelerometer` (15 ms no Android, 20 ms no iOS). Guardar amostras num `useRef` (**nunca** `setState` por amostra) e gravar em blocos a cada ~1 s.
6. **Rodar os 3 detectores ao vivo**, em paralelo, sobre o mesmo fluxo. Registrar cada alarme em `alarms.csv` (algoritmo, horário, detalhes). **Não notificar o cuidador durante o estudo.** Mostrar só um contador discreto na tela.
7. Formato do CSV de amostras: `session_id,sensor,t_native_s,t_js_ms,x,y,z`. Mais um `session.json` com os metadados, incluindo um par âncora `(t_native, Date.now())` para alinhar com os marcadores.
8. **Gravação de arquivos:** `expo-file-system` (API nova do SDK 57: `File`, `Paths`, `write(..., { append: true })`).
9. **Exportação:** `expo-sharing` (`Sharing.shareAsync(file.uri)`).
10. Overlay de tela "travada" durante as tentativas, para evitar toques no bolso.

### 8.3 Checagens de sanidade antes de começar o teste com voluntários
- Celular parado na mesa: |a| = 1,00 ± 0,05 g.
- Taxa real medida pelo `timestamp` ≥ 50 Hz, com menos de 1% de lacunas maiores que 2× o intervalo.
- **Usar build de desenvolvimento** (`npx expo run:android` ou EAS), com a permissão da Etapa 2.2. **Anotar no artigo** qual build foi usado.

**Pronto quando:** uma sessão de teste gera `samples.csv`, `events.csv`, `alarms.csv` e `session.json`, e a taxa medida é ≥ 50 Hz.

---

## ETAPA 9: Teste no celular com voluntários (humanos)

### 9.1 Ética
- **Não fazer idosos caírem.** Quedas são simuladas por **voluntários jovens e saudáveis**, sobre **colchão grosso**.
- Idosos, se participarem, só fazem atividades normais.
- Pesquisa com seres humanos no Brasil pode exigir aprovação no **CEP (Plataforma Brasil)**. **Perguntar ao professor orientador antes.** Coletar termo de consentimento (TCLE).

### 9.2 Protocolo mínimo (rápido)
- **Participantes:** 3 a 5 voluntários jovens.
- **Posições do celular:**
  - **Cinto ou pochete na cintura:** condição fiel aos artigos originais. Obrigatória.
  - **Bolso da calça:** condição realista. Obrigatória.
  - Bolso da camisa e bolsa: opcionais.
- **Quedas** (sobre o colchão, 3 repetições cada): frente, trás, lado esquerdo, lado direito. Opcional: escorregar sentando.
- **Atividades do dia a dia** (3 repetições cada):
  - andar 30 s
  - sentar devagar e **sentar com força** numa cadeira
  - deitar na cama
  - pegar objeto no chão
  - subir e descer escada
  - pular
  - **deixar o celular cair no chão** e **jogar o celular no sofá**: são os falsos positivos mais prováveis, porque o celular caindo sozinho imita uma queda.
- **Uso livre (o mais importante para o artigo):** cada voluntário passa **2 a 4 horas** com o app aberto no bolso, fazendo a rotina normal. Disso sai a métrica de **alarmes falsos por hora**.
- Sempre calibrar (5 s em pé) depois de colocar o celular na posição.

**Pronto quando:** todos os CSVs foram exportados para uma pasta compartilhada, com uma planilha listando as sessões.

---

## ETAPA 10: Analisar os dados do celular
Script `scripts/analyze_phone.ts`:
1. Ler as sessões e alinhar os marcadores (`events.csv`) com os alarmes (`alarms.csv`) pelo par âncora.
2. **Tentativa de queda:** VP se houver alarme entre −1 s e +5 s do marcador.
3. **Tentativa de ADL:** FP se houver qualquer alarme.
4. **Uso livre:** alarmes falsos por hora = alarmes ÷ horas monitoradas.
5. **Reprocessar offline** os `samples.csv` com os mesmos detectores e confirmar que o resultado é igual ao que rodou ao vivo. Isso valida a implementação.
6. Separar por **algoritmo × posição** (cinto vs bolso) × tipo de atividade.

**Pronto quando:** `results/RESUMO.md` tem as tabelas do celular.

---

## ETAPA 11: Tabelas e figuras para o artigo
**Tabela principal:**

| Algoritmo | Publicado (SE/SP/FP) | Bagalà 2012 (quedas reais) | SisFall (reimplementação) | Celular: cinto | Celular: bolso | Alarmes falsos/h (uso livre) |
|---|---|---|---|---|---|---|

**Figuras:**
- Taxa de FP por tipo de atividade (quais atividades enganam cada algoritmo).
- Funil por estágio (qual fase elimina falsos positivos).
- Exemplo de sinal de uma queda real e de "celular caiu na mesa".

**Estrutura sugerida do artigo:**
1. **Introdução:** quedas em idosos, por que o celular, o problema dos falsos positivos.
2. **Trabalhos relacionados:** Bagalà 2012, revisões, os 3 algoritmos.
3. **Métodos:**
   - algoritmos e todas as adaptações (as marcadas ⚠️)
   - SisFall e o pré-processamento
   - o app e as limitações do Expo
   - o protocolo com voluntários
   - as métricas
4. **Resultados:** a tabela acima.
5. **Discussão:**
   - por que piorou (posição, taxa de amostragem, celular caindo sozinho, postura no bolso)
   - comparação com o Bagalà
6. **Limitações:**
   - quedas simuladas por jovens
   - poucos voluntários
   - app em primeiro plano
   - SisFall é cintura, não bolso
   - parâmetros 🟡 e ⚠️
7. **Conclusão e trabalhos futuros:** aprendizado de máquina para filtrar falsos positivos, módulo nativo em segundo plano.

---

## ETAPA 12 (opcional, se sobrar tempo): LTMM, falsos alarmes/dia na vida real de idosos
- **Base:** PhysioNet "Long Term Movement Monitoring Database" v1.0.0. Acesso aberto, sem login: `https://physionet.org/content/ltmm/1.0.0/` ou `s3://physionet-open/ltmm/1.0.0/` (`aws s3 cp --no-sign-request`).
- **Conteúdo:** 71 gravações domiciliares de **idosos (65-89 anos)**, até ~75 h cada, ~4.900 h no total. Sensor no tronco, **100 Hz**, aceleração em g. **Não há quedas anotadas.**
  - Serve para contar **alarmes falsos por dia** em vida real.
  - A posição no tronco é mais parecida com celular no cinto do que no bolso.
- **⚠️ O arquivo completo tem ~22 GB.** Baixar só **5 a 10 registros** (`.hea` + `.dat`) e ler com `wfdb` (Python) ou converter para CSV.
- **Cuidados:**
  - Alguns registros têm faixa reduzida (ex.: FL001 satura em ±1,94 g): excluir ou reportar à parte.
  - O registro de uso `ReportHome75h.xlsx` marca períodos sem o sensor (banho, dormir): tirar esses períodos do denominador.
  - O registro CO-005 tem uma anotação "fall 11:40": excluir ou analisar à parte.
- **Comparar:** com 0,6/dia (Bourke original) e ~5/dia (Bagalà).

---

## Apêndice A: Outras fontes encontradas (para trabalhos relacionados; conferir antes de citar)
- **Luque et al. 2014**, "Comparison and Characterization of Android-Based Fall Detection Systems", *Sensors* 14(10):18543. Estudo de replicação no Android mais próximo do Mova. O acerto depende muito do tipo de queda; consumo de bateria importa.
- **"Evaluation of Threshold-based Fall Detection on Android Smartphones"** (SCITEPRESS 2015): a fase de queda livre é necessária para ter poucos falsos positivos.
- **Aziz et al. 2017**, *Med Biol Eng Comput*: limiares × aprendizado de máquina; a SVM foi melhor (≈96% SE e SP).
- **Estudos de 2022 e 2024 com várias bases:** quando o algoritmo é testado numa base diferente da usada para ajustá-lo, o desempenho cai muito.
- **Bases não usadas aqui:**
  - **MobiAct:** celular no bolso, a mais parecida com o Mova. Exige pedido de acesso à Hellenic Mediterranean University.
  - **UMAFall:** celular no bolso e sensor na cintura gravados juntos. figshare: `https://figshare.com/articles/dataset/UMA_ADL_FALL_Dataset_zip/4214283`.
  - **tFall:** uma semana de vida real com celular.
  - **FARSEEING:** quedas reais; acesso restrito.
- **Algoritmos descartados nesta fase** (exigem treino ou têm parâmetros não confirmados):
  - Tsinganos & Skodras 2018: máquina de estados + kNN.
  - Guo & Nakayama 2025: atributos em janela de 3 s + kNN/SVM.
  - Medrano et al. 2014: detecção de novidade treinada só com o dia a dia do usuário. Boa ideia para trabalho futuro contra falsos positivos.

## Apêndice B: Armadilhas conhecidas (ler antes de depurar)
1. **Taxa de ~5 Hz no Android:** faltou `HIGH_SAMPLING_RATE_SENSORS` no `app.json`.
2. **Usar `DeviceMotion.acceleration`:** não tem gravidade, então todos os limiares quebram.
3. **Misturar m/s² e g:** PIPTO usa m/s²; Kangas e Bourke usam g. Converter **dentro** do detector e documentar.
4. **Filtros do Kangas:** os coeficientes só valem para 50 Hz.
5. **Celular caindo sozinho:** gera queda livre, impacto forte e "deitado". É um falso positivo quase perfeito. **Medir e reportar**, não esconder.
6. **Postura com celular no bolso da calça:** ao sentar, a coxa fica horizontal e parece "deitado". Espera-se muito falso positivo ao sentar com força.
7. **SisFall é cintura a 200 Hz e ±16 g:** decimar e saturar para simular o celular. Não comparar direto com o bolso.
8. **Tempo:** usar o `timestamp` nativo do sensor, nunca a hora de chegada no JS.
9. **Nunca** ajustar os limiares para "melhorar" o resultado e reportar como se fosse o algoritmo original. Se testar limiares ajustados, reportar à parte como "versão ajustada".
