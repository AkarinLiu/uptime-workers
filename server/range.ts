export interface RangeConf {
  modifier: string;
  /** seconds per bucket; null = return raw checks (no aggregation) */
  bucket: number | null;
}

export const RANGE_CONF: Record<string, RangeConf> = {
  "1h": { modifier: "-1 hours", bucket: null },
  "6h": { modifier: "-6 hours", bucket: null },
  "24h": { modifier: "-24 hours", bucket: null },
  "7d": { modifier: "-7 days", bucket: 3600 },
  "30d": { modifier: "-30 days", bucket: 21600 },
};

export function parseRange(range: string | null): RangeConf | null {
  if (!range) return null;
  return RANGE_CONF[range] ?? null;
}
