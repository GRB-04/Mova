// Conjunto de detectores usado no estudo. O MESMO conjunto roda no app (RecorderScreen)
// e no reprocessamento offline das sessões do celular (scripts/analyze_phone.ts).
import { Detector } from "./types";
import { LegacyDetector } from "./legacy";
import { KangasDetector } from "./kangas";
import { Bourke3Detector } from "./bourke3";
import { PiptoDetector } from "./pipto";

export * from "./types";

export function createStudyDetectors(): Detector[] {
  return [
    new LegacyDetector(),
    new KangasDetector({ postureMode: "faithful" }),
    new KangasDetector({ postureMode: "guardian" }),
    new Bourke3Detector(),
    new PiptoDetector(),
  ];
}
