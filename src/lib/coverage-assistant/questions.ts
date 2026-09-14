import type { CoveragePreferences } from "@/lib/coverage-assistant/schema";

type PreferenceKey = keyof CoveragePreferences;

export type CoverageQuestion = {
  key: PreferenceKey;
  prompt: string;
  options: ReadonlyArray<{ value: CoveragePreferences[PreferenceKey]; label: string }>;
};

export const COVERAGE_ASSISTANT_QUESTIONS: ReadonlyArray<CoverageQuestion> = [
  {
    key: "ownVehicleProtection",
    prompt: "How important is protecting your own vehicle from accidental damage?",
    options: [
      { value: "VERY_IMPORTANT", label: "Very important" },
      { value: "SOMEWHAT_IMPORTANT", label: "Somewhat important" },
      { value: "NOT_A_PRIORITY", label: "Not a priority" },
    ],
  },
  {
    key: "costPreference",
    prompt: "Which matters more to you?",
    options: [
      { value: "BROADER_PROTECTION", label: "Broader protection" },
      { value: "BALANCED", label: "A balance of protection and cost" },
      { value: "LOWEST_COST", label: "Keeping the premium as low as possible" },
    ],
  },
  {
    key: "repairCostComfort",
    prompt: "If your vehicle needed a major repair after an accident, how comfortable would you be paying for it yourself?",
    options: [
      { value: "PREFER_INSURANCE_HELP", label: "I would prefer insurance to help cover it" },
      { value: "CAN_HANDLE_SOME", label: "I could handle some repair costs" },
      { value: "COMFORTABLE_SELF_FUNDING", label: "I am comfortable covering my own vehicle repairs" },
    ],
  },
  {
    key: "protectionPriority",
    prompt: "What are you mainly looking to protect?",
    options: [
      { value: "VEHICLE_AND_LIABILITY", label: "My vehicle and liability to others" },
      { value: "BALANCED", label: "A balance of both" },
      { value: "MAINLY_LIABILITY", label: "Mainly liability to other people and property" },
    ],
  },
  {
    key: "riskPreference",
    prompt: "Which description fits you best?",
    options: [
      { value: "STRONGER_PROTECTION", label: "I prefer stronger protection and predictability" },
      { value: "BALANCED", label: "I prefer balanced protection" },
      { value: "MORE_FINANCIAL_RISK", label: "I am comfortable taking more financial risk to reduce cost" },
    ],
  },
];

