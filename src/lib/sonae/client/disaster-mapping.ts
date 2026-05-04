// 災害種別の日本語名 ↔ 内部 enum マッピング (client/server 両用)。
// fs/yaml に依存しないため、useFlowStore など client コードからも import 可。

const DISASTER_MAP: Record<string, string> = {
  地震: 'earthquake',
  津波: 'tsunami',
  洪水: 'flood',
  風水害: 'flood',
  内水氾濫: 'inland_flood',
  高潮: 'storm_surge',
  土砂災害: 'landslide',
  火山噴火: 'volcanic',
  雪害: 'storm',
  竜巻: 'tornado',
  大規模火災: 'urban_fire',
  林野火災: 'urban_fire',
  危険物災害: 'urban_fire',
  化学物質災害: 'urban_fire',
  放射性物質災害: 'nuclear',
  海上災害: 'tsunami',
  鉄道災害: 'transport',
  道路災害: 'transport',
  航空災害: 'transport',
  大規模事故: 'transport',
  都市災害: 'urban_fire',
  帰宅困難者: 'earthquake',
  雑踏事故: 'urban_fire',
  不発弾災害: 'urban_fire',
};

export function disasterJpToEnum(jp: string): string {
  return DISASTER_MAP[jp] ?? jp.toLowerCase();
}
