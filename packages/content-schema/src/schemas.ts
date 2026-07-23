import { z } from "zod";

export const CONTENT_SCHEMA_VERSION = "1.0.0";
export const PVE_CONTENT_VERSION = "0.2.0";

export const RELEASE_CONTENT_MINIMUMS = Object.freeze({
  battleMaps: 24,
  engineeringMaps: 12,
  eliteMaps: 8,
  events: 30,
  workshopServices: 8,
  environmentMechanics: 8,
  hiddenObjectives: 20,
  cosmetics: 12,
});

const id = z
  .string()
  .regex(/^[a-z][a-z0-9_]*$/)
  .max(96);
const key = z
  .string()
  .regex(/^[a-z][a-z0-9_.]*$/)
  .max(160);
const version = z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
const positiveInt = z.number().int().positive();
const nonNegativeInt = z.number().int().nonnegative();
const uniqueStrings = <T extends z.ZodType<string>>(item: T) =>
  z.array(item).superRefine((values, context) => {
    if (new Set(values).size !== values.length) {
      context.addIssue({ code: "custom", message: "values must be unique" });
    }
  });

export const moduleIdSchema = z.enum([
  "main_fold_bridge",
  "main_drill_bee",
  "main_magnetic_anchor",
  "main_gravity_pin",
  "main_bubble_capsule",
  "main_wind_generator",
  "main_support_frame",
  "main_energy_rail",
  "aux_repair_spray",
  "aux_reflector",
  "aux_ejector",
  "aux_stabilizer",
  "aux_route_scanner",
  "aux_energy_recycler",
  "aux_grapple",
  "aux_terrain_foam",
  "aux_jammer",
  "aux_structure_scanner",
]);

export const robotIdSchema = z.enum([
  "robot_rivet",
  "robot_anchor",
  "robot_gale",
  "robot_prism",
  "robot_forge",
  "robot_echo",
]);

export const enemyIdSchema = z.enum([
  "enemy_scout",
  "enemy_guard",
  "enemy_artillery",
  "enemy_driller",
  "enemy_magnet",
  "enemy_repairer",
  "enemy_wind",
  "enemy_carrier",
]);

export const bossIdSchema = z.enum([
  "boss_rift_drill",
  "boss_polar_magnetic_tower",
  "boss_inverted_controller",
  "boss_unbound_island_mainframe",
]);

export const nodeTypeSchema = z.enum([
  "battle",
  "engineering",
  "elite",
  "event",
  "workshop",
  "supply",
  "boss",
]);

export const objectiveTriggerSchema = z.enum([
  "repair_energy_tower",
  "deliver_energy_core",
  "rescue_unit",
  "hold_round",
  "defeat_guard",
  "preserve_island",
  "close_pollution_node",
  "no_robot_disabled",
  "terrain_integrity",
  "round_limit",
  "module_category_avoided",
  "extra_rescue",
  "pollution_cleared",
  "magnetic_collision",
  "rescue_without_attack",
  "hidden_pipeline_repaired",
  "reflected_hit",
  "relic_preserved",
  "multi_magnetic_collision",
  "all_rescues_completed",
  "primary_modules_avoided",
  "energy_reserve_maintained",
  "collapse_avoided",
  "bridge_preserved",
  "crystal_energy_collected",
  "wind_redirected",
  "gravity_restored",
  "carrier_intercepted",
  "repair_chain_completed",
  "fall_damage_avoided",
  "support_network_completed",
  "distinct_modules_used",
  "stabilized_early",
]);

const catalogHeader = z.object({
  schemaVersion: z.literal(CONTENT_SCHEMA_VERSION),
  contentVersion: version,
});

export const robotCatalogSchema = catalogHeader
  .extend({
    robots: z
      .array(
        z
          .object({
            id: robotIdSchema,
            nameKey: key,
            roleKey: key,
            passiveKey: key,
            skillKey: key,
            mainModuleId: moduleIdSchema,
            auxiliaryModuleIds: z.tuple([moduleIdSchema, moduleIdSchema]),
            unlockCost: nonNegativeInt.max(100),
            strategyTags: uniqueStrings(id).min(2).max(5),
          })
          .strict(),
      )
      .length(6),
  })
  .strict();

