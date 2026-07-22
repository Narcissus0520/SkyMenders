export interface EditorModule {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly catalogs: readonly string[];
  readonly capabilities: readonly string[];
}

export const EDITOR_MODULES: readonly EditorModule[] = [
  {
    id: "maps",
    title: "地图与关卡",
    subtitle: "逻辑栅格、支撑和可解性",
    catalogs: ["maps", "objectives", "regions"],
    capabilities: [
      "材质画刷",
      "固定锚点",
      "出生与目标区",
      "机关与建造点",
      "危险区",
      "镜头边界",
      "导航标记",
      "种子预览",
      "可解性检查",
    ],
  },
  {
    id: "routes",
    title: "路线与奖励",
    subtitle: "节点图、权重和到达性",
    catalogs: ["routes", "regions", "progression"],
    capabilities: [
      "节点分层",
      "连接关系",
      "出现权重",
      "次数上限",
      "Boss 出口",
      "奖励池",
      "工坊服务",
      "到达性检查",
    ],
  },
  {
    id: "actors",
    title: "机器人与模块",
    subtitle: "阵容、兼容性和升级路线",
    catalogs: ["robots", "modules"],
    capabilities: [
      "基础参数",
      "能源与冷却",
      "目标类型",
      "状态效果",
      "双升级路线",
      "资源引用",
      "非法组合检查",
    ],
  },
  {
    id: "enemies",
    title: "敌人与 AI",
    subtitle: "行为、效用和精英组合",
    catalogs: ["enemies", "bosses"],
    capabilities: [
      "行为树",
      "效用权重",
      "瞄准误差",
      "精英词缀",
      "区域变体",
      "合法组合",
      "Boss 阶段",
    ],
  },
  {
    id: "events",
    title: "事件与教学",
    subtitle: "本地化叙事和条件结果",
    catalogs: ["events", "tutorials", "localization"],
    capabilities: [
      "静态背景",
      "角色立绘",
      "文本 Key",
      "分支选择",
      "触发条件",
      "结果效果",
      "解锁",
      "本地化校验",
    ],
  },
  {
    id: "daily",
    title: "每日挑战",
    subtitle: "固定种子预览与计分约束",
    catalogs: ["robots", "modules", "routes", "maps"],
    capabilities: [
      "固定小队",
      "固定模块",
      "挑战种子",
      "难度",
      "计分权重",
      "三次正式机会",
      "练习模式",
      "版本冻结",
    ],
  },
] as const;
