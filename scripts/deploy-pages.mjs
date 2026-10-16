import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const execute = promisify(execFile);
const project = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const branch = "gh-pages";
const auth = process.env.GH_TOKEN
  ? [
      "-c",
      "credential.helper=",
      "-c",
      "credential.helper=!gh auth git-credential",
    ]
  : [];
async function git(args, cwd) {
  return (
    await execute("git", [...auth, ...args], {
      cwd,
      maxBuffer: 2 * 1024 * 1024,
    })
  ).stdout.trim();
}
let staging;
try {
  if (!process.argv.includes("--skip-build"))
    await execute("npm", ["run", "build:pages"], {
      cwd: project,
      maxBuffer: 2 * 1024 * 1024,
    });
  const manifest = JSON.parse(
    await readFile(join(project, "dist", "manifest.webmanifest"), "utf8"),
  );
  if (manifest.start_url !== "/CAJITAS-/")
    throw new Error("Compila primero con npm run build:pages.");
  const remote = await git(["remote", "get-url", "origin"], project);
  const existing = await git(
    ["ls-remote", remote, `refs/heads/${branch}`],
    project,
  );
  const source = await git(["rev-parse", "--short", "HEAD"], project);
  staging = await mkdtemp(join(tmpdir(), "guardadito-pages-"));
  await git(["init", "--initial-branch", branch], staging);
  await git(["remote", "add", "origin", remote], staging);
  if (existing) {
    await git(["fetch", "--depth", "1", "origin", branch], staging);
    await git(["checkout", "-B", branch, "FETCH_HEAD"], staging);
    // Keep the published APKs: they are built separately and not part of dist.
    await git(
      ["rm", "-r", "--ignore-unmatch", "--", ".", ":(exclude)descargas"],
      staging,
    );
  }
  await cp(join(project, "dist"), staging, { recursive: true });
  await writeFile(join(staging, ".nojekyll"), "");
  await git(["add", "--all"], staging);
  const changes = await git(["diff", "--cached", "--name-only"], staging);
  if (!changes) console.log("La web publicada ya contiene esta compilación.");
  else {
    await git(
      [
        "-c",
        "user.name=Codex",
        "-c",
        "user.email=codex@openai.com",
        "commit",
        "-m",
        `deploy: Guardadito Pages from ${source}`,
      ],
      staging,
    );
    await git(["push", "origin", `${branch}:${branch}`], staging);
    console.log(
      "Compilación publicada en gh-pages. URL: https://gerardobr01.github.io/CAJITAS-/",
    );
  }
} catch (error) {
  console.error(
    "No se pudo publicar Pages:",
    error.stderr?.trim() || error.message,
  );
  process.exitCode = 1;
} finally {
  if (staging) await rm(staging, { recursive: true, force: true });
}
