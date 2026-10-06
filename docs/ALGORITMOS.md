# Especificação implementada dos algoritmos (estudo de replicação Mova)

Este documento registra **exatamente** o que foi implementado em `src/detection/`, de onde veio cada parâmetro e quais decisões são adaptações nossas. É a base da seção de Métodos do artigo.

Legenda de status:
- ✅ **lido na fonte**: texto do artigo ou código dos autores, lido nesta implementação.
- 🟡 **fonte secundária**: precisa ser conferido no PDF original (Etapa 1, `docs/parametros_conferidos.md`).
- ⚠️ **adaptação nossa**: não está em nenhuma fonte; deve ser declarada no artigo.

Fontes lidas durante a implementação:
- Bagalà et al. 2012, texto completo (cópia em `raw.githubusercontent.com/cstahmer/text_mining_with_r/.../0037062.txt`). Os símbolos matemáticos se perderam nessa cópia.
- Porte Guardian do Kangas (`altermarkive/guardian/Detector.kt`, MIT).
- Código oficial do PIPTO (`github.com/smoutsis/fall_detection_through_acceleration_data`, commit `c0f7aa2`), `python/def_fall.py` lido linha a linha. **O repositório não tem arquivo de licença**: por isso ele fica em `vendor/` (fora do git) e o porte TS é uma reimplementação para fins de pesquisa, com citação.
- Código-fonte do `expo-sensors` 57.0.x instalado (`SensorSubscription.kt`, `AccelerometerModule.kt`, `AccelerometerModule.swift`).

## Convenções comuns

| Item | Decisão | Status |
|---|---|---|
| Unidade | g com gravidade (repouso ≈ 1 g). PIPTO converte para m/s² internamente (×9,807, valor dos autores) | ✅ |
| Tempo | segundos, a partir do `timestamp` nativo do sensor (não a hora de chegada no JS) | ✅ (doc. Expo) |
| Reamostragem | cada detector reamostra a entrada por interpolação linear para a própria taxa (`resample.ts`), como o Guardian | ⚠️ |
| Taxas | Kangas 50 Hz; Bourke3 100 Hz; PIPTO 50 Hz; legado 10 Hz | ver abaixo |
| Referência "em pé" | celular: média do acelerômetro em 5 s de calibração em pé. SisFall: vetor fixo `[0, −1, 0]` (orientação de montagem do sensor na cintura: em pé, eixo y ≈ −1 g, conferido nos dados) | ⚠️ |

## A0: detector anterior do Mova (linha de base) — `legacy.ts`

Reproduz o `SeniorScreen.tsx` original: `Accelerometer.setUpdateInterval(100)` e alarme quando |a| > 2,5 g. Não tem fase de queda livre nem de postura. Depois de um alarme, o app espera a resposta do idoso por até 30 s; isso foi modelado como período refratário de 30 s ⚠️.

## A1: Kangas et al. 2008, algoritmo 2 — `kangas.ts`

| Parâmetro | Valor | Status |
|---|---|---|
| Taxa | 50 Hz (grade de 20 ms) | 🟡 Guardian |
| Filtros | Butterworth 2ª ordem, corte 0,25 Hz, coeficientes do Guardian (válidos só a 50 Hz) | 🟡 Guardian |
| Início dos filtros | estado inicializado em regime permanente na 1ª amostra, em vez de zero. Elimina o transitório de ~8 s. O modo Guardian literal está disponível com `primeFilters: false` | ⚠️ |
| SV_TOT, SV_D, SV_MaxMin (janela de 5 amostras = 0,1 s), Z2 = (SV_TOT² − SV_D² − 1)/2 | como no Guardian | ✅ Guardian / 🟡 original |
| Início da queda | SV_TOT cruza para baixo de 0,6 g | ✅ Bagalà |
| Janela do impacto | 1 s após o início | ✅ Bagalà |
| Limiares de impacto | SV_TOT ≥ 2,0; SV_D ≥ 1,7; SV_MaxMin ≥ 2,0; Z2 ≥ 1,5 g (combinados com OU) | ✅ Guardian / 🟡 original |
| Postura | 2 s após a **última** amostra de impacto; média de 0,4 s (20 amostras); deitado se ≤ 0,5 g | ✅ Bagalà ("0.4 second", "0.5 g or lower") |
| Refratário | 10 s | ⚠️ |

