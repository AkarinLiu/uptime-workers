// Cloudflare Durable Object location hints, used as probe regions.
export const REGION_IDS = [
  "wnam",
  "enam",
  "sam",
  "weur",
  "eeur",
  "apac",
  "apac-ne",
  "apac-se",
  "oc",
  "afr",
  "me",
] as const;

export type RegionId = (typeof REGION_IDS)[number];

const regionSet = new Set<string>(REGION_IDS);

export function isRegionId(value: string): value is RegionId {
  return regionSet.has(value);
}
