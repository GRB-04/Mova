# Resumo dos resultados: SisFall (simulação de celular)

Base e condição:
- **Base:** SisFall, espelho CSV, com **4396 tentativas**: 1744 quedas (F01–F15) e 2652 ADLs (D01–D19).
- **Participantes:** 23 jovens (SA) e 15 idosos (SE). Entre os idosos, só o SE06 tem quedas.
- **Sinal:** canal ADXL345, sensor na cintura.
- **Simulação do celular:**
  - anti-aliasing Butterworth de 4ª ordem causal;
  - decimação de 200 Hz para a taxa de cada detector;
  - saturação de ±8 g.

Pontuação por **arquivo**: numa queda, VP se houver ≥ 1 alarme; numa ADL, FP se houver ≥ 1 alarme. Os intervalos são IC 95% de Wilson.

Detalhes por atividade e funil de cada variante: `sisfall_<variante>.md`. Linhas por arquivo: `sisfall_<variante>.csv`. A especificação dos algoritmos e as adaptações estão em `docs/ALGORITMOS.md`.

> **Saturação:** rodar com ±8 g e sem saturação (`*_noclip`) deu **resultados idênticos** em todas as variantes. Depois do filtro, 141 das 1744 quedas passam de 8 g num eixo, mas todos os limiares de decisão são ≤ 3,1 g.

## Tabela principal (SisFall)

| Algoritmo | Publicado (SE / SP / FP) | Bagalà 2012 (quedas reais) | SisFall, esta reimplementação: SE % (IC95) | SP % (IC95) | F1 % |
|---|---|---|---|---|---|
| **A0 Mova legado** (\|a\| > 2,5 g, 10 Hz) | — | — | 67,5 (65,3–69,7) | 82,2 (80,7–83,6) | 69,4 |
| **A1 Kangas** (faithful, 4 sinais em OU) | SE 76–97%, SP 100% (lab) 🟡 | SE < 55%, < 9 alarmes falsos/dia | **92,9** (91,6–94,0) | **98,6** (98,0–99,0) | **95,2** |
| A1 Kangas (postura do Guardian: eixo z) | — | — | 30,0 (27,9–32,2) | 98,0 (97,4–98,5) | 45,1 |
| **A2 Bourke3** | SE 100%, SP 100%, 0,6 FP/dia 🟡 | SE 82,8%, SP 96,7%, ~5 alarmes falsos/dia | 57,9 (55,6–60,2) | **99,8** (99,5–99,9) | 73,2 |
| **A3 PIPTO** (original, gravação inteira) | acurácia > 97% na SisFall 🟡 | — | 80,9 (79,0–82,7) | 88,6 (87,3–89,7) | 81,6 |
| A3 PIPTO (adaptação para tempo real) | — | — | 84,3 (82,5–85,9) | 82,4 (80,9–83,8) | 79,8 |

Variantes para análise de sensibilidade:

| Variante | SE % | SP % | Comentário |
|---|---|---|---|
| Kangas faithful, só SV_TOT (provável 2a) | 89,3 | 99,0 | |
| Kangas faithful, só SV_D | 90,3 | 99,4 | |
| Kangas faithful, só SV_MaxMin | 90,8 | 98,8 | |
| Kangas faithful, só Z2 (2b) | 76,3 | 99,9 | coerente com o Bagalà: "Kangas2b … lowest sensitivity" |
| Bourke3 sem tempos de borda | 60,1 | 99,8 | as bordas eliminam pouco |
| Bourke3, velocidade em janela fixa de 1 s | 64,5 | 99,8 | |

## Jovens (SA) × idosos (SE)

| Algoritmo | SA: SE % | SA: SP % | SE: SE % (só SE06, n = 75) | SE: SP % (n = 893) |
|---|---|---|---|---|
| Mova legado | 68,2 | 76,9 | 52,0 | 92,5 |
| Kangas faithful | 93,6 | 98,9 | 77,3 | 97,9 |
| Bourke3 | 58,8 | 99,7 | 37,3 | 99,9 |
| PIPTO (original) | 82,1 | 84,3 | 53,3 | 97,0 |
| PIPTO (tempo real) | 85,6 | 76,4 | 54,7 | 94,2 |

Todos os algoritmos detectam **menos** as quedas do único idoso que caiu (SE06) do que as dos jovens. Com n = 75, o intervalo é largo.

## Funil por estágio: qual fase elimina os falsos positivos

Número de arquivos que chegaram a cada estágio.

| Algoritmo | Quedas (1744) | ADLs (2652) |
|---|---|---|
| Kangas faithful | início 1704 → impacto 1649 → postura 1649 → deitado **1620** | início 1299 → impacto 863 → postura 792 → deitado **38** |
| Bourke3 | impacto 1660 → bordas 1548 → velocidade **1082** → deitado 1010 | impacto 669 → bordas 584 → velocidade 463 → deitado **6** |
| PIPTO (original) | baixo 1729 → alto 1584 → par 1445 → duração 1443 → contexto 1411 | baixo 1468 → alto 535 → par 471 → duração 471 → contexto **303** |