export const moduleCatalogSchema = catalogHeader
  .extend({
    modules: z
      .array(
        z
          .object({
            id: moduleIdSchema,
            nameKey: key,
            descriptionKey: key,
            class: z.enum(["main", "auxiliary"]),
            unlockCost: nonNegativeInt.max(100),
            rewardTags: uniqueStrings(id).min(2).max(5),
            routes: z
              .tuple([
                z.object({ id, nameKey: key, mechanismKey: key, conditionKey: key }).strict(),
                z.object({ id, nameKey: key, mechanismKey: key, conditionKey: key }).strict(),
              ])
              .superRefine((routes, context) => {
                if (routes[0].id === routes[1].id) {
                  context.addIssue({ code: "custom", message: "upgrade routes must be distinct" });
                }
              }),
          })
          .strict(),
      )
      .length(18),
  })
  .strict();

export const enemyCatalogSchema = catalogHeader
  .extend({
    enemies: z
      .array(
        z
          .object({
            id: enemyIdSchema,
            nameKey: key,
            roleKey: key,
            regionIntroduced: z.number().int().min(1).max(4),
            encounterTags: uniqueStrings(id).min(2).max(5),
          })
          .strict(),
      )
      .length(8),
  })
  .strict();

export const bossCatalogSchema = catalogHeader
  .extend({
    bosses: z
      .array(
        z
          .object({
            id: bossIdSchema,
            nameKey: key,
            regionIndex: z.number().int().min(1).max(4),
            mapId: id,
            stageKeys: z.tuple([key, key, key]),
            solutionTags: z.tuple([id, id]),
          })
          .strict(),
      )
      .length(4),
  })
  .strict();

export const objectiveCatalogSchema = catalogHeader
  .extend({
    objectives: z.array(
      z
        .object({
          id,
          role: z.enum(["primary", "secondary", "hidden"]),
          trigger: objectiveTriggerSchema,
          nameKey: key,
          descriptionKey: key,
          required: positiveInt.max(1_000),
          criticalInteractionEnergyCost: z.literal(0),
          requiredCapability: id.nullable(),
          rewardResearch: nonNegativeInt.max(100),
        })
        .strict(),
    ),
  })
  .strict();

const pointSchema = z.object({ x: nonNegativeInt.max(63), y: nonNegativeInt.max(31) }).strict();

export const mapCatalogSchema = catalogHeader
  .extend({
    maps: z
      .array(
        z
          .object({
            id,
            regionId: id,
            nameKey: key,
            nodeTypes: uniqueStrings(nodeTypeSchema).length(1),
            width: z.number().int().min(16).max(64),
            height: z.number().int().min(8).max(32),
            floorY: z.number().int().min(1).max(15),
            materialId: z.enum([
              "terrain_cloud_soil",
              "terrain_alloy_frame",
              "terrain_energy_crystal",
              "terrain_elastic_moss",
            ]),
            playerSpawns: z.tuple([pointSchema, pointSchema, pointSchema]),
            enemySpawns: z.array(pointSchema).min(1).max(8),
            objectivePoint: pointSchema,
            fixedAnchorXs: uniqueStrings(z.string().regex(/^\d+$/)).min(2),
            providedCapabilities: uniqueStrings(id),
            requiredCapabilities: uniqueStrings(id),
            primaryObjectiveIds: uniqueStrings(id).min(2),
            secondaryObjectiveIds: uniqueStrings(id).min(2),
            hiddenObjectiveIds: uniqueStrings(id).min(2),
            variationSlots: z
              .array(z.enum(["material", "height", "weak_point", "hazard", "device"]))
              .min(2),
          })
          .strict(),
      )
      .min(48),
  })
  .strict();

const environmentMechanicSchema = z
  .object({
    id,
    kind: z.enum([
      "wind_shift",
      "gravity_pulse",
      "magnetic_surge",
      "crystal_overload",
      "elastic_rebound",
      "support_fatigue",
      "repair_current",
      "pollution_spread",
    ]),
    intensityPermille: z.number().int().min(50).max(1_000),
    periodRounds: z.number().int().min(1).max(8),
  })
  .strict();

