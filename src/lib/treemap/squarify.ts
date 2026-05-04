import { hierarchy, treemap, treemapSquarify } from 'd3-hierarchy';

export interface TreemapInput<T> {
  id: string;
  weight: number;
  payload: T;
}

export interface TreemapRect<T> {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  weight: number;
  payload: T;
}

export function computeTreemap<T>(
  items: TreemapInput<T>[],
  width: number,
  height: number,
  padding = 4,
): TreemapRect<T>[] {
  if (!items.length || width <= 0 || height <= 0) return [];

  const root = hierarchy<{ children?: TreemapInput<T>[] } & Partial<TreemapInput<T>>>({
    children: items,
  } as any).sum((d: any) => (d.weight as number | undefined) ?? 0);

  const layout = treemap<
    typeof root extends infer R ? (R extends { data: infer D } ? D : never) : never
  >()
    .size([width, height])
    .padding(padding)
    .tile(treemapSquarify);

  layout(root as any);

  const rects: TreemapRect<T>[] = [];
  for (const leaf of root.leaves()) {
    const data = leaf.data as unknown as TreemapInput<T>;
    const x0 = (leaf as any).x0 as number;
    const x1 = (leaf as any).x1 as number;
    const y0 = (leaf as any).y0 as number;
    const y1 = (leaf as any).y1 as number;
    rects.push({
      id: data.id,
      x: x0,
      y: y0,
      width: Math.max(0, x1 - x0),
      height: Math.max(0, y1 - y0),
      weight: data.weight,
      payload: data.payload,
    });
  }
  return rects;
}
