export class MemoryAdminSession {
  #token: string | null = null;

  public set(token: string): void {
    this.#token = token;
  }
  public get(): string | null {
    return this.#token;
  }
  public clear(): void {
    this.#token = null;
  }
}

export function confirmationFor(action: string, targetId: string): string {
  return `${action.toUpperCase()} ${targetId}`;
}