**Variantes 2a/2b:** o Bagalà diz que o Kangas2b, como 1d e 3b, usa a aceleração vertical (Z2), porque "Kangas1d, Kangas2b, Kangas3b … lowest sensitivity values due to the high threshold set for this parameter". Então **2b = Z2** (✅, por dedução do texto) e **2a = provavelmente SV_TOT** (🟡). As duas estão disponíveis como `kangas-faithful-SVTOT` e `kangas-faithful-Z2`. A variante principal é `kangas-faithful`, com os 4 sinais em OU, como no Guardian.

**Modos de postura:**
- `faithful`: componente do LPF ao longo de `u_up` calibrado.
- `guardian`: média do eixo z do aparelho > 0,5 g. É o comportamento do porte aberto, que só funciona com o celular em pé na cintura e a tela para fora.

## A2: Bourke et al. 2010, "Bourke3" — `bourke3.ts`

| Parâmetro | Valor | Status |
|---|---|---|
| LFT / UFT | 0,65 g / 2,8 g | ✅ Bagalà ("the SV exceeds the LFT (0.65 g) and the UFT (2.8 g)") |
| Tempo da borda de descida | do último SV < LFT até SV > UFT, ≤ 600 ms | ✅ valor (Bagalà); ⚠️ direção "≤" |
| Tempo da borda de subida | da última vez que SV passa LFT até SV > UFT, ≤ 350 ms | ✅ valor (Bagalà); ⚠️ direção "≤" |
| Velocidade vertical | ≤ −0,7 m/s | ✅ Bagalà |
| Cálculo da velocidade | mínimo de ∫(SV − 1 g)·9,80665·dt, do último cruzamento de 1 g para baixo antes do início da queda (no máximo 1 s antes do impacto) até o impacto. Variante `fixed-1s` para análise de sensibilidade | ⚠️ |
| Postura | ângulo entre o vetor gravidade atual (média móvel de 0,5 s ⚠️) e a referência em pé > 60° em mais de 75% das amostras de t+1 s a t+3 s | ✅ Bagalà |
| Taxa | 100 Hz | ⚠️ (Bagalà: "50 a 250 Hz") |
| Refratário | novos cruzamentos de UFT são ignorados até t+3 s (candidato aceito) ou t+0,5 s (rejeitado) | ⚠️ |

O Bagalà relata para o original **0,6 falso positivo/dia** e SE = SP = 100% em quedas simuladas. A outra fonte citada no pipeline (SE 94,6%, 0,94 FP/dia) precisa ser conferida no PDF.

## A3: PIPTO (Moutsis et al. 2023) — `pipto.ts`

`piptoOffline()` é um **porte linha a linha** de `fall_detection()` (`def_fall.py`). A equivalência foi verificada contra o Python original (ver `results/pipto_equivalencia.md`).

| Parâmetro | Valor no código | Interpretação | Status |
|---|---|---|---|
| `min_limit` | 6,5 m/s² | ≈ 0,66 g | ✅ |
| `max_limit` | max(média da gravação, 20) + 10 m/s² | ≥ 30 m/s² ≈ 3,06 g | ✅ |
| Eixo `entry` | `entry[i] = (time[i]−time[i−1])/10 + entry[i−1] + 100/hz` | com tempo em **segundos**, o 1º termo é desprezível (Δt/10), e cada amostra avança 100/hz. **1 unidade ≈ 10 ms, qualquer que seja a taxa** | ✅ (verificado com o `m_analyse_1_csv_in_def_2.py` dos autores, que gera tempo em segundos a 100 Hz) |
| `sub_1` | 50 | 0,5 s para separar grupos de extremos | ✅ |
| `fall_duration` | 105 | 1,05 s entre queda livre e impacto | ✅ |
| `fall_limitation` | 85 | 0,85 s | ✅ |
| `dist_1`, `dist_2` | 100 | **sem efeito**, ver o comportamento 2 abaixo | ✅ |
| Repouso pós-queda | média em (g−2, g+2), desvio padrão < 2, mais de 20 amostras | | ✅ |

