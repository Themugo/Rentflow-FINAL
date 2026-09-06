export const HEX_COLOR = /^#([0-9A-Fa-f]{6})$/;

export function isHexColor(value: string | null | undefined): value is string {
  return typeof value === "string" && HEX_COLOR.test(value.trim());
}
