export type TranslationDictionary = Readonly<Record<string, string>>;

export const ZH_HANS: TranslationDictionary = {
  "app.title": "浮岛工程队",
  "menu.expedition": "标准远征",
  "menu.daily": "每日挑战",
  "menu.collection": "图鉴",
  "menu.settings": "设置",
  "menu.privacy": "隐私政策",
  "menu.user_agreement": "用户协议",
  "menu.offline": "当前离线，联网功能暂不可用",
  "screen.loading": "正在装配…",
  "screen.choose_route": "请选择一个入口进行本地测试",
  "screen.opening_route": "正在打开{name}…",
  "screen.route_ready": "{name}入口已响应，功能资源加载完成",
  "screen.back": "返回主菜单",
  "battle.local.title": "标准远征 · 云桥坚守",
  "battle.local.round": "第 {round} 轮 · {phase}",
  "battle.local.energy": "共享能源 {current}/{maximum}",
  "battle.local.objective": "主要目标：守住能源核心 {progress}/{required}",
  "battle.local.hp": "耐久 {hp}",
  "battle.local.angle": "角度 {angle}°",
  "battle.local.power": "力度 {power}%",
  "battle.local.aim_readout": "当前瞄准：角度 {angle}° · 力度 {power}%",
  "battle.local.angle_down": "角度 −10°",
  "battle.local.angle_up": "角度 +10°",
  "battle.local.power_down": "力度 −10%",
  "battle.local.power_up": "力度 +10%",
  "battle.local.fire": "发射钻蜂",
  "battle.local.end_round": "结束回合",
  "battle.local.ready": "选择角度和力度，钻开地形改变战场",
  "battle.local.aim_changed": "瞄准参数已调整，黄色轨迹为本次目标",
  "battle.local.fired": "{actor}向网格（{x}, {y}）发射了定向钻蜂",
  "battle.local.all_acted": "本轮机器人均已行动，请结束回合",
  "battle.local.round_started": "敌方与环境结算完成，第 {round} 轮开始",
  "battle.local.victory": "能源核心保持稳定，远征节点胜利！",
  "battle.local.defeat": "工程小队失去动力，本次节点失败",
  "battle.local.command_failed": "指令未执行：{reason}",
  "battle.actor.robot.rivet": "铆钉",
  "battle.actor.robot.gale": "风栖",
  "battle.actor.robot.prism": "棱镜",
  "battle.actor.enemy.scout": "侦察机",
  "battle.actor.enemy.guard": "守卫机",
  "phase.player_planning": "规划阶段",
  "phase.player_action": "玩家行动",
  "phase.enemy_action": "敌方行动",
  "phase.environment_settlement": "环境结算",
  "phase.battle_complete": "节点完成",
  "screen.retry": "重试",
  "screen.error": "载入失败",
  "aim.confirm": "确认发射",
  "aim.cancel": "取消",
  "faction.player": "我方",
  "faction.enemy": "失控单位",
  "faction.neutral": "中立目标",
  "build.valid": "可建造",
  "build.invalid": "不可建造",
};

export class Localizer {
  constructor(private readonly dictionary: TranslationDictionary = ZH_HANS) {}

  text(key: string, variables: Readonly<Record<string, string | number>> = {}): string {
    const template = this.dictionary[key] ?? `[${key}]`;
    return template.replace(/\{([A-Za-z0-9_.-]+)\}/g, (_match, name: string) =>
      String(variables[name] ?? `{${name}}`),
    );
  }
}
