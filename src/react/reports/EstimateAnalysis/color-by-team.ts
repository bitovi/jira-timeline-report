// A color palette with 30 distinct colors (feel free to customize)
const TEAM_COLORS = [
  '#1f77b4',
  '#ff7f0e',
  '#2ca02c',
  '#d62728',
  '#9467bd',
  '#8c564b',
  '#e377c2',
  '#7f7f7f',
  '#bcbd22',
  '#17becf',
  '#393b79',
  '#637939',
  '#8c6d31',
  '#843c39',
  '#7b4173',
  '#a55194',
  '#6b6ecf',
  '#9c9ede',
  '#cedb9c',
  '#bd9e39',
  '#ad494a',
  '#d6616b',
  '#e7ba52',
  '#e7969c',
  '#a1d99b',
  '#74c476',
  '#31a354',
  '#756bb1',
  '#636363',
  '#9e9ac8',
] as const;

function hashStringToIndex(str: string, mod: number): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash) % mod;
}

export function colorByTeam(team: string): string {
  const index = hashStringToIndex(team, TEAM_COLORS.length);
  return TEAM_COLORS[index];
}
