// Countermeasure 型定義 + 純粋フィルタ関数 (client/server 共用)。
// fs/yaml/zod に依存しない。サーバー側 (countermeasures.ts) は Zod でこの shape に検証して読込む。

export type EffortLevel = 'low' | 'medium' | 'high';
export type ImpactLevel = 'low' | 'medium' | 'high' | 'very_high';
export type Ownership = 'owned' | 'rented';
export type BuildingType = 'wood' | 'steel' | 'rc' | 'src' | 'any';
export type HouseholdMember =
  | 'alone'
  | 'adults'
  | 'children'
  | 'infant'
  | 'elderly'
  | 'care_needed'
  | 'pets';
export type LocationType = 'coastal' | 'inland' | 'mountainous' | 'urban';

export interface CountermeasureApplicability {
  ownership: Ownership[];
  building_type: BuildingType[];
  min_year_built?: number | null;
  max_year_built?: number | null;
  has_member: (HouseholdMember | 'any')[];
  location_type: (LocationType | 'any')[];
}

export interface CountermeasureReference {
  title: string;
  url?: string | null;
}

export interface CountermeasureDetail {
  why?: string;
  how?: string;
  references?: CountermeasureReference[];
  related_actions?: string[];
}

export interface Countermeasure {
  id: string;
  category: string;
  disaster_group: string;
  label: string;
  short_description?: string;
  applicable_disasters: string[];
  applicability: CountermeasureApplicability;
  effort: { time: EffortLevel; cost: EffortLevel; skill: EffortLevel };
  impact: ImpactLevel;
  detail?: CountermeasureDetail;
}

export interface ProfileForFilter {
  building?: {
    year_built?: number | null;
    construction?: BuildingType | null;
    ownership?: Ownership | null;
  };
  household?: {
    composition?: HouseholdMember[];
  };
  /** 地域種別。住所/座標から自動判定するか、ユーザーが手動で入れる。 */
  location_types?: LocationType[];
}

/**
 * 検出された災害種別 ∪ 共通対策 にフィルタ。
 * `selectedDisasterEnum` が与えられた場合はその災害+共通だけに絞る。
 */
export function filterByDisaster<
  T extends Pick<Countermeasure, 'disaster_group' | 'applicable_disasters'>,
>(items: T[], detectedDisasterEnums: string[], selectedDisasterEnum?: string | null): T[] {
  const detected = new Set(detectedDisasterEnums);
  return items.filter((cm) => {
    if (cm.disaster_group === 'common') return true;
    if (selectedDisasterEnum) {
      return cm.applicable_disasters.includes(selectedDisasterEnum);
    }
    return cm.applicable_disasters.some((d) => detected.has(d));
  });
}

/**
 * プロファイル (建物・世帯・居住地種別) で applicability を満たさない項目を除外。
 * 未入力フィールドは「制約なし」として通す。
 * - 'any' を含む applicability はその次元では制約なし → 全員通す
 * - location_type のみ、入力が無い (location_types=[]) と「不明 = 通さない」(false negative 重視)
 */
export function filterByProfile<T extends Pick<Countermeasure, 'applicability'>>(
  items: T[],
  profile: ProfileForFilter,
): T[] {
  return items.filter((cm) => {
    const a = cm.applicability;

    // ownership
    if (profile.building?.ownership && !a.ownership.includes(profile.building.ownership)) {
      return false;
    }

    // building_type
    if (
      profile.building?.construction &&
      !a.building_type.includes('any') &&
      !a.building_type.includes(profile.building.construction)
    ) {
      return false;
    }

    // year_built
    if (profile.building?.year_built != null) {
      if (a.min_year_built != null && profile.building.year_built < a.min_year_built) return false;
      if (a.max_year_built != null && profile.building.year_built > a.max_year_built) return false;
    }

    // has_member — permissive when user has not declared a household composition
    // (per spec §6.1 「未入力でも動く」). When the user explicitly chose tags,
    // items must intersect; otherwise show all (let user judge).
    if (!a.has_member.includes('any')) {
      const composition = profile.household?.composition ?? [];
      if (composition.length > 0) {
        const hasMatch = a.has_member.some(
          (m) => m !== 'any' && composition.includes(m as HouseholdMember),
        );
        if (!hasMatch) return false;
      }
    }

    // location_type — permissive when user has not opted into any location
    // tags (per spec §6.1 「未入力でも動く」). When the user explicitly chose
    // tags, items must intersect; otherwise show all (let user judge).
    if (!a.location_type.includes('any')) {
      const locs = profile.location_types ?? [];
      if (locs.length > 0) {
        const hit = a.location_type.some((lt) => lt !== 'any' && locs.includes(lt as LocationType));
        if (!hit) return false;
      }
    }

    return true;
  });
}