export const regionCatalogSchema = catalogHeader
  .extend({
    regions: z
      .array(
        z
          .object({
            id,
            index: z.number().int().min(1).max(4),
            nameKey: key,
            environmentKey: key,
            bossId: bossIdSchema,
            mapIds: uniqueStrings(id).min(12),
            enemyPool: uniqueStrings(enemyIdSchema).min(4),
            nodePool: uniqueStrings(nodeTypeSchema).min(5),
            windPermille: z.number().int().min(-1000).max(1000),
            gravityPermille: z.number().int().min(500).max(1500),
            environmentMechanics: z.array(environmentMechanicSchema).length(2),
          })
          .strict(),
      )
      .length(4),
  })
  .strict();

const eventEffectSchema = z
  .object({
    kind: z.enum([
      "research",
      "repair_hp",
      "repair_structure",
      "energy_supply",
      "reveal_route",
      "grant_consumable",
      "trade_research",
    ]),
    amount: z.number().int().min(-100).max(100),
  })
  .strict();

export const eventCatalogSchema = catalogHeader
  .extend({
    events: z
      .array(
        z
          .object({
            id,
            titleKey: key,
            bodyKey: key,
            regionIds: uniqueStrings(id).min(1),
            choices: z
              .array(
                z
                  .object({ id, labelKey: key, effects: z.array(eventEffectSchema).min(1) })
                  .strict(),
              )
              .min(2)
              .max(3),
          })
          .strict(),
      )
      .min(30),
  })
  .strict();

export const routeCatalogSchema = catalogHeader
  .extend({
    route: z
      .object({
        actualNodesPerRegion: z.literal(3),
        candidateNodesPerRegion: z.tuple([z.literal(4), z.literal(6)]),
        rewardChoices: z.literal(3),
        maximumNodeRestarts: z.literal(1),
        defaultEnergyMaximum: z.literal(12),
        defaultEnergyRegeneration: z.literal(6),
        targetDurationMinutes: z.tuple([z.literal(35), z.literal(45)]),
        nodeDurationMinutes: z
          .object({
            battle: positiveInt,
            engineering: positiveInt,
            elite: positiveInt,
            event: positiveInt,
            workshop: positiveInt,
            supply: positiveInt,
            boss: positiveInt,
          })
          .strict(),
      })
      .strict(),
    rewardPool: z.array(
      z
        .object({
          id,
          kind: z.enum(["module", "upgrade", "temporary_mod", "consumable", "intel"]),
          moduleId: moduleIdSchema.nullable(),
          routeId: id.nullable(),
          nameKey: key,
          tags: uniqueStrings(id).min(1),
          rarity: z.enum(["common", "uncommon", "rare"]),
          temporaryEffect: z
            .object({
              kind: z.enum([
                "movement_efficiency_permille",
                "energy_maximum_bonus",
                "fall_damage_reduction_permille",
                "repair_efficiency_permille",
              ]),
              amount: positiveInt.max(1_000),
            })
            .strict()
            .optional(),
        })
        .strict()
        .superRefine((reward, context) => {
          if (reward.kind === "temporary_mod" && reward.temporaryEffect === undefined)
            context.addIssue({ code: "custom", message: "temporary mods require an effect" });
          if (reward.kind !== "temporary_mod" && reward.temporaryEffect !== undefined)
            context.addIssue({ code: "custom", message: "only temporary mods can define effects" });
        }),
    ),
    workshopServices: z
      .array(
        z
          .object({
            id,
            nameKey: key,
            cost: positiveInt.max(100),
            kind: z.enum(["repair_hp", "repair_structure", "install_module", "upgrade_module"]),
            amount: positiveInt.max(100),
            scope: z.enum(["target", "squad"]),
          })
          .strict()
          .superRefine((service, context) => {
            if (
              service.scope === "squad" &&
              service.kind !== "repair_hp" &&
              service.kind !== "repair_structure"
            )
              context.addIssue({
                code: "custom",
                message: "squad workshop services must repair hp or structure",
              });
          }),
      )
      .min(8),
  })
  .strict();

