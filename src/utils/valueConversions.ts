/**
 * Convert percentage to internal value (0-100% -> 0-32767)
 * Matches legacy percentToInternal function
 */
export function percentToInternal(percent: number): number {
  return Math.round((percent / 100) * 32767);
}

/**
 * Convert internal value to percentage (0-32767 -> 0-100%)
 * Matches legacy internalToPercent function
 */
export function internalToPercent(internal: number): number {
  return Math.round((internal / 32767) * 100);
}

/**
 * Deep merge objects, matching legacy deepMerge function
 * Used for merging imported preset settings with base JSON
 */
const unsafeMergeKeys = new Set(['__proto__', 'constructor', 'prototype']);

function isMergeableObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const key of Object.keys(source)) {
    if (unsafeMergeKeys.has(key)) continue;

    const sourceValue = source[key];
    if (isMergeableObject(sourceValue)) {
      const targetValue = isMergeableObject(target[key]) ? target[key] : {};
      target[key] = targetValue;
      deepMerge(targetValue, sourceValue);
    } else {
      target[key] = sourceValue;
    }
  }
}
