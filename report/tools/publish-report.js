const {
  reportDir,
  repoDir,
  run,
  runText,
  ensureReportWorktree,
} = require("./report-worktree");

function main() {
  const worktree = ensureReportWorktree();
  const worktreeDir = worktree.path;
  const targetBranch = process.env.REPORT_BRANCH || "report";
  const commitMessage = process.env.REPORT_COMMIT_MESSAGE || "Update report";

  // Step 1: Build latest slide and report artifacts into report branch worktree
  run("npm run build:slide", reportDir);
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
