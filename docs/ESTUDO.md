# Estudo de replicação: detecção de queda no celular (Mova)

**Pergunta:** algoritmos de detecção de queda publicados mantêm o desempenho relatado quando reimplementados e executados num smartphone comum, com o app Mova? Quantos falsos positivos geram?

- Pipeline completo e decisões: [`PIPELINE_ESTUDO_QUEDAS.md`](PIPELINE_ESTUDO_QUEDAS.md) (documento da equipe).
- Especificação implementada e status de cada parâmetro: [`ALGORITMOS.md`](ALGORITMOS.md).
- Resultados: [`../results/RESUMO.md`](../results/RESUMO.md).

## Estado das etapas

| Etapa | Status |
|---|---|
| 1. Conferir parâmetros nos PDFs | **pendente (equipe)**: preencher [`parametros_conferidos.md`](parametros_conferidos.md). O código usa os valores do pipeline; os do Bagalà já foram lidos no texto completo |
| 2. Projeto e módulo de detecção | feito: `src/detection/`, `app.json` com `HIGH_SAMPLING_RATE_SENSORS` e plugin `expo-sensors` |
| 3. A1 Kangas + testes | feito |
| 4. SisFall + replay | feito (espelho CSV; ver as notas da base) |
| 5. Avaliar A1 | feito |
| 6. A2 Bourke3 | feito |
| 7. A3 PIPTO + equivalência com o Python | feito |
| 8. Tela de coleta | feito: `src/screens/RecorderScreen.tsx` (link "Modo estudo" na 1ª tela do app). **Falta testar num aparelho real** |
| 9. Voluntários | pendente (equipe; ver a seção de ética) |
| 10. Análise do celular | script pronto (`scripts/analyze_phone.ts`), validado com sessão sintética |
| 11. Tabelas e figuras | tabela da SisFall em `results/RESUMO.md`; as do celular dependem da Etapa 9 |

## Como rodar

```bash
npm install
npm test            # testes unitários com sinais sintéticos (vitest)
npm run typecheck   # app + scripts
```

### Avaliação offline na SisFall

1. Baixe o espelho CSV (o site oficial está fora do ar):
   ```bash
   git clone --depth 1 https://github.com/krishna-karthikk/SisFall-Dataset /tmp/sisfall
   mkdir -p data && ln -s "/tmp/sisfall/Fall Detection csv" data/SisFall
   ```
2. Rode os detectores. Isso gera `results/sisfall_<variante>.csv` e `.md`:
   ```bash
   npx tsx scripts/replay.ts --dataset sisfall --detector all --dump-pipto data/cache/pipto50
   npx tsx scripts/replay.ts --dataset sisfall --detector all --clip none
   ```
   Opções de `--detector`: `legado`, `kangas`, `bourke3`, `pipto` ou `all`.
3. Faça a equivalência do PIPTO com o Python original. Requer `pandas` e `numpy`, e o código dos autores em `vendor/pipto`:
   ```bash
   git clone --depth 1 https://github.com/smoutsis/fall_detection_through_acceleration_data vendor/pipto
   python3 scripts/pipto_original.py cache  data/cache/pipto50 data/cache/pipto_python_50hz.json
   python3 scripts/pipto_original.py native data/SisFall       data/cache/pipto_python_200hz.json
   npx tsx scripts/pipto_equivalence.ts
   ```

### Coleta no celular (Etapa 8/9)

- **Use um development build** (`npx expo run:android` ou EAS), porque a permissão `HIGH_SAMPLING_RATE_SENSORS` só entra num build próprio. Anote no artigo qual build foi usado. O Expo Go já tem essa permissão, mas convém registrar a taxa medida.
- Abra o app e toque em **Modo estudo: coleta de quedas** na primeira tela.
- Siga esta ordem:
  1. Preencha o ID do voluntário, o modelo do aparelho e a posição.
  2. Toque em **Iniciar sessão**.
  3. Toque em **Calibrar** e fique 5 s em pé e parado.
  4. Escolha a atividade e toque em **Iniciar tentativa**. A tela trava; segure 2 s para destravar.
  5. Toque em **Parar tentativa**.
- Em quedas, toque em **Marcar instante** logo depois da queda, ou peça a um auxiliar que marque.
- **Checagens antes dos voluntários:**
  - a taxa medida aparece na tela e precisa ser ≥ 50 Hz;
  - com o celular parado na mesa, |a| deve ficar em 1,00 ± 0,05 g, o que se confere no `samples.csv`.
- Ao encerrar, exporte `samples.csv`, `events.csv`, `alarms.csv` e `session.json`. Os arquivos ficam em `Documentos/mova_estudo/<sessão>`.
- Para analisar, junte as pastas das sessões num diretório e rode:
  ```bash
  npx tsx scripts/analyze_phone.ts --sessions <pasta> --out results
  ```
  A primeira tabela de validação compara os alarmes ao vivo com o reprocessamento offline. Divergências indicam problema de implementação ou de tempo.
- **Limitação:** o `expo-sensors` para em segundo plano ou com a tela apagada. Por isso o app mantém a tela ligada (`expo-keep-awake`) e precisa ficar **aberto**.

### Ética (Etapa 9)

Não faça idosos caírem. As quedas são simuladas por voluntários jovens sobre colchão grosso. Consulte o orientador sobre o CEP/Plataforma Brasil e o TCLE **antes** da coleta.

## Notas sobre a base (espelho CSV da SisFall)

- O espelho tem **4396** tentativas (1744 quedas e 2652 ADLs). O artigo original descreve 4505 (conferir); citar a fonte oficial.
- A pasta `SA15` contém `D17_SE15_R01..R05.csv` com conteúdo **diferente** dos arquivos de `SE15`: são as tentativas D17 do SA15 com nome errado. O loader tira o sujeito da pasta.
- Entre os idosos, só o SE06 tem quedas. As métricas de "Idosos (SE)" são quase só especificidade.
