// Centralized rounding utility for numbers
// Usage: roundTo(value, decimals)

export function roundTo(value: number, decimals: number = 0): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
