export const TECHNOLOGY_OPTIONS: { value: string; usernameAbbrev: string }[] = [
  { value: "Java Developer", usernameAbbrev: "java" },
  { value: "Data Engineer", usernameAbbrev: "dataeng" },
  { value: ".NET Developer", usernameAbbrev: "dotnet" },
  { value: "AI/ML Engineer", usernameAbbrev: "aiml" },
  { value: "Data Scientist", usernameAbbrev: "datasci" },
  { value: "Network Engineer", usernameAbbrev: "network" },
  { value: "DevOps Engineer", usernameAbbrev: "devops" },
  { value: "Cybersecurity Engineer", usernameAbbrev: "cyber" },
  { value: "ServiceNow Developer", usernameAbbrev: "snow" },
  { value: "Business Analyst", usernameAbbrev: "ba" },
  { value: "Salesforce Developer", usernameAbbrev: "salesforce" },
];

export const OTHER_TECHNOLOGY_VALUE = "OTHER";

export function deriveOtherAbbrev(customText: string): string {
  return customText.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10);
}
