const path = require("path");

const SPEC_FILENAME = "spextral.md";
const TEMPLATES_DIR = path.join(__dirname, "..", "templates");
const SPEC_SOURCE = path.join(TEMPLATES_DIR, SPEC_FILENAME);

const VALID_STATES = [
  "draft",
  "clarify",
  "ready",
  "validated",
  "blocking_review",
  "fingerprint_mismatch",
  "checkpointed",
  "archived",
];

const AGENT_REGISTRY = {
  "claude-code": {
    name: "Claude Code",
    verified: true,
    dest: "CLAUDE.md",
    isFile: true,
    skills: { dir: path.join(".claude", "skills"), format: "skill" },
    exclusionFile: null,
  },
  cursor: {
    name: "Cursor",
    dest: path.join(".cursor", "rules", "spextral.mdc"),
    isFile: true,
    mdcFormat: true,
    skills: null,
    exclusionFile: ".cursorignore",
  },
  copilot: {
    name: "GitHub Copilot",
    dest: path.join(".github", "copilot-instructions.md"),
    isFile: false,
    skills: { dir: path.join(".github", "skills"), format: "copilot" },
    exclusionFile: ".copilotignore",
  },
  kiro: {
    name: "Kiro",
    dest: path.join(".kiro", "steering", "spextral.md"),
    isFile: false,
    kiroSteering: true,
    skills: { dir: path.join(".kiro", "skills"), format: "skill-dir" },
    exclusionFile: null,
  },
  "roo-code": {
    name: "Roo Code",
    dest: ".clinerules",
    isFile: true,
    skills: null,
    exclusionFile: null,
  },
  windsurf: {
    name: "Windsurf",
    dest: path.join(".windsurf", "rules", "spextral.md"),
    isFile: false,
    skills: null,
    exclusionFile: null,
  },
  "gemini-cli": {
    name: "Gemini CLI",
    dest: "GEMINI.md",
    isFile: true,
    skills: null,
    exclusionFile: null,
  },
  cline: {
    name: "Cline",
    dest: path.join(".cline", "rules", "spextral.md"),
    isFile: false,
    skills: null,
    exclusionFile: null,
  },
  codex: {
    name: "Codex CLI",
    dest: "AGENTS.md",
    isFile: true,
    skills: null,
    exclusionFile: null,
  },
  trae: {
    name: "Trae",
    dest: path.join(".trae", "rules", "spextral.md"),
    isFile: false,
    skills: null,
    exclusionFile: null,
  },
  manual: {
    name: "Manual (copy to templates/ only)",
    dest: null,
    skills: null,
    exclusionFile: null,
  },
};

const SDD_CATEGORIES = [
  { id: "core", label: "Core Protocol", suffix: "(Required)" },
  { id: "execution", label: "Execution & State", suffix: "" },
  { id: "quality", label: "Quality & Assurance", suffix: "" },
];

