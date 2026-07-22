declare module "cc" {
  export class Component {
    readonly node: Node;
  }

  export class Node {
    static readonly EventType: { readonly TOUCH_END: string };
    constructor(name?: string);
    parent: Node | null;
    active: boolean;
    addComponent<T>(constructor: new () => T): T;
    getComponent<T>(constructor: new () => T): T | null;
    on(event: string, callback: () => void, target?: unknown): void;
    setPosition(x: number, y: number, z?: number): void;
  }

  export class UITransform {
    setContentSize(width: number, height: number): void;
  }

  export class Label {
    string: string;
    fontSize: number;
    lineHeight: number;
    color: Color;
  }

  export class Graphics {
    fillColor: Color;
    strokeColor: Color;
    lineWidth: number;
    rect(x: number, y: number, width: number, height: number): void;
    roundRect(x: number, y: number, width: number, height: number, radius: number): void;
    fill(): void;
    stroke(): void;
  }

  export class Color {
    constructor(red?: number, green?: number, blue?: number, alpha?: number);
  }

  export const _decorator: {
    readonly ccclass: (name: string) => ClassDecorator;
  };

  export const game: {
    frameRate: number;
  };

  export const view: {
    setOrientation(orientation: number): void;
  };

  export const macro: {
    readonly ORIENTATION_LANDSCAPE: number;
  };

  export const assetManager: {
    loadBundle(name: string, callback: (error: Error | null, bundle: unknown) => void): void;
  };
}
