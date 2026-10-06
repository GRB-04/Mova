"""Roda o PIPTO ORIGINAL (vendor/pipto/python/def_fall.py, sem modificações) para o teste de equivalência.

Uso:
  python3 scripts/pipto_original.py cache  <dir_cache_50hz> <saida.json>
      Lê os CSVs (time,v) gerados por `replay.ts --dump-pipto` (mesmo sinal que o porte TS recebe, 50 Hz).
  python3 scripts/pipto_original.py native <dir_sisfall> <saida.json>
      Lê a SisFall bruta a 200 Hz (ADXL345 -> m/s^2), condição mais próxima da avaliada pelos autores.

Saída: {arquivo: [[entry_inicio, entry_impacto], ...] | "erro: ..."}
"""
import json
import math
import os
import sys

import pandas as pd

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "vendor", "pipto", "python"))
from def_fall import fall_detection  # noqa: E402

G = 9.807
ADXL_TO_G = 32 / 8192


def run(df, hz):
    try:
        return [[float(a), float(b)] for a, b in fall_detection(df, len(df), hz)]
    except Exception as e:  # o original pode lançar exceções; registramos em vez de abortar
        return f"erro: {type(e).__name__}: {e}"


def main():
    mode, src, out = sys.argv[1:4]
    res = {}
    if mode == "cache":
        for f in sorted(os.listdir(src)):
            df = pd.read_csv(os.path.join(src, f))
            res[f] = run(df, 50)
    elif mode == "native":
        for subj in sorted(os.listdir(src)):
            d = os.path.join(src, subj)
            if not os.path.isdir(d):
                continue
            for f in sorted(os.listdir(d)):
                v, t = [], []
                with open(os.path.join(d, f)) as fh:
                    for line in fh:
                        p = line.strip().rstrip(";").split(",")
                        if len(p) != 9:
                            continue
                        try:
                            x, y, z = (float(p[0]), float(p[1]), float(p[2]))
                        except ValueError:
                            continue
                        v.append(math.sqrt(x * x + y * y + z * z) * ADXL_TO_G * G)
                        t.append(len(t) / 200)
                res[f"{subj}/{f}"] = run(pd.DataFrame({"v": v, "time": t}), 200)
    else:
        raise SystemExit("modo deve ser 'cache' ou 'native'")
    with open(out, "w") as fh:
        json.dump(res, fh)
    print(f"{len(res)} arquivos -> {out}")


if __name__ == "__main__":
    main()
