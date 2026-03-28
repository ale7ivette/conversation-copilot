export const COPILOT_SCENARIOS = [
  "sales_call",
  "negotiation",
  "investor",
  "meeting",
] as const;

export type CopilotScenario = (typeof COPILOT_SCENARIOS)[number];

const STORAGE_KEY = "copilot-session-scenario";

export const SCENARIO_LABELS: Record<CopilotScenario, string> = {
  sales_call: "Sales call",
  negotiation: "Negotiation",
  investor: "Investor",
  meeting: "Meeting",
};

export function loadPersistedScenario(): CopilotScenario {
  if (typeof window === "undefined") return "sales_call";
  const v = localStorage.getItem(STORAGE_KEY)?.trim();
  if (v && (COPILOT_SCENARIOS as readonly string[]).includes(v)) {
    return v as CopilotScenario;
  }
  return "sales_call";
}

export function savePersistedScenario(s: CopilotScenario) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, s);
}
