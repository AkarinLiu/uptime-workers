export const REGION_IDS = [
  'wnam',
  'enam',
  'sam',
  'weur',
  'eeur',
  'apac',
  'apac-ne',
  'apac-se',
  'oc',
  'afr',
  'me',
] as const

export function regionKey(id: string): string {
  return 'region_' + id.replace(/-/g, '_')
}
