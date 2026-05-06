import {
  hierarchy,
  treemap,
  treemapSquarify,
  type HierarchyRectangularNode,
} from 'd3-hierarchy';

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

interface InternalNode<T> {
  id?: string;
  weight?: number;
  payload?: T;
  children?: InternalNode<T>[];
}

export function computeTreemap<T>(
  items: TreemapInput<T>[],
  width: number,
  height: number,
  padding = 4,
): TreemapRect<T>[] {
  if (!items.length || width <= 0 || height <= 0) return [];

  const rootData: InternalNode<T> = { children: items };
  const root = hierarchy<InternalNode<T>>(rootData).sum((d) => d.weight ?? 0);

  const layout = treemap<InternalNode<T>>()
    .size([width, height])
    .padding(padding)
    .tile(treemapSquarify);

  const laidOut = layout(root) as HierarchyRectangularNode<InternalNode<T>>;

  const rects: TreemapRect<T>[] = [];
  for (const leaf of laidOut.leaves()) {
    const d = leaf.data;
    if (d.id == null || d.weight == null || d.payload == null) continue;
    rects.push({
      id: d.id,
      x: leaf.x0,
      y: leaf.y0,
      width: Math.max(0, leaf.x1 - leaf.x0),
      height: Math.max(0, leaf.y1 - leaf.y0),
      weight: d.weight,
      payload: d.payload,
    });
  }
  return rects;
}