O que o funil mostra:
- **A checagem de postura** (deitado depois do impacto) é o estágio que elimina os falsos positivos. No Kangas ela corta 792 → 38; no Bourke3, 463 → 6.
- **O PIPTO não tem checagem de orientação.** O critério dele, "repouso perto de g **ou** pico maior que os vizinhos", deixa passar muitas ADLs.
- **No Bourke3, o limiar de velocidade (−0,7 m/s) é o gargalo da sensibilidade:** perde 466 quedas. As quedas da SisFall, feitas por jovens sobre colchão, quase não têm queda livre sustentada. A integral de (SV − 1 g) fica acima de −0,7 m/s. É o mesmo fenômeno que o Bagalà relatou para os Kangas3 ("the velocity before the impact is often lower than the predetermined thresholds").

## Atividades que mais enganam (taxa de alarme por ADL)

| Algoritmo | ADLs com mais falso positivo |
|---|---|
| Mova legado | D04 100%, D06 98%, D19 93%, D03 92%, D18 65%, D11 28% |
| Kangas faithful | D14 13%, D13 5% (atividades que **começam ou terminam deitado**; a postura sozinha não distingue) |
| Bourke3 | nenhuma ADL ≥ 5% (6 FPs no total) |
| PIPTO (original) | D18 77%, D19 63%, D11 39%, D06 13%, D08 13% |
| PIPTO (tempo real) | D06 95%, D04 94%, D03 74%, D18 77%, D19 73%, D11 39% |

Códigos da SisFall (🟡 conferir na Tabela 1 do artigo):
- D03/D04: correr devagar/rápido.
- D06: subir e descer escada rápido.
- D11: tentar levantar e desabar na cadeira.
- D13: deitar rápido.
- D14: de costas, virar de lado e voltar.
- D18: tropeçar andando.
- D19: pular de leve.

Leituras:
- O detector **legado** dispara em praticamente toda corrida, escada rápida e pulo. Sem fase de queda livre nem de postura, qualquer impacto acima de 2,5 g vira alarme.
- O **PIPTO em tempo real** piora muito em corrida (D03, D04) e escada (D06). Com a janela de 10 s, o critério de contexto ("pico maior que os outros altos") fica fraco: na gravação inteira de 100 s havia muitos picos de corrida para comparar.
- **D11 e D18** (as "quase quedas") enganam o PIPTO e o legado. O Kangas e o Bourke3 rejeitam essas atividades pela postura.

## Equivalência do porte PIPTO com o Python original

O porte TS (`src/detection/pipto.ts`) foi comparado com o `def_fall.py` original dos autores, que rodou sem modificações. Detalhes em `pipto_equivalencia.md`.

| Condição | Arquivos iguais (±1 amostra) | Python original: SE % / SP % | Porte TS: SE % / SP % |
|---|---|---|---|
| 50 Hz, ±8 g (sinal do replay) | **4396 / 4396** | 80,9 / 88,6 | 80,9 / 88,6 |
| 200 Hz nativo, sem saturação | **4396 / 4396** | 81,3 / 86,9 | 81,3 / 86,9 |

O porte é equivalente ao original. Mesmo a 200 Hz, a taxa nativa da SisFall, o original **não** chega à acurácia de > 97% relatada pelos autores nessa base.

## Comparação com o publicado (o que dizer no artigo)

1. **Kangas** se saiu **melhor** na SisFall (SE 93%) do que no Bagalà (< 55% em quedas reais), e dentro da faixa do laboratório original (76–97%). A SisFall tem quedas simuladas por jovens, que terminam deitados; nas quedas reais, o idoso muitas vezes não fica deitado (Bagalà: "The LPF vertical signal rarely reaches values under 0.5 g").
2. **Bourke3** manteve a especificidade altíssima (99,8%), mas a sensibilidade **caiu muito**: 58% contra 100% no original e 83% no Bagalà. A causa é o limiar de velocidade, e nossa forma de calcular a velocidade é uma adaptação ⚠️, porque o método do original não foi confirmado. É candidato número um à conferência no PDF (Etapa 1).
3. **PIPTO** ficou bem abaixo da acurácia reportada na SisFall (> 97%): SE 81%, SP 89% a 50 Hz. Com o **código original dos autores a 200 Hz**, o resultado é SE 81%, SP 87%, ou seja, a queda de desempenho não vem do porte nem da decimação. A adaptação para tempo real piora a especificidade (82%). Uma diferença possível é o protocolo de pontuação dos autores, que deve ser conferido no artigo.
4. **A postura sozinha não é suficiente no celular:** o modo Guardian (eixo z) derruba a SE para 30% na SisFall, porque a orientação do sensor é outra. Isso antecipa o problema do celular no bolso.
5. **O detector antigo do Mova** tem SP de 82% e 46 alarmes por hora de ADL roteirizada. Isso justifica a troca.

> As ADLs da SisFall são roteirizadas e curtas. "Alarmes por hora" nelas **não** é taxa de vida real. A taxa de vida real virá do uso livre no celular (Etapa 9) e, opcionalmente, da LTMM (Etapa 12).

## Celular (Etapas 9–10)

_Pendente: depende da coleta com voluntários. Rodar `npx tsx scripts/analyze_phone.ts --sessions <pasta>`._
