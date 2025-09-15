// Minimal ambient typings for bcryptjs to satisfy Next.js type checking in CI
// These mirror the commonly used async API surface we rely on.

declare module 'bcryptjs' {
  export function hash(data: string, saltOrRounds: string | number): Promise<string>;
  export function compare(data: string, encrypted: string): Promise<boolean>;
  export function genSalt(rounds?: number): Promise<string>;

  const _default: {
    hash: typeof hash;
    compare: typeof compare;
    genSalt: typeof genSalt;
  };

  export default _default;
}
