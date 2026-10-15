import { spawn } from "node:child_process";
import { access, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const project = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const skipWeb = args.includes("--skip-web-build");
const destinationIndex = args.indexOf("--output");
const output = resolve(
  destinationIndex >= 0
    ? args[destinationIndex + 1]
    : join(project, "..", "artifacts", "cajitas-android-test.apk"),
);
const sdk =
  process.env.ANDROID_HOME ||
  process.env.ANDROID_SDK_ROOT ||
  "/workspace/.local/android-sdk";
const env = { ...process.env, ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk };

async function run(command, parameters, cwd = project) {
  await new Promise((resolveRun, reject) => {
    const child = spawn(command, parameters, { cwd, env, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolveRun()
        : reject(new Error(`${command} exited with ${code}`)),
    );
  });
}

try {
  if (!env.JAVA_HOME) {
    try {
      await access("/workspace/.local/jdk-21/bin/javac", constants.X_OK);
      env.JAVA_HOME = "/workspace/.local/jdk-21";
    } catch {
      // A developer machine can use its normal JDK on PATH.
    }
  }
  await access(join(sdk, "platforms", "android-36"), constants.R_OK);
  if (!skipWeb) await run("npm", ["run", "build:native"]);
  await run(process.execPath, [
    "node_modules/@capacitor/cli/bin/capacitor",
    "sync",
    "android",
  ]);

  const gradleArgs = ["--no-daemon", "--console=plain", "--max-workers=2"];
  // Java tools don't automatically read the session's HTTP(S)_PROXY variables.
  const proxyValue =
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy;
  if (proxyValue) {
    const proxy = new URL(proxyValue);
    const port = proxy.port || (proxy.protocol === "https:" ? "443" : "80");
    for (const protocol of ["http", "https"]) {
      gradleArgs.push(
        `-D${protocol}.proxyHost=${proxy.hostname}`,
        `-D${protocol}.proxyPort=${port}`,
      );
    }
    if (process.env.CODEX_PROXY_CERT) {
      // Debian's Java trust store includes the managed session CA.
      try {
        await access("/etc/ssl/certs/java/cacerts", constants.R_OK);
        gradleArgs.push(
          "-Djavax.net.ssl.trustStore=/etc/ssl/certs/java/cacerts",
        );
      } catch {
        // Other systems use the configured JDK trust store.
      }
    }
  }
  gradleArgs.push(":app:assembleDebug");
  await run(
    process.platform === "win32" ? "gradlew.bat" : "./gradlew",
    gradleArgs,
    join(project, "android"),
  );
  await mkdir(dirname(output), { recursive: true });
  await copyFile(
    join(
      project,
      "android",
      "app",
      "build",
      "outputs",
      "apk",
      "debug",
      "app-debug.apk",
    ),
    output,
  );
  const apk = await readFile(output);
  const hash = createHash("sha256").update(apk).digest("hex");
  await writeFile(
    `${output}.sha256`,
    `${hash}  ${output.split(/[\\/]/).pop()}\n`,
  );
  console.log(
    `\nAndroid test APK: ${output}\nSHA-256: ${hash}\nSigned with the local Android debug key; use only for testing.`,
  );
} catch (error) {
  console.error(`Android build failed: ${error.message}`);
  console.error(
    "Install JDK 21 and Android SDK platform 36 / build-tools 35.0.0; set ANDROID_HOME to its directory.",
  );
  process.exitCode = 1;
}
