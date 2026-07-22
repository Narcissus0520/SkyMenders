export type TranslationDictionary = Readonly<Record<string, string>>;

export const ZH_HANS: TranslationDictionary = {
  "app.title": "浮岛工程队",
  "menu.expedition": "标准远征",
  "menu.daily": "每日挑战",
  "menu.collection": "图鉴",
  "menu.settings": "设置",
  "menu.offline": "当前离线，联网功能暂不可用",
  "screen.loading": "正在装配…",
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
