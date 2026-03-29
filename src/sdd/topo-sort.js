/**
 * Kahn's algorithm — O(V+E) topological sort.
 * @param {Map<string, string[]>} graph  adjacency list (task → depends_on[])
 * @returns {{ order: string[], cycle: string[] | null }}
 */
function topologicalSort(graph) {
  const inDegree = new Map();
  const adj = new Map();

  for (const [node, deps] of graph) {
    if (!inDegree.has(node)) inDegree.set(node, 0);
    if (!adj.has(node)) adj.set(node, []);
    for (const dep of deps) {
      if (!inDegree.has(dep)) inDegree.set(dep, 0);
      if (!adj.has(dep)) adj.set(dep, []);
      adj.get(dep).push(node);
      inDegree.set(node, inDegree.get(node) + 1);
    }
  }

  const queue = [];
  for (const [node, deg] of inDegree) {
    if (deg === 0) queue.push(node);
  }

  const order = [];
  while (queue.length > 0) {
    const node = queue.shift();
    order.push(node);
    for (const neighbor of adj.get(node)) {
      const newDeg = inDegree.get(neighbor) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor);
    }
  }

  if (order.length !== inDegree.size) {
    const cycle = [];
    for (const [node, deg] of inDegree) {
      if (deg > 0) cycle.push(node);
    }
    return { order: [], cycle };
  }

  return { order, cycle: null };
}

/**
 * Extracts task dependency graph from PLAN.md body.
 */
function extractTaskGraph(planBody) {
  const graph = new Map();
  const lines = planBody.split("\n");
  let currentTask = null;

  for (const line of lines) {
    const taskMatch = line.match(/^###\s+(T[\d.]+)/);
    if (taskMatch) {
      currentTask = taskMatch[1];
      if (!graph.has(currentTask)) graph.set(currentTask, []);
      continue;
    }

    if (currentTask) {
      const depMatch = line.match(/depends_on:\s*\[([^\]]*)\]/);
      if (depMatch) {
        const deps = depMatch[1]
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        graph.set(currentTask, deps);
      }
    }
  }

  return graph;
}

module.exports = { topologicalSort, extractTaskGraph };
