declare const Bun: {
  serve(options: {
    hostname?: string;
    port?: number;
    fetch: (request: Request) => Response | Promise<Response>;
  }): { port: number };
  spawn(
    command: string[],
    options?: {
      stdout?: "inherit";
      stderr?: "inherit";
      stdin?: "inherit";
      env?: Record<string, string | undefined>;
    },
  ): { exited: Promise<number>; kill: () => void };
};

declare module "bun:test" {
  interface Matchers {
    toBe(value: unknown): void;
    toEqual(value: unknown): void;
    toBeNull(): void;
    toBeUndefined(): void;
    toContain(value: unknown): void;
    toHaveLength(value: number): void;
    toHaveProperty(key: string): void;
    toMatchObject(value: unknown): void;
    toBeGreaterThanOrEqual(value: number): void;
    not: Matchers;
  }
  export function describe(name: string, fn: () => void): void;
  export function test(name: string, fn: () => void | Promise<void>): void;
  export function expect(value: unknown): Matchers;
}
