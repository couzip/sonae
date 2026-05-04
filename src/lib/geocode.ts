// 国土地理院 API による住所⇔座標変換 (APIキー不要)

export interface GeocodeResult {
  address: string;
  lat: number;
  lng: number;
}

// 住所→座標 (forward geocode)
// https://msearch.gsi.go.jp/address-search/AddressSearch?q=...
export async function forwardGeocode(query: string): Promise<GeocodeResult[]> {
  const url = `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(query)}`;
  const r = await fetch(url, {
    headers: { 'User-Agent': 'Sonae/0.1 (https://github.com/couzip/bousai-copilot)' },
  });
  if (!r.ok) throw new Error(`GSI forward HTTP ${r.status}`);
  const arr = (await r.json()) as Array<{
    geometry: { coordinates: [number, number] };
    properties: { title: string };
  }>;
  return arr.map((it) => ({
    address: it.properties.title,
    lng: it.geometry.coordinates[0],
    lat: it.geometry.coordinates[1],
  }));
}

// 座標→住所 (reverse geocode)
// https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress?lat=...&lon=...
export interface ReverseResult {
  prefecture_code: string;
  city_code: string;
  prefecture_name: string;
  municipality_name: string;
  address: string;
}

export async function reverseGeocode(lat: number, lng: number): Promise<ReverseResult | null> {
  const url = `https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress?lat=${lat}&lon=${lng}`;
  const r = await fetch(url, {
    headers: { 'User-Agent': 'Sonae/0.1 (https://github.com/couzip/bousai-copilot)' },
  });
  if (!r.ok) return null;
  const body = (await r.json()) as {
    results?: { muniCd?: string; lv01Nm?: string };
  };
  const results = body.results;
  if (!results?.muniCd) return null;

  // GSI は muniCd を 5桁 (前2桁=都道府県, 後3桁=市町村) で返すが MuniMaster CSV ベース。
  // 実際は前2桁が都道府県コード、4-5桁が市町村コード(0埋め)。
  const muniCd = String(results.muniCd).padStart(5, '0');
  const prefCd = muniCd.slice(0, 2);
  // GSI muniCd は内部コード (旧コード) のため、JIS X 0401-0402 の現代コードと一致しない場合あり。
  // 当面は muniCd を city_code として返し、registry の name 検索でカバーする。
  return {
    prefecture_code: prefCd,
    city_code: muniCd,
    prefecture_name: '',
    municipality_name: '',
    address: results.lv01Nm ?? '',
  };
}