const SDD_ARTIFACTS = [
  {
    name: "SPEC",
    category: "core",
    required: true,
    shortDesc: "🌍 The Big Picture & Strict Rules",
    description: "Context, decisions, and requirements (EARS format, REQ-N IDs)",
    details: {
      beginner: "This tells the AI what your project is about AND what it needs to do. Example: 'This is an online shoe store using Tailwind CSS. The user must be able to log in with Google.' All context, decisions, and requirements live here so the AI has a single source of truth.",
      expert: "Combines Architecture Decision Records (ADRs), tech stack constraints, and granular requirements in EARS format with REQ-N IDs. Provides the high-level system boundaries, domain knowledge, and strict scope contract to prevent LLM hallucination and scope creep."
    }
  },
  {
    name: "PLAN",
    category: "core",
    required: true,
    shortDesc: "🗺️ The Roadmap",
    description: "Tasks with dependency graph",
    details: {
      beginner: "A checklist that breaks a big feature into small, manageable steps (e.g., 1. Setup database → 2. Build API → 3. Create UI). It stops the AI from trying to code everything all at once and getting confused.",
      expert: "A Directed Acyclic Graph (DAG) of execution tasks. It defines the optimal sequence of implementation so the LLM resolves underlying dependencies (like DB schemas or interfaces) before attempting to write upper-layer business logic."
    }
  },
  {
    name: "PROGRESS",
    category: "execution",
    required: false,
    shortDesc: "💾 The Save State",
    description: "Execution status tracking",
    details: {
      beginner: "If you run out of AI credits or the chat window resets, this file acts as a save point. When you come back, the AI reads this file to remember exactly which task it was working on so it can resume perfectly.",
      expert: "Persisted Finite State Machine (FSM) tracking. It operates as the agent's external long-term memory, mitigating context-window degradation. Using commands like `sdd-wake`, the LLM instantly recovers its 'Chain of Thought' cross-session. Optional for one-shot tasks; recommended for long sessions or autonomous agent workflows."
    }
  },
  {
    name: "CHECKPOINT",
    category: "execution",
    required: false,
    shortDesc: "⏪ The Time Machine",
    description: "Recovery points",
    details: {
      beginner: "A fast backup taken right before the AI makes a massive or risky change to your files. If the AI breaks everything, this file helps you quickly undo the mess.",
      expert: "Granular, Git-independent state snapshots. Crucial for agentic workflows where a rogue LLM iteration might destroy working logic; allows the agent to self-revert upon detecting a critical compilation or test failure."
    }
  },
  {
    name: "VALIDATION",
    category: "quality",
    required: false,
    shortDesc: "🔍 The Checker",
    description: "Validation report",
    details: {
      beginner: "A final report where the AI double-checks if every single rule from SPEC.md was actually built and if it works as requested before calling the job 'done'.",
      expert: "Automated heuristic validation report mapping code output back to REQ-N IDs. Serves as an audit trail ensuring the Pull Request strictly meets the acceptance criteria defined in the specification."
    }
  },
  {
    name: "REVIEW",
    category: "quality",
    required: false,
    shortDesc: "🧐 The Critic",
    description: "Review notes (Devil-Advocate)",
    details: {
      beginner: "Tells the AI to act like a strict senior programmer, looking for messy code, bad practices, or things that might run slowly in the future.",
      expert: "A 'Devil's Advocate' prompt layer. Forces a separate LLM context stream to critically evaluate the generated code, pointing out cyclomatic complexity, code smells, tight coupling, or unoptimized loops."
    }
  },
  {
    name: "TEST",
    category: "quality",
    required: false,
    shortDesc: "🧪 The Lab",
    description: "Test artifacts and results",
    details: {
      beginner: "Holds the instructions for automated tests. The AI writes code to test its own code, ensuring that fixing one thing today doesn't break another thing tomorrow.",
      expert: "Test-Driven Development (TDD) harness definitions. Maps the unit and integration testing strategies, coverage thresholds, and mock data structures required to validate the business logic."
    }
  },
  {
    name: "SECURITY",
    category: "quality",
    required: false,
    shortDesc: "🛡️ The Bouncer",
    description: "Security analysis",
    details: {
      beginner: "A security scan where the AI looks for places hackers could attack your app, like weak passwords, data leaks, or exposed database links.",
      expert: "Static Application Security Testing (SAST) guidelines. Instructions for the agent to actively hunt for OWASP Top 10 vulnerabilities (e.g., SQLi, XSS, CSRF, insecure references) during the implementation phase."
    }
  },
];

const SDD_SKILLS = {
  "sdd-wake": {
    description:
      "TRIGGER when: user wants to start a new feature, build something new, add functionality, or says 'nueva feature', 'new feature', 'quiero añadir', 'let\\'s build', 'next task', 'SDD_WAKE'. Activates the SDD spec-driven development protocol and discovers project state.",
    prompt:
      "Run the SDD_WAKE protocol. Discover the .sdd/ directory, read artifact frontmatters, check chain integrity using .sdd/config.json, perform capabilities handshake, and report status with a suggested next action.",
  },
  "sdd-next": {
    description:
      "TRIGGER when: user asks what to do next, wants to continue work, or says 'next step', 'what now', 'siguiente paso'. Determines the next step in the SDD workflow.",
    prompt:
      "Analyze the current .sdd/ artifacts and their statuses to determine the next logical step in the SDD workflow. Report the current state, dependency order if applicable, and the recommended action.",
  },
  "sdd-status": {
    description:
      "TRIGGER when: user asks about project status, progress, or says 'how is it going', 'status', 'como va'. Shows current SDD project status and progress.",
    prompt:
      "Run SDD_STATUS. For each project slug in .sdd/, report: artifact states, progress percentage (completed/total tasks), any blocking issues, and current capabilities.",
  },
};

module.exports = {
  SPEC_FILENAME,
  TEMPLATES_DIR,
  SPEC_SOURCE,
  VALID_STATES,
  AGENT_REGISTRY,
  SDD_CATEGORIES,
  SDD_ARTIFACTS,
  SDD_SKILLS,
};
