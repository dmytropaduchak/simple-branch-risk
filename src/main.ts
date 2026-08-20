import * as core from "@actions/core";
import * as github from "@actions/github";
import { evaluateProtection, type Finding, type ProtectionSnapshot } from "./rules";

const MARKER = "<!-- simple-branch-risk -->";
const NAME = "Simple Branch Risk";

function formatFindings(findings: Finding[]): string {
  if (!findings.length) {
    return [MARKER, `## ${NAME}`, "", "Default branch protection looks OK for the basic checks."].join("\n");
  }
  const rows = findings
    .map((f) => `| ${f.severity} | \`${f.ruleId}\` | ${f.file} | ${f.title} |`)
    .join("\n");
  return [
    MARKER,
    `## ${NAME}`,
    "",
    `Found **${findings.length}** issue(s).`,
    "",
    "| Severity | Rule | Location | Detail |",
    "| --- | --- | --- | --- |",
    rows,
  ].join("\n");
}

async function upsertPrComment(token: string, body: string): Promise<void> {
  const { context } = github;
  if (context.eventName !== "pull_request" && context.eventName !== "pull_request_target") return;
  const issue_number = context.payload.pull_request?.number;
  if (!issue_number) return;
  const octokit = github.getOctokit(token);
  const { data: comments } = await octokit.rest.issues.listComments({ ...context.repo, issue_number });
  const existing = comments.find((c) => c.body?.includes(MARKER));
  if (existing) {
    await octokit.rest.issues.updateComment({ ...context.repo, comment_id: existing.id, body });
    return;
  }
  await octokit.rest.issues.createComment({ ...context.repo, issue_number, body });
}

async function loadProtection(token: string): Promise<{ branch: string; snap: ProtectionSnapshot }> {
  const octokit = github.getOctokit(token);
  const { context } = github;
  const { data: repo } = await octokit.rest.repos.get({ ...context.repo });
  const branch = repo.default_branch;

  try {
    const { data } = await octokit.rest.repos.getBranchProtection({
      ...context.repo,
      branch,
    });
    const snap: ProtectionSnapshot = {
      exists: true,
      requiredReviews: data.required_pull_request_reviews?.required_approving_review_count ?? 0,
      requireStatusChecks: Boolean(data.required_status_checks),
      allowForcePushes: Boolean(data.allow_force_pushes?.enabled),
      allowDeletions: Boolean(data.allow_deletions?.enabled),
      enforceAdmins: Boolean(data.enforce_admins?.enabled),
    };
    return { branch, snap };
  } catch (e: unknown) {
    const status = (e as { status?: number })?.status;
    if (status === 404) return { branch, snap: { exists: false } };
    // On free private repos / missing admin permission, surface as finding
    if (status === 403) {
      return {
        branch,
        snap: { exists: false },
      };
    }
    throw e;
  }
}

async function run(): Promise<void> {
  const token = core.getInput("github-token") || process.env.GITHUB_TOKEN || "";
  const failOn = (core.getInput("fail-on") || "none").toLowerCase();
  if (!token) {
    core.setFailed("github-token is required");
    return;
  }

  const { branch, snap } = await loadProtection(token);
  let findings = evaluateProtection(branch, snap);
  if (!snap.exists) {
    // clarify 403 vs truly missing — still high
    core.warning(
      "Branch protection missing or token cannot read it (needs admin on private repos). Treating as unprotected.",
    );
  }

  const summary = formatFindings(findings);
  await core.summary.addRaw(summary, true).write();
  for (const f of findings) {
    if (f.severity === "high") core.error(`${f.title} (${f.ruleId})`);
    else if (f.severity === "medium") core.warning(`${f.title} (${f.ruleId})`);
    else core.notice(`${f.title} (${f.ruleId})`);
  }
  try {
    await upsertPrComment(token, summary);
  } catch (e) {
    core.warning(`Could not post PR comment: ${e instanceof Error ? e.message : String(e)}`);
  }
  core.setOutput("finding-count", String(findings.length));
  const shouldFail =
    failOn === "high"
      ? findings.some((f) => f.severity === "high")
      : failOn === "medium"
        ? findings.some((f) => f.severity === "high" || f.severity === "medium")
        : false;
  if (shouldFail) core.setFailed(`simple-branch-risk: ${findings.length} finding(s)`);
  else core.info(`Done. ${findings.length} finding(s) on ${branch}.`);
}

run().catch((e) => core.setFailed(e instanceof Error ? e.message : String(e)));
