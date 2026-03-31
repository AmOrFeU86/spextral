const path = require("path");

const SPEC_FILENAME = "spextral.md";
const TEMPLATES_DIR = path.join(__dirname, "..", "templates");
const SPEC_SOURCE = path.join(TEMPLATES_DIR, SPEC_FILENAME);
const SKILLS_DIR = path.join(TEMPLATES_DIR, "skills");

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
  pi: {
    name: "Pi Coding Agent",
    dest: path.join(".pi", "spextral.md"),
    isFile: false,
    skills: { dir: path.join(".pi", "skills"), format: "skill-dir" },
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
    shortDesc: "Context, decisions & requirements",
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
    shortDesc: "Task roadmap with dependency graph",
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
    shortDesc: "Execution status tracking",
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
    shortDesc: "Recovery snapshots",
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
    shortDesc: "Validation report",
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
    shortDesc: "Devil-advocate code review",
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
    shortDesc: "Auto-generated unit tests",
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
    shortDesc: "OWASP security audit",
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
    templateFile: "sdd-wake.md",
  },
  "sdd-spec": {
    description:
      "TRIGGER when: user needs to create or edit a SPEC, define requirements, add decisions, or says 'create spec', 'define requirements', 'SDD_SPEC'. Creates a SPEC.md artifact.",
    templateFile: "sdd-spec.md",
  },
  "sdd-plan": {
    description:
      "TRIGGER when: user needs to create a PLAN, define tasks, map dependencies, or says 'create plan', 'plan tasks', 'SDD_PLAN'. Creates a PLAN.md artifact.",
    templateFile: "sdd-plan.md",
  },
  "sdd-implement": {
    description:
      "TRIGGER when: user wants to start coding, implement tasks, execute the plan, or says 'implement', 'start coding', 'SDD_IMPLEMENT'. Executes tasks from PLAN.md.",
    templateFile: "sdd-implement.md",
  },
  "sdd-review": {
    description:
      "TRIGGER when: user wants a devil-advocate review, code critique, or says 'review', 'devil advocate', 'SDD_REVIEW'. Analyzes SPEC and PLAN for issues.",
    templateFile: "sdd-review.md",
  },
  "sdd-test": {
    description:
      "TRIGGER when: user wants to generate tests, run testing, or says 'test', 'generate tests', 'SDD_TEST'. Generates and executes unit tests.",
    templateFile: "sdd-test.md",
  },
  "sdd-security": {
    description:
      "TRIGGER when: user wants a security audit, vulnerability check, or says 'security', 'audit', 'SDD_SECURITY'. Performs static security analysis.",
    templateFile: "sdd-security.md",
  },
  "sdd-next": {
    description:
      "TRIGGER when: user asks what to do next, wants to continue work, or says 'next step', 'what now', 'siguiente paso'. Determines the next step in the SDD workflow.",
    templateFile: "sdd-next.md",
  },
  "sdd-status": {
    description:
      "TRIGGER when: user asks about project status, progress, or says 'how is it going', 'status', 'como va'. Shows current SDD project status and progress.",
    templateFile: "sdd-status.md",
  },
};

module.exports = {
  SPEC_FILENAME,
  TEMPLATES_DIR,
  SPEC_SOURCE,
  SKILLS_DIR,
  VALID_STATES,
  AGENT_REGISTRY,
  SDD_CATEGORIES,
  SDD_ARTIFACTS,
  SDD_SKILLS,
};
