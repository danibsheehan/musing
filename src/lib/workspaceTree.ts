import type { Page } from "../types/page";

export function siblingsOf(pages: Page[], parentId: string | null): Page[] {
  return pages
    .filter((p) => p.parentId === parentId)
    .slice()
    .sort((a, b) => a.order - b.order);
}

/** Page id and all nested children (entire subtree). */
export function subtreeIds(pages: Page[], rootId: string): Set<string> {
  const byParent = new Map<string | null, Page[]>();
  for (const p of pages) {
    const key = p.parentId;
    const list = byParent.get(key) ?? [];
    list.push(p);
    byParent.set(key, list);
  }
  const out = new Set<string>();
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    if (out.has(id)) continue;
    out.add(id);
    for (const child of byParent.get(id) ?? []) stack.push(child.id);
  }
  return out;
}

export function ancestryChain(pages: Page[], pageId: string): Page[] {
  const byId = new Map(pages.map((p) => [p.id, p] as const));
  const chain: Page[] = [];
  let current = byId.get(pageId);
  while (current) {
    chain.push(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return chain.reverse();
}
