import { createTerrainState, validateTerrainMap } from "@skymenders/terrain-core";
import type { TerrainMapDefinition, TerrainMapValidationReport } from "@skymenders/terrain-core";

import type { PveContentPack } from "@skymenders/content-schema";

type MapTemplate = PveContentPack["maps"]["maps"][number];

export function materializeMapTemplate(template: MapTemplate): TerrainMapDefinition {
  const terrain = createTerrainState({
    width: template.width,
    height: template.height,
    fills: [
      {
        x: 0,
        y: 0,
        width: template.width,
        height: template.floorY + 1,
        materialId: template.materialId,
      },
    ],
    supportRoots: template.fixedAnchorXs.map((value, index) => ({
      id: `${template.id}_anchor_${index}`,
      kind: "fixed_anchor",
      capacity: 100_000,
      x: Number(value),
      y: 0,
    })),
  });
  const navigationCells = Array.from({ length: template.width }, (_, x) => ({
    x,
    y: template.floorY + 1,
  }));
  return {
    mapId: template.id,
    terrain,
    playerSpawns: template.playerSpawns,
    enemySpawns: template.enemySpawns,
    objectives: [
      {
        id: `${template.id}_objective`,
        position: template.objectivePoint,
        supportCell: { x: template.objectivePoint.x, y: template.floorY },
        accessPoint: template.objectivePoint,
      },
    ],
    keyEngagementPoints: [template.objectivePoint],
    navigationCells,
    requiredCapabilities: template.requiredCapabilities,
    availableCapabilities: template.providedCapabilities,
    cameraBounds: {
      minimumX: 0,
      minimumY: 0,
      maximumX: template.width - 1,
      maximumY: template.height - 1,
    },
  };
}

export function validateAuthoredMaps(pack: PveContentPack): readonly TerrainMapValidationReport[] {
  return pack.maps.maps.map((template) => validateTerrainMap(materializeMapTemplate(template)));
}
