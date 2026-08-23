declare module "node:module" {
  export function createRequire(
    filename: string | URL,
  ): (id: string) => any;
}
