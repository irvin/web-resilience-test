const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const reportDir = path.resolve(__dirname, "..");
const repoDir = path.resolve(reportDir, "..");

function run(command, cwd = repoDir, options = {}) {
  return execSync(command, { cwd, stdio: "inherit", ...options });
}

function runText(command, cwd = repoDir) {
  return execSync(command, { cwd, encoding: "utf8" }).trim();
}

function resolvePathFromRepoRoot(targetPath) {
  if (!targetPath) return targetPath;
  return path.isAbsolute(targetPath)
    ? targetPath
    : path.resolve(repoDir, targetPath);
}

function getTargetBranch() {
  return process.env.REPORT_BRANCH || "report";
}

function getConfiguredWorktreePath() {
  return resolvePathFromRepoRoot(
    process.env.REPORT_WORKTREE_PATH || "report/publish"
  );
}

function listWorktrees() {
  const raw = runText("git worktree list --porcelain", repoDir);
  if (!raw) return [];

  return raw
    .split(/\n\n+/)
    .filter(Boolean)
    .map((block) => {
      const lines = block.split("\n");
      const worktreeLine = lines.find((line) => line.startsWith("worktree "));
      const branchLine = lines.find((line) => line.startsWith("branch "));
      return {
        path: worktreeLine ? worktreeLine.replace(/^worktree\s+/, "").trim() : "",
        branchRef: branchLine
          ? branchLine.replace(/^branch\s+/, "").trim()
          : null,
        prunable: lines.some((line) => line.startsWith("prunable ")),
      };
    });
}

function findBranchWorktree(targetBranch = getTargetBranch()) {
  return (
    listWorktrees().find(
      (worktree) => worktree.branchRef === `refs/heads/${targetBranch}`
    ) || null
  );
}

function branchExists(targetBranch = getTargetBranch()) {
  try {
    runText(`git show-ref --verify --quiet refs/heads/${targetBranch}`, repoDir);
    return true;
  } catch {
    return false;
  }
}

function isGitWorktreePath(targetPath) {
  if (!fs.existsSync(targetPath)) return false;
  return fs.existsSync(path.join(targetPath, ".git"));
}

function isUsableWorktree(worktree) {
  return Boolean(
    worktree &&
      !worktree.prunable &&
      worktree.path &&
      isGitWorktreePath(worktree.path)
  );
}

function ensureReportWorktree() {
  const targetBranch = getTargetBranch();
  const configuredPath = getConfiguredWorktreePath();
  let existingBranchWorktree = findBranchWorktree(targetBranch);

  if (isUsableWorktree(existingBranchWorktree)) {
    return {
      path: existingBranchWorktree.path,
      branch: targetBranch,
      created: false,
      reused: true,
      overridden:
        path.resolve(existingBranchWorktree.path) !==
        path.resolve(configuredPath),
    };
  }

  if (existingBranchWorktree) {
    run("git worktree prune", repoDir);
    existingBranchWorktree = findBranchWorktree(targetBranch);
    if (isUsableWorktree(existingBranchWorktree)) {
      return {
        path: existingBranchWorktree.path,
        branch: targetBranch,
        created: false,
        reused: true,
        overridden:
          path.resolve(existingBranchWorktree.path) !==
          path.resolve(configuredPath),
      };
    }
  }

  if (fs.existsSync(configuredPath) && !isGitWorktreePath(configuredPath)) {
    throw new Error(
      [
        `Target path already exists but is not a git worktree: ${configuredPath}`,
        "Please remove or rename that directory, or set REPORT_WORKTREE_PATH to another location.",
      ].join("\n")
    );
  }

  const parentDir = path.dirname(configuredPath);
  fs.mkdirSync(parentDir, { recursive: true });

  const quotedPath = JSON.stringify(configuredPath);
  const quotedBranch = JSON.stringify(targetBranch);
  const command = branchExists(targetBranch)
    ? `git worktree add ${quotedPath} ${quotedBranch}`
    : `git worktree add -b ${quotedBranch} ${quotedPath}`;

  run(command, repoDir);

  return {
    path: configuredPath,
    branch: targetBranch,
    created: true,
    reused: false,
    overridden: false,
  };
}

function resolveReportWorktreeDir() {
  const targetBranch = getTargetBranch();
  const configuredPath = getConfiguredWorktreePath();
  const branchWorktree = findBranchWorktree(targetBranch);

  if (isUsableWorktree(branchWorktree)) {
    return branchWorktree.path;
  }

  throw new Error(
    [
      `Cannot find a worktree for branch '${targetBranch}'.`,
      "Run `npm run init-worktree` in report/ first, or set REPORT_WORKTREE_PATH to an existing worktree path.",
      `Expected default path: ${configuredPath}`,
      branchWorktree
        ? `Git still has stale metadata for this branch at: ${branchWorktree.path}`
        : "No existing worktree metadata was found for this branch.",
    ].join("\n")
  );
}

module.exports = {
  repoDir,
  reportDir,
  run,
  runText,
  getTargetBranch,
  getConfiguredWorktreePath,
  listWorktrees,
  findBranchWorktree,
  branchExists,
  isGitWorktreePath,
  isUsableWorktree,
  ensureReportWorktree,
  resolveReportWorktreeDir,
};
