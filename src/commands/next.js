const fs = require("fs");
const path = require("path");
const { loadSddConfig } = require("../sdd/config");
const { discoverSddState } = require("../sdd/discover");
const { topologicalSort, extractTaskGraph } = require("../sdd/topo-sort");

function cmdNext() {
  const flags = process.argv.slice(3);
  const quick = flags.includes("--quick");

  const sddDir = path.resolve(".sdd");
  if (!fs.existsSync(sddDir)) {
    console.log("E-000: No .sdd/ directory found. Run `spextral init` first.");
    process.exit(1);
  }

  const config = loadSddConfig(sddDir);
  const chain = config.chain;
  const slugs = discoverSddState(sddDir);

  if (slugs.length === 0) {
    console.log("STATUS: empty");
    console.log("NEXT: Run SDD_WAKE to start a new feature.");
    return;
  }

  // Find the most active slug (first non-archived)
  let active = null;
  for (const s of slugs) {
    const statuses = Object.values(s.artifacts).map((a) => a.status).filter(Boolean);
    if (statuses.some((st) => st !== "archived")) {
      active = s;
      break;
    }
  }

  if (!active) {
    console.log("STATUS: all_archived");
    console.log("NEXT: All features archived. Run SDD_WAKE to start a new feature.");
    return;
  }

  const a = active.artifacts;
  const slug = active.slug;

  // ── Quick mode: condensed fast-path ──
  if (quick) {
    console.log(`MODE: quick (autonomy_level: full — clarify and blocking_review auto-approved)`);
    console.log(`SLUG: ${slug}`);

    if (!a.SPEC) {
      console.log("NEXT: Generate SPEC.md with context, decisions, and requirements (EARS format, REQ-N IDs) in a single pass.");
      console.log("CONSTRAINTS: Include ## Context and ## Decisions sections. Auto-approve clarify state.");
      return;
    }
    if (!a.PLAN) {
      console.log("NEXT: Generate PLAN.md with task-to-REQ mapping and (P) markers.");
      console.log("CONSTRAINTS: Run Goal-Backward Verification inline. Auto-approve.");
      return;
    }

    const graph = extractTaskGraph(a.PLAN.body);
    if (graph.size > 0) {
      const { order, cycle } = topologicalSort(graph);
      if (cycle) {
        console.log(`E-603: Circular dependency detected in tasks: ${cycle.join(", ")}`);
        process.exit(1);
      }
      console.log(`TASK_ORDER: ${order.join(" → ")}`);
    }

    console.log("NEXT: Execute sddkit-implement with autonomy_level: full, review_frequency: end_only. Atomic commits per task.");
    return;
  }

  // ── Normal mode: step-by-step routing ──
  console.log(`SLUG: ${slug}`);

  if (!a.SPEC) {
    console.log("STATUS: no_spec");
    console.log("NEXT: Generate SPEC.md with ## Context, ## Decisions ([LOCKED], [DISCRETION], [DEFERRED]), and EARS-format requirements with REQ-N identifiers.");
    return;
  }

  if (a.SPEC.status === "draft") {
    console.log("STATUS: spec_draft");
    console.log("NEXT: Transition SPEC.md to clarify — run Adversarial Review for ambiguities, then await approval.");
    return;
  }

  if (a.SPEC.status === "clarify") {
    console.log("STATUS: spec_clarify");
    console.log("NEXT: Awaiting human approval (or modification requests) to resolve clarification questions.");
    return;
  }

  if (a.SPEC.status === "ready") {
    console.log("STATUS: spec_ready");
    console.log("NEXT: Run sddkit-validate on SPEC.md (structural + REQ-ID + context budget checks).");
    return;
  }

  if (!a.PLAN) {
    console.log("STATUS: spec_validated");
    console.log("NEXT: Generate PLAN.md with task-to-REQ mapping, depends_on, and (P) parallelism markers.");
    return;
  }

  if (a.PLAN.status === "draft") {
    console.log("STATUS: plan_draft");
    console.log("NEXT: Transition PLAN.md to clarify — run Goal-Backward Verification (every REQ covered?).");
    return;
  }

  if (a.PLAN.status === "clarify") {
    console.log("STATUS: plan_clarify");
    console.log("NEXT: Awaiting human approval (or modification requests) to confirm plan coverage.");
    return;
  }

  if (a.PLAN.status === "ready") {
    console.log("STATUS: plan_ready");
    const graph = extractTaskGraph(a.PLAN.body);
    if (graph.size > 0) {
      const { order, cycle } = topologicalSort(graph);
      if (cycle) {
        console.log(`E-603: Circular dependency detected in tasks: ${cycle.join(", ")}`);
        process.exit(1);
      }
      console.log(`DEPENDENCY_ORDER: ${order.join(" → ")}`);
    }
    console.log("NEXT: Run sddkit-validate on PLAN.md, then sddkit-review (Devil-Advocate).");
    return;
  }

  if (a.PLAN.status === "validated" || a.PLAN.status === "blocking_review") {
    if (a.PROGRESS) {
      const progressBody = a.PROGRESS.body || "";
      const pending = (progressBody.match(/status:\s*pending/g) || []).length;
      const inProgress = (progressBody.match(/status:\s*in_progress/g) || []).length;

      if (pending === 0 && inProgress === 0) {
        const progressIdx = chain.indexOf("PROGRESS");
        const postProgress = chain.slice(progressIdx + 1);
        const remaining = postProgress.filter((artName) => !a[artName]);
        for (const artName of postProgress) {
          if (!a[artName]) {
            const customDesc = config.custom_artifacts && config.custom_artifacts[artName];
            const hint = customDesc ? ` — ${customDesc.description}` : "";
            console.log(`STATUS: awaiting_${artName.toLowerCase()}`);
            console.log(`NEXT: Generate ${artName}.md${hint}.`);
            if (remaining.length > 1) {
              console.log(`REMAINING: ${remaining.length} artifacts pending in chain (${remaining.join(", ")}). Auto-continue after this one.`);
            }
            return;
          }
        }
        console.log("STATUS: all_complete");
        console.log("NEXT: Run sddkit-archive to move validated artifacts to .sdd/archive/.");
        return;
      }

      console.log(`STATUS: implementing (${pending} pending, ${inProgress} in_progress)`);
      console.log("NEXT: Continue sddkit-implement — execute next pending task with atomic commit.");
      return;
    }

    console.log("STATUS: plan_validated");
    console.log("NEXT: Begin sddkit-implement — create PROGRESS.md and start first task batch.");
    return;
  }

  // Fallback
  console.log(`STATUS: ${slug}_unknown`);
  console.log("NEXT: Run sddkit-doctor to diagnose artifact state, then resume.");
}

module.exports = { cmdNext };
