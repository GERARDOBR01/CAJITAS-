import { loadEnv } from "vite";
import { gmailReadiness } from "../server/handler.js";

const flags = new Set(process.argv.slice(2));
if (
  [...flags].some((flag) => !["--production", "--web", "--json"].includes(flag))
) {
  console.error("Uso: npm run check:setup -- [--production] [--web] [--json]");
  process.exit(1);
}
Object.assign(
  process.env,
  loadEnv(
    flags.has("--production") ? "production" : "development",
    process.cwd(),
    "",
  ),
);
if (flags.has("--production")) process.env.NODE_ENV = "production";
const result = gmailReadiness(flags.has("--web"));
function publicOrigin(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash &&
      !url.username &&
      !url.password &&
      url.hostname.includes(".") &&
      !/^[\d.]+$/.test(url.hostname) &&
      !url.hostname.includes(":") &&
      !/(^|\.)(localhost|local|internal|test|invalid|example)$/.test(
        url.hostname,
      )
    );
  } catch {
    return false;
  }
}
const missing = new Set(result.missing);
if (flags.has("--production") && !publicOrigin(process.env.APP_ORIGIN))
  missing.add("APP_ORIGIN");
if (flags.has("--web")) {
  if (!publicOrigin(process.env.VITE_API_ORIGIN))
    missing.add("VITE_API_ORIGIN");
  else {
    try {
      if (
        new URL(process.env.VITE_API_ORIGIN).origin !==
        new URL(process.env.APP_ORIGIN || "http://localhost:5173").origin
      )
        missing.add("VITE_API_ORIGIN (debe coincidir con APP_ORIGIN)");
    } catch {
      missing.add("APP_ORIGIN");
    }
  }
}
const report = {
  ready: missing.size === 0,
  mode: flags.has("--production") ? "production" : "development",
  externalWeb: flags.has("--web"),
  missing: [...missing],
  optional: {
    banxicoConfigured: Boolean(process.env.BANXICO_TOKEN),
    bitsoConfigured: Boolean(
      process.env.BITSO_API_KEY &&
        process.env.BITSO_API_SECRET &&
        (process.env.BITSO_OWNER_PASSWORD || "").length >= 16,
    ),
  },
};
if (flags.has("--json")) console.log(JSON.stringify(report, null, 2));
else {
  console.log(
    report.ready
      ? "Configuración de Gmail completa."
      : "Gmail pendiente de configurar:",
  );
  for (const key of report.missing) console.log(`- ${key}`);
  console.log(
    "Solo se revisa la configuración local; no se contacta a Google ni se muestran valores secretos.",
  );
  console.log(
    "Guía: docs/GMAIL-SETUP.md. La importación local funciona sin estas variables.",
  );
}
process.exitCode = report.ready ? 0 : 2;