**Comportamentos não óbvios do original, mantidos no porte** (marcados `QUIRK` no código):
1. No Check 3, `v_after_fall` não é zerada entre candidatos: acumula ao longo dos candidatos da mesma gravação.
2. Os laços que calculam `j1`/`j2` testam uma condição que não depende de `j` e é sempre falsa. Por isso o "contexto" usado para comparar picos é a **gravação inteira**: `dist_1`/`dist_2` não têm efeito.
3. `max_v` percorre a partir de `índice_início − 1`. Se o início for a amostra 0, o Python lê `v[-1]`, que é a **última** amostra.
4. A variável `indexx` do Check 1 persiste entre iterações.

**Adaptação para tempo real (`PiptoDetector`, ⚠️ obrigatória):** o original precisa da gravação inteira (média global e contexto global). No app:
- buffer deslizante de 10 s;
- a cada 0,5 s, o original roda sobre o buffer;
- uma queda é aceita só quando o impacto tem pelo menos 2 s, para haver dado pós-queda;
- quedas a menos de 2 s de uma já emitida são deduplicadas.

O efeito dessa adaptação é medido comparando `pipto` (offline, gravação inteira) com `pipto-streaming`.

**Taxa:** como o eixo `entry` é normalizado por `hz`, os limites de tempo valem para qualquer taxa. O critério "> 20 amostras" depende da taxa. Usamos 50 Hz (a taxa garantida no celular) e também rodamos o original a 200 Hz nativos da SisFall, como referência.

## Simulação do celular a partir da SisFall (`scripts/lib/dsp.ts`)

| Passo | Decisão | Status |
|---|---|---|
| Canal | ADXL345, `g = raw·32/8192` | 🟡 (loaders `Dawn2310/Fall-detection-multidataset` e afins). Conferido: ADXL e MMA8451Q (`raw·16/16384`) dão ≈ 1 g em repouso |
| Anti-aliasing | Butterworth de 4ª ordem **causal**, corte 0,4·fs de destino (20 Hz para 50 Hz, 40 Hz para 100 Hz) | ⚠️ |
| Decimação | 200 → 50 Hz (Kangas, PIPTO) ou 100 Hz (Bourke3). Legado: amostragem pontual a 10 Hz do sinal filtrado a 20 Hz | ⚠️ |
| Saturação | ±8 g por eixo; também rodado sem saturação | ⚠️ |
| Posição | cintura, que equivale a celular no cinto/pochete, **não** a bolso | — |

## Fatos verificados no `expo-sensors` 57 (código-fonte instalado)

- **Android, sem `HIGH_SAMPLING_RATE_SENSORS`:** o sensor é registrado com `SENSOR_DELAY_NORMAL`. Com a permissão, usa `SENSOR_DELAY_FASTEST` (`SensorSubscription.kt`). A permissão foi adicionada ao `app.json`.
- **Android, intervalo de envio:** só envia um evento se `agora − último > updateInterval` (comparação estrita). O padrão é 100 ms. O app de coleta pede 15 ms.
- **Unidades:** o Android divide por `GRAVITY_EARTH` (sai em g) e o iOS envia o valor do CoreMotion (g). Os eixos têm sinais opostos entre plataformas; a magnitude não muda e a calibração absorve a diferença.
- **`timestamp`:** Android = `SensorEvent.timestamp`/1e9 (segundos desde o boot); iOS = `CMAccelerometerData.timestamp`.
- **Detector antigo:** lia a cada 100 ms, isto é, **≤ 10 Hz** mesmo com a permissão. Sem a permissão, em build próprio, a taxa era ainda menor. Isso explica parte do desempenho ruim.
