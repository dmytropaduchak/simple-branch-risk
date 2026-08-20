export type Severity = "high" | "medium" | "low";
export type Finding = {
  ruleId: string;
  severity: Severity;
  title: string;
  detail: string;
  file: string;
};

export type ProtectionSnapshot = {
  exists: boolean;
  requiredReviews?: number;
  requireStatusChecks?: boolean;
  allowForcePushes?: boolean;
  allowDeletions?: boolean;
  enforceAdmins?: boolean;
};

export function evaluateProtection(branch: string, p: ProtectionSnapshot): Finding[] {
  const findings: Finding[] = [];
  const file = `branch:${branch}`;

  if (!p.exists) {
    findings.push({
      ruleId: "no-protection",
      severity: "high",
      title: `No branch protection on ${branch}`,
      detail: "Enable branch protection so force-pushes and unprotected merges are blocked.",
      file,
    });
    return findings;
  }

  if ((p.requiredReviews ?? 0) < 1) {
    findings.push({
      ruleId: "no-required-reviews",
      severity: "high",
      title: "No required pull request reviews",
      detail: "Require at least one approving review before merge.",
      file,
    });
  }

  if (!p.requireStatusChecks) {
    findings.push({
      ruleId: "no-status-checks",
      severity: "medium",
      title: "Status checks not required",
      detail: "Require status checks to pass before merging.",
      file,
    });
  }

  if (p.allowForcePushes) {
    findings.push({
      ruleId: "allow-force-pushes",
      severity: "high",
      title: "Force pushes allowed",
      detail: "Disable force pushes on the default branch.",
      file,
    });
  }

  if (p.allowDeletions) {
    findings.push({
      ruleId: "allow-deletions",
      severity: "medium",
      title: "Branch deletions allowed",
      detail: "Disallow deletion of the default branch.",
      file,
    });
  }

  if (!p.enforceAdmins) {
    findings.push({
      ruleId: "admins-not-enforced",
      severity: "low",
      title: "Admins not enforced",
      detail: "Consider enforcing rules for administrators as well.",
      file,
    });
  }

  return findings;
}
