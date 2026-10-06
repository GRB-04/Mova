# Etapa 1: conferência dos parâmetros nos PDFs (preencher pela equipe)

Fontes: Bagalà 2012 (PLoS ONE, inclusive a **Tabela S1**), Kangas 2008 (*Gait & Posture*), Bourke 2010 (*J Biomech*) e Moutsis 2023 (*Sensors*).

Regras:
- Se um valor diferir do implementado, registre aqui. O agente então atualiza o código e roda o replay de novo.
- Se não encontrar o valor, escreva "não encontrado, mantém suposição".

Os valores do Bagalà marcados ✅ em `docs/ALGORITMOS.md` já foram lidos no texto completo. Falta conferir no **PDF original de cada algoritmo** e na Tabela S1.

## A1: Kangas 2008

| Parâmetro | Implementado | Conferido no PDF? | Valor no PDF / observação |
|---|---|---|---|
| Taxa / filtro (Butterworth 2ª ordem, 0,25 Hz) | 50 Hz | | |
| Início da queda: SV_TOT < | 0,6 g | | |
| Janela do impacto | 1 s | | |
| Impacto SV_TOT ≥ | 2,0 g | | |
| Impacto SV_D ≥ | 1,7 g | | |
| Impacto SV_MaxMin ≥ | 2,0 g | | |
| Impacto Z2 ≥ | 1,5 g | | |
| Qual sinal é o 2a e qual é o 2b | 2a = SV_TOT?, 2b = Z2 | | |
| Postura: atraso / janela / limiar | 2 s / 0,4 s / ≤ 0,5 g | | |
| Desempenho original (SE / SP, cintura) | SE 76–97%, SP 100% | | |
| Kangas 2015 (vida real): 12/15 quedas, 0,049 alarmes/h | — | | |

## A2: Bourke 2010 (Bourke3)

| Parâmetro | Implementado | Conferido no PDF? | Valor no PDF / observação |
|---|---|---|---|
| DOI do artigo | não confirmado | | |
| LFT / UFT | 0,65 / 2,8 g | | |
| Borda de descida ≤ | 600 ms | | |
| Borda de subida ≤ | 350 ms | | |
| Velocidade ≤ / como é calculada | −0,7 m/s / ∫(SV−1g) desde o último cruzamento de 1 g | | |
| Postura: janela, ângulo, fração | t+1..t+3 s, 60°, > 75% | | |
| Como o vetor gravidade é estimado | média móvel de 0,5 s | | |
| Taxa original | 100 Hz | | |
| Desempenho original (SE / SP / FP por dia) | 100% / 100% / 0,6 (Bagalà) × 94,6% / 0,94 (outra fonte) | | |

## A3: PIPTO

| Parâmetro | Implementado | Conferido no PDF? | Valor no PDF / observação |
|---|---|---|---|
| Limiares 6,5 m/s² e max(média, 20) + 10 | código | | |
| Desempenho na SisFall (acurácia, SE, SP) | "acima de 97%" | | |
| Taxa usada pelos autores na SisFall | ? | | |
| Divergência 99% de acurácia × SP de 85,9% | — | | |

## SisFall

| Item | Implementado | Conferido? | Observação |
|---|---|---|---|
| ADXL345: g = raw·32/8192 | sim | | Readme oficial |
| Idade dos idosos (60–75?) | — | | |
| Descrição de D01–D19 e F01–F15 (usada em `results/RESUMO.md`) | de memória | | Tabela 1 do artigo |
| Nº oficial de arquivos (4505?) × espelho (4396) | — | | |
