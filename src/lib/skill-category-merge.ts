export function mergeSkillCategory(raw: string): string {
  const normalized = raw.trim().toLowerCase();

  if (["programming languages", "languages"].includes(normalized)) return "Languages";
  if (["data & ai", "ai/ml", "ai", "ml", "data & ai"].includes(normalized)) return "AI/ML";
  if (["frontend", "backend", "frameworks", "web"].includes(normalized)) return "Web";
  if (["databases", "data & analytics", "data analytics", "data"].includes(normalized))
    return "Data";
  if (["cloud & devops", "cloud/devops", "operating systems"].includes(normalized))
    return "Cloud & DevOps";
  if (
    ["version control & collaboration", "project management", "soft skills", "collaboration"].includes(
      normalized
    )
  ) {
    return "Business & People";
  }
  if (
    ["design & ux", "business & marketing", "finance & accounting", "product management"].includes(
      normalized
    )
  ) {
    return "Business & People";
  }
  if (["testing & qa", "security", "networking", "mobile"].includes(normalized))
    return "Engineering";
  if (normalized === "other") return "Other";

  return raw;
}
