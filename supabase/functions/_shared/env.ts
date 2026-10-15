export function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`missing_configuration:${name}`);
  return value;
}

export function booleanEnv(name: string, fallback = false): boolean {
  const value = Deno.env.get(name)?.trim().toLocaleLowerCase();
  if (!value) return fallback;
  return value === "true";
}

export function integerEnv(
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const value = Number.parseInt(Deno.env.get(name) ?? "", 10);
  return Number.isFinite(value) && value >= minimum && value <= maximum
    ? value
    : fallback;
}
