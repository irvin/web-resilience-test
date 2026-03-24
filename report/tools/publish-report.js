const { execSync } = require("child_process");
const path = require("path");

const reportDir = path.resolve(__dirname, "..");
const repoDir = path.resolve(reportDir, "..");

function run(command, cwd) {
  execSync(command, { cwd, stdio: "inherit" });
}

function runText(command, cwd) {
  return execSync(command, { cwd, encoding: "utf8" }).trim();
}

function resolveReportWorktreeDir() {
  const override = process.env.REPORT_WORKTREE_PATH;
  if (override) return path.resolve(repoDir, override);

  const targetBranch = process.env.REPORT_BRANCH || "report";
  const raw = runText("git worktree list --porcelain", repoDir);
  const blocks = raw.split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.split("\n");
    const worktreeLine = lines.find((line) => line.startsWith("worktree "));
    const branchLine = lines.find((line) => line.startsWith("branch "));
    if (!worktreeLine || !branchLine) continue;
    if (branchLine.trim() === `branch refs/heads/${targetBranch}`) {
      return worktreeLine.replace(/^worktree\s+/, "").trim();
    }
  }

  throw new Error(
    [
      `Cannot find a worktree for branch '${targetBranch}'.`,
      "Please create it first, e.g.:",
      `git worktree add report/publish ${targetBranch}`,
      "Or set REPORT_WORKTREE_PATH to an existing worktree path.",
    ].join("\n")
  );
}

function main() {
  const worktreeDir = resolveReportWorktreeDir();
  const targetBranch = process.env.REPORT_BRANCH || "report";
  const commitMessage = process.env.REPORT_COMMIT_MESSAGE || "Update report";

  // Step 1: Build latest artifacts into report branch worktree
  run("node tools/build-report-root.js", reportDir);

  // Step 2: Commit and push if changed
  const status = runText("git status --porcelain", worktreeDir);
  if (!status) {
    console.log("No changes detected in report worktree, nothing to publish.");
    return;
  }

  run("git add .", worktreeDir);
  run(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, worktreeDir);

  // Push with existing upstream if present; otherwise set upstream to default remote.
  let hasUpstream = true;
  try {
    runText("git rev-parse --abbrev-ref --symbolic-full-name @{u}", worktreeDir);
  } catch {
    hasUpstream = false;
  }

  if (hasUpstream) {
    run("git push", worktreeDir);
    return;
  }

  const remote = process.env.REPORT_REMOTE || runText("git remote", repoDir).split("\n")[0];
  if (!remote) {
    throw new Error("No git remote found. Set REPORT_REMOTE or add a remote first.");
  }
  run(`git push -u ${remote} ${targetBranch}`, worktreeDir);
}

main();
