export type FlowSupply = { id: string; units: number };
export type FlowTask = { units: number };
/** Integer max flow: employee budgets constrain every skill/project edge together. */
export function allocateFlow<S extends FlowSupply, T extends FlowTask>(supplies: S[], tasks: T[], eligible: (s: S, t: T) => boolean) {
  type Edge = { to: number; reverse: number; capacity: number };
  const sink = supplies.length + tasks.length + 1;
  const graph: Edge[][] = Array.from({ length: sink + 1 }, () => []);
  function add(from: number, to: number, capacity: number) {
    const edge = { to, reverse: graph[to].length, capacity };
    graph[from].push(edge); graph[to].push({ to: from, reverse: graph[from].length - 1, capacity: 0 });
    return edge;
  }
  const links: { supply: number; task: number; capacity: number; edge: Edge }[] = [];
  supplies.forEach((s, i) => {
    add(0, i + 1, s.units);
    tasks.forEach((t, j) => { if (s.units > 0 && t.units > 0 && eligible(s, t)) { const capacity = Math.min(s.units, t.units); links.push({ supply: i, task: j, capacity, edge: add(i + 1, supplies.length + j + 1, capacity) }); } });
  });
  tasks.forEach((t, j) => add(supplies.length + j + 1, sink, t.units));
  let total = 0;
  while (true) {
    const parent: ({ node: number; edge: number } | undefined)[] = Array(graph.length);
    const queue = [0]; parent[0] = { node: -1, edge: -1 };
    for (let index = 0; index < queue.length && !parent[sink]; index++) {
      const node = queue[index];
      graph[node].forEach((edge, i) => { if (edge.capacity > 0 && !parent[edge.to]) { parent[edge.to] = { node, edge: i }; queue.push(edge.to); } });
    }
    if (!parent[sink]) break;
    let amount = Number.MAX_SAFE_INTEGER;
    for (let node = sink; node !== 0; node = parent[node]!.node) { const p = parent[node]!; amount = Math.min(amount, graph[p.node][p.edge].capacity); }
    for (let node = sink; node !== 0; node = parent[node]!.node) { const p = parent[node]!; const edge = graph[p.node][p.edge]; edge.capacity -= amount; graph[node][edge.reverse].capacity += amount; }
    total += amount;
  }
  const used = tasks.map(() => 0);
  const assignments = links.flatMap(link => { const units = link.capacity - link.edge.capacity; used[link.task] += units; return units > 0 ? [{ supply: supplies[link.supply], taskIndex: link.task, units }] : []; });
  return { total, assignments, remaining: tasks.map((t, i) => t.units - used[i]) };
}
export function apportion(total: number, weights: number[]) {
  const sum = weights.reduce((s, n) => s + n, 0);
  if (!sum || !total) return weights.map(() => 0);
  const parts = weights.map((weight, index) => { const value = BigInt(total) * BigInt(weight); return { index, units: Number(value / BigInt(sum)), remainder: value % BigInt(sum) }; });
  let left = total - parts.reduce((s, p) => s + p.units, 0);
  for (const part of [...parts].sort((a, b) => a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1)) { if (left-- <= 0) break; part.units++; }
  return parts.map(p => p.units);
}