export const tutorialCatalogSchema = catalogHeader
  .extend({
    tutorials: z
      .array(
        z
          .object({
            id,
            order: z.number().int().min(1).max(6),
            nameKey: key,
            estimatedMinutes: z.number().int().min(2).max(4),
            unlocks: z.array(id),
            steps: z
              .array(
                z
                  .object({
                    id,
                    instructionKey: key,
                    validation: z.enum([
                      "select_actor",
                      "move_actor",
                      "inspect_camera",
                      "confirm_shot",
                      "destroy_terrain",
                      "restore_support",
                      "build_structure",
                      "repair_target",
                      "choose_action_order",
                      "spend_shared_energy",
                      "choose_route",
                      "complete_node",
                      "choose_reward",
                    ]),
                    skippableText: z.boolean(),
                    requiredAction: z.literal(true),
                  })
                  .strict(),
              )
              .min(3)
              .max(8),
          })
          .strict(),
      )
      .length(6),
  })
  .strict();

export const progressionCatalogSchema = catalogHeader
  .extend({
    initialRobotIds: z.tuple([robotIdSchema, robotIdSchema, robotIdSchema]),
    initialModuleIds: uniqueStrings(moduleIdSchema).min(6),
    initialRegionIds: z.tuple([id]),
    cosmetics: z
      .array(
        z
          .object({
            id,
            robotId: robotIdSchema,
            nameKey: key,
            palette: z.enum(["sky", "forge", "moss", "crystal", "storm", "archive"]),
            pattern: z.enum(["solid", "stripe", "riveted", "circuit", "cloud", "chevron"]),
          })
          .strict(),
      )
      .length(12),
    unlocks: z.array(
      z
        .object({
          id,
          kind: z.enum([
            "robot",
            "module",
            "upgrade_route",
            "region",
            "event",
            "map",
            "difficulty",
            "cosmetic",
          ]),
          targetId: id,
          researchCost: nonNegativeInt.max(250),
          prerequisites: uniqueStrings(id),
        })
        .strict(),
    ),
    achievements: z
      .array(
        z
          .object({ id, nameKey: key, descriptionKey: key, metric: id, threshold: positiveInt })
          .strict(),
      )
      .min(18),
    compendiumEntries: z
      .array(
        z
          .object({
            id,
            category: z.enum(["robot", "module", "enemy", "boss", "region", "lore"]),
            nameKey: key,
            bodyKey: key,
          })
          .strict(),
      )
      .min(40),
  })
  .strict();

export const localizationCatalogSchema = z.record(key, z.string().min(1).max(500));

export const catalogSchemas = {
  bosses: bossCatalogSchema,
  enemies: enemyCatalogSchema,
  events: eventCatalogSchema,
  maps: mapCatalogSchema,
  modules: moduleCatalogSchema,
  objectives: objectiveCatalogSchema,
  progression: progressionCatalogSchema,
  regions: regionCatalogSchema,
  robots: robotCatalogSchema,
  routes: routeCatalogSchema,
  tutorials: tutorialCatalogSchema,
} as const;

export type CatalogName = keyof typeof catalogSchemas;
export type RobotCatalog = z.infer<typeof robotCatalogSchema>;
export type ModuleCatalog = z.infer<typeof moduleCatalogSchema>;
export type EnemyCatalog = z.infer<typeof enemyCatalogSchema>;
export type BossCatalog = z.infer<typeof bossCatalogSchema>;
export type ObjectiveCatalog = z.infer<typeof objectiveCatalogSchema>;
export type MapCatalog = z.infer<typeof mapCatalogSchema>;
export type RegionCatalog = z.infer<typeof regionCatalogSchema>;
export type EventCatalog = z.infer<typeof eventCatalogSchema>;
export type RouteCatalog = z.infer<typeof routeCatalogSchema>;
export type TutorialCatalog = z.infer<typeof tutorialCatalogSchema>;
export type ProgressionCatalog = z.infer<typeof progressionCatalogSchema>;
export type LocalizationCatalog = z.infer<typeof localizationCatalogSchema>;

export interface PveContentPack {
  readonly robots: RobotCatalog;
  readonly modules: ModuleCatalog;
  readonly enemies: EnemyCatalog;
  readonly bosses: BossCatalog;
  readonly objectives: ObjectiveCatalog;
  readonly maps: MapCatalog;
  readonly regions: RegionCatalog;
  readonly events: EventCatalog;
  readonly routes: RouteCatalog;
  readonly tutorials: TutorialCatalog;
  readonly progression: ProgressionCatalog;
  readonly localization: LocalizationCatalog;
}
