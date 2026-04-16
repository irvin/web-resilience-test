const {
  ensureReportWorktree,
  getConfiguredWorktreePath,
} = require("./report-worktree");

function main() {
  const result = ensureReportWorktree();
  const configuredPath = getConfiguredWorktreePath();

  if (result.created) {
    console.log(`Created report worktree at ${result.path}`);
    return;
  }

  console.log(`Reusing existing report worktree at ${result.path}`);
  if (result.overridden) {
    console.log(
      `Configured path ${configuredPath} was ignored because branch '${result.branch}' already has a worktree.`
    );
  }
}

main();
