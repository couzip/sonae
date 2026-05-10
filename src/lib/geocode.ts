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
    signal: AbortSignal.timeout(3000),
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
    signal: AbortSignal.timeout(3000),
  });
  if (!r.ok) return null;
  const body = (await r.json()) as {
    results?: { muniCd?: string; lv01Nm?: string };
  };
  const results = body.results;
  if (!results?.muniCd) return null;

  const muniCd = String(results.muniCd).padStart(5, '0');
  const prefCd = muniCd.slice(0, 2);
  return {
    prefecture_code: prefCd,
    city_code: muniCd,
    prefecture_name: '',
    municipality_name: '',
    address: results.lv01Nm ?? '',
  };
}

// HeartRails Geo API: 座標から自治体名 (市区町村) を直接得る (無料 / API key 不要)
// http://geoapi.heartrails.com/api/json?method=searchByGeoLocation&x=lng&y=lat
export interface HeartRailsLocation {
  prefecture: string;
  city: string;
  town: string;
  postal: string;
  lat: number;
  lng: number;
}

export async function heartRailsReverse(
  lat: number,
  lng: number,
): Promise<HeartRailsLocation | null> {
  const url = `https://geoapi.heartrails.com/api/json?method=searchByGeoLocation&x=${lng}&y=${lat}`;
  const r = await fetch(url, {
    headers: { 'User-Agent': 'Sonae/0.1 (https://github.com/couzip/bousai-copilot)' },
    signal: AbortSignal.timeout(3000),
  });
  if (!r.ok) return null;
  const body = (await r.json()) as {
    response?: {
      location?: Array<{
        prefecture?: string;
        city?: string;
        town?: string;
        postal?: string;
        x?: string;
        y?: string;
      }>;
    };
  };
  const loc = body.response?.location?.[0];
  if (!loc?.prefecture || !loc?.city) return null;
  return {
    prefecture: loc.prefecture,
    city: loc.city,
    town: loc.town ?? '',
    postal: loc.postal ?? '',
    lat: Number(loc.y) || lat,
    lng: Number(loc.x) || lng,
  };
}
