# Planejamento: preparar o terreno para o artigo

Decisão da equipe (06/10/2026):
- **o artigo ainda não será escrito**; agora é preparar dados, testes e figuras;
- seguir o **Escopo A** (bases públicas, sem voluntários);
- partir para o **Escopo B** (teste no celular com pessoas comuns, sem idosos) se houver tempo;
- formato e periódico ainda não definidos (trabalho de faculdade).

Achados já verificados: [`ACHADOS.md`](ACHADOS.md). Status dos parâmetros: [`parametros_conferidos.md`](parametros_conferidos.md).

---

## 1. O que dá e o que não dá para fazer

### ✅ Dá para fazer (código e análise, sem depender de ninguém)

| # | O quê | Por que importa para o artigo | Esforço |
|---|---|---|---|
| C1 ✅ | **Estatística entre algoritmos:** McNemar pareado (os mesmos arquivos para todos) e IC por *bootstrap* por participante. Os arquivos de uma mesma pessoa não são independentes | Permite dizer "o Kangas é melhor que o PIPTO" com significância, e não só "o número é maior" | pequeno |
| C2 | **Script único de reprodução** (`npm run estudo`): baixa a base, roda o replay, a equivalência e as figuras | Reprodutibilidade, que é o ponto central de um estudo de replicação | pequeno |
| C3 | **Figuras do artigo:** funil por estágio, FP por atividade, SE por tipo de queda, exemplo de sinal (queda × "celular caiu") | Resultados visuais prontos | médio |
| C4 ✅ | **Robustez à taxa de amostragem:** rodar a 10, 25, 50 e 100 Hz | Responde "quanto o celular pode ser lento?" (o detector antigo lia a ≤ 10 Hz) | pequeno |
| C5 ✅ | **Robustez à faixa do sensor:** saturar em ±2 g e ±4 g, além de ±8 g | Celulares antigos ou econômicos; o Bagalà excluiu quedas saturadas | pequeno |
| C6 ✅ | **Robustez à orientação:** girar o sinal aleatoriamente para simular celular no bolso em qualquer posição, com e sem calibração | Mostra quanto a postura depende da orientação (Achado 12) sem precisar de dados de bolso | médio |
| C7 ✅ | **LTMM: alarmes falsos por dia em vida real de idosos.** 71 gravações domiciliares; baixar 5–10 registros (acessível daqui) | É a métrica que mais importa na prática; compara com 0,6/dia (Bourke) e ~5/dia (Bagalà) | médio |
| C8 | **Pontuação no critério dos autores do PIPTO** (cada detecção extra = FP), além da nossa por arquivo | Comparação justa com os números publicados (Achado 5) | pequeno |
| C9 | **Análise de erro:** listar as quedas perdidas e as ADLs com alarme, com o estágio em que cada uma passou ou falhou | Base da Discussão; acha padrões | pequeno |
| C10 | **Versões "ajustadas", reportadas à parte**, por exemplo PIPTO + checagem de postura, ou limiares por curva ROC com validação deixando um participante de fora | Contribuição própria ("como reduzir FP"), separada da replicação | médio |
| C11 | **Repetir a avaliação quando chegarem os PDFs** (Kangas 2008, Bourke 2010, Tabela S1) | Fecha os parâmetros ⚠️ | pequeno (depois dos PDFs) |

### ⚠️ Dá, mas depende da equipe

| # | O quê | Depende de |
|---|---|---|
| E1 | Conferir Kangas 2008, Bourke 2010 e Tabela S1 | PDFs via CAPES/biblioteca |
| E2 | Avaliar na **UMAFall** (celular no bolso + cintura) | Baixar o zip do figshare (bloqueado aqui) |
| E3 | Avaliar na **KFall** (comparação direta com o PIPTO) ou na **MobiAct** (bolso) | Pedir acesso aos autores |
| E4 | Testar o app num celular real: taxa medida, celular parado, **celular caindo no chão e jogado no sofá** (não envolve pessoas) | Um aparelho Android + development build |
| E5 | Escopo B: tentativas com voluntários (pessoas comuns) | Conversar com o orientador sobre o CEP **antes** de coletar |

### ❌ Não dá (ou não deve ser feito)

| O quê | Por quê |
|---|---|
| Testar com quedas reais de idosos | Não é ético provocar quedas; as bases com quedas reais (FARSEEING) são de acesso restrito |
| Rodar o app num celular a partir deste ambiente | Não há aparelho aqui; a taxa real e o comportamento do sensor só se medem no celular |
| Baixar de PLoS, figshare ou CAPES daqui | Bloqueado pela rede deste ambiente (ou pago) |
| Monitorar em segundo plano com o Expo atual | O `expo-sensors` para em segundo plano; exigiria um módulo nativo (trabalho futuro) |
| Ajustar limiares e chamar o resultado de "algoritmo original" | Invalida a replicação; versões ajustadas vão sempre em seção separada (C10) |
| Afirmar desempenho "no bolso" a partir da SisFall | A SisFall é cintura; o bolso só com UMAFall ou MobiAct (E2/E3) ou com coleta (E5) |

---

> Feito em 06/10/2026: C1, C4, C5, C6 e C7 (ver `METODOLOGIA_ANALISES.md` e os Achados 24–31). Próximo passo da equipe: **teste no celular real** (E4).

## 2. Curto prazo: próximas 2 semanas (Escopo A)

| Ordem | Tarefa | Quem |
|---|---|---|
| 1 | C1 estatística + C8 pontuação dos autores + C9 análise de erro | agente |
| 2 | C4 taxa + C5 faixa (robustez do "celular") | agente |
| 3 | C3 figuras | agente |
| 4 | C2 script único de reprodução | agente |
| 5 | E1 PDFs → C11 rodar de novo com os parâmetros conferidos | equipe → agente |
| 6 | C7 LTMM (alarmes falsos por dia) | agente |
| 7 | E4 teste do app num celular, sem pessoas | equipe |

**Entregável do curto prazo:** a pasta `results/` com tabelas e figuras finais da SisFall e da LTMM, robustez a taxa e faixa, estatística, e o app validado num aparelho.

## 3. Longo prazo: depois do curto prazo, se houver tempo

| Fase | Tarefa | Depende de |
|---|---|---|
| L1 | C6 robustez à orientação + E2 UMAFall (bolso × cintura) | download da UMAFall |
| L2 | C10 versões ajustadas para reduzir FP (contribuição própria) | L1 |
| L3 | Escopo B: CEP → protocolo → coleta com 3–5 voluntários (cinto e bolso, quedas no colchão, ADLs, celular caindo, 2–4 h de uso livre) → `analyze_phone.ts` | orientador/CEP |
| L4 | Trabalho futuro do produto: usar o melhor detector no `SeniorScreen`; módulo nativo para monitorar em segundo plano | fora do escopo do artigo |
| L5 | Escrever o artigo | definição de formato e prazo |
