import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const sqlDir = join(root, "supabase", "migrations");
const functionsDir = join(root, "supabase", "functions");
const configPath = join(root, "supabase", "config.toml");
const envExamplePath = join(root, ".env.example");
const envManifestPath = join(root, "config", "production-env.json");

const read = (path) => readFileSync(path, "utf8");
const readIfExists = (path) => (existsSync(path) ? read(path) : null);
const findEnvRefs = (source) => [
  ...source.matchAll(/(?:Deno\.env\.get|requireEnv|getEnv)\(["']([A-Z0-9_]+)["']/g),
].map((match) => match[1]);
const listFiles = (dir, predicate) =>
  readdirSync(dir)
    .map((name) => join(dir, name))
    .filter((path) => statSync(path).isFile() && predicate(path));
const listFilesRecursive = (dir, predicate) =>
  readdirSync(dir)
    .flatMap((name) => {
      const path = join(dir, name);
      const stats = statSync(path);
      if (stats.isDirectory()) return listFilesRecursive(path, predicate);
      return stats.isFile() && predicate(path) ? [path] : [];
    });

const sql = listFiles(sqlDir, (path) => path.endsWith(".sql"))
  .map(read)
  .join("\n");

const createdTables = new Set(
  [...sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-zA-Z0-9_]+)/gi)]
    .map((match) => match[1]),
);

const rlsTables = new Set(
  [...sql.matchAll(/ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?([a-zA-Z0-9_]+)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi)]
    .map((match) => match[1]),
);

const policyTables = new Set(
  [...sql.matchAll(/CREATE\s+POLICY\s+[^;]+?\s+ON\s+(?:public\.)?([a-zA-Z0-9_]+)/gis)]
    .map((match) => match[1]),
);

const criticalTables = [
  "admin_permissions",
  "bank_details",
  "contracts",
  "invoices",
  "landlord_mpesa_settings",
  "leases",
  "maintenance_requests",
  "manager_invoices",
  "manager_mpesa_settings",
  "payment_receipts",
  "payment_transactions",
  "profiles",
  "properties",
  "tenants",
  "uploaded_documents",
  "user_roles",
  "webhost_payment_settings",
];

const missingCriticalRls = criticalTables.filter((table) => createdTables.has(table) && !rlsTables.has(table));
const missingCriticalPolicies = criticalTables.filter((table) => createdTables.has(table) && !policyTables.has(table));

const publicPolicies = [...sql.matchAll(/CREATE\s+POLICY\s+"([^"]+)"\s+ON\s+(?:public\.)?([a-zA-Z0-9_]+)[^;]+USING\s*\(\s*true\s*\)/gis)]
  .map((match) => `${match[2]}: ${match[1]}`)
  .filter((entry) => !entry.startsWith("provider_reviews:") && !entry.startsWith("property_tier_limits:"));
const uniquePublicPolicies = [...new Set(publicPolicies)];

const functionNames = readdirSync(functionsDir)
  .map((name) => join(functionsDir, name))
  .filter((path) => statSync(path).isDirectory())
  .filter((path) => !path.split(/[\\/]/).pop().endsWith(".bak"))
  .filter((path) => {
    try {
      return statSync(join(path, "index.ts")).isFile();
    } catch {
      return false;
    }
  })
  .map((path) => path.split(/[\\/]/).pop())
  .sort();

const config = read(configPath);
const configuredFunctionNames = new Set(
  [...config.matchAll(/\[functions\.([^\]]+)\]/g)].map((match) => match[1]),
);
const unconfiguredFunctions = functionNames.filter((name) => !configuredFunctionNames.has(name));

const missingEnvByFunction = [];
for (const name of functionNames) {
  const source = read(join(functionsDir, name, "index.ts"));
  const envVars = [...new Set(findEnvRefs(source))].sort();
  const requiredExternal = envVars.filter((env) =>
    !["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"].includes(env)
  );
  if (requiredExternal.length > 0) {
    missingEnvByFunction.push({ name, envVars: requiredExternal });
  }
}

const failures = [
  ...missingCriticalRls.map((table) => `Critical table is missing RLS: ${table}`),
  ...missingCriticalPolicies.map((table) => `Critical table is missing at least one policy: ${table}`),
];

const envExample = read(envExamplePath);
const envManifest = JSON.parse(read(envManifestPath));
if (/calqulusrms-demo-2026/i.test(envExample)) {
  failures.push("Default demo seed secret is present in .env.example");
}

const allManifestSecrets = new Set([
  ...envManifest.frontend.required,
  ...Object.keys(envManifest.frontend.productionDefaults),
  ...(envManifest.frontend.optional ?? []),
  ...envManifest.supabase.providedBySupabase,
  ...envManifest.supabase.requiredSecrets,
  ...envManifest.supabase.paymentProviderSecrets,
]);

const documentedEnvVars = new Set([...envExample.matchAll(/^#?\s*([A-Z][A-Z0-9_]+)=/gm)].map((match) => match[1]));
for (const env of envManifest.frontend.required) {
  if (!documentedEnvVars.has(env)) failures.push(`Frontend env var missing from .env.example: ${env}`);
}
for (const env of Object.keys(envManifest.frontend.productionDefaults)) {
  if (!documentedEnvVars.has(env)) failures.push(`Frontend production default missing from .env.example: ${env}`);
}

const checklist = readIfExists(join(root, "PRODUCTION_CHECKLIST.md"));
if (!checklist) {
  failures.push("PRODUCTION_CHECKLIST.md is missing at project root");
} else {
  for (const env of [...envManifest.supabase.requiredSecrets, ...envManifest.supabase.paymentProviderSecrets]) {
    if (!checklist.includes(`\`${env}\``)) failures.push(`Secret missing from PRODUCTION_CHECKLIST.md: ${env}`);
  }
}

const demoPanelPath = join(root, "src", "features", "demo", "DemoControlPanel.tsx");
const demoPanel = readIfExists(demoPanelPath);
if (demoPanel) {
  if (/calqulusrms-demo-2026/i.test(demoPanel)) {
    failures.push("Default demo seed secret is hardcoded in DemoControlPanel");
  }
  if (!/VITE_ENABLE_PUBLIC_DEMO/.test(demoPanel)) {
    failures.push("DemoControlPanel is not gated by VITE_ENABLE_PUBLIC_DEMO");
  }
}

const landlordAuthPath = join(root, "src", "features", "auth", "pages", "LandlordPortalAuth.tsx");
const landlordAuth = readIfExists(landlordAuthPath) ?? "";
if (/Demo@2026|demo\.[a-z0-9_-]+@calqulusrms\.ink/i.test(landlordAuth) && !/VITE_ENABLE_PUBLIC_DEMO/.test(landlordAuth)) {
  failures.push("LandlordPortalAuth exposes demo credentials without VITE_ENABLE_PUBLIC_DEMO gating");
}

const forbiddenProductionUrls = [
  "calqulusrms.lovable.app",
  "calqulusrmscom.lovable.app",
  "calqulusrmsfinal.netlify.app",
];
for (const url of forbiddenProductionUrls) {
  if (sql.includes(url)) failures.push(`Forbidden hardcoded production URL in migrations: ${url}`);
}
for (const name of functionNames) {
  const source = read(join(functionsDir, name, "index.ts"));
  for (const url of forbiddenProductionUrls) {
    if (source.includes(url)) failures.push(`Forbidden hardcoded production URL in function ${name}: ${url}`);
  }
}

const referencedSupabaseEnv = new Set();
for (const name of functionNames) {
  const source = read(join(functionsDir, name, "index.ts"));
  if (source.includes("Deno.env.get")) {
    failures.push(`Function ${name} uses raw Deno.env.get instead of _shared/env helpers`);
  }
  for (const env of findEnvRefs(source)) {
    referencedSupabaseEnv.add(env);
  }
}
for (const env of referencedSupabaseEnv) {
  if (!allManifestSecrets.has(env)) failures.push(`Supabase env var is referenced but missing from production-env.json: ${env}`);
}

const sourceFiles = [
  ...listFilesRecursive(join(root, "src"), (path) => path.endsWith(".ts") || path.endsWith(".tsx")),
];
const referencedFrontendEnv = new Set();
for (const file of sourceFiles) {
  const source = read(file);
  for (const match of source.matchAll(/import\.meta\.env\.([A-Z0-9_]+)/g)) {
    referencedFrontendEnv.add(match[1]);
  }
}
for (const env of referencedFrontendEnv) {
  if (!allManifestSecrets.has(env) && env !== "DEV" && env !== "MODE" && env !== "PROD") {
    failures.push(`Frontend env var is referenced but missing from production-env.json: ${env}`);
  }
}

const forbiddenHardcodedSupabaseUrls = [
  "aelzsqxllkypbzslxyju.supabase.co",
];
for (const file of sourceFiles) {
  const source = read(file);
  for (const url of forbiddenProductionUrls) {
    if (source.includes(url)) failures.push(`Forbidden hardcoded production URL in ${file}: ${url}`);
  }
  for (const url of forbiddenHardcodedSupabaseUrls) {
    if (source.includes(url)) failures.push(`Forbidden hardcoded Supabase URL in ${file}: ${url}`);
  }
}

const functionFiles = listFilesRecursive(functionsDir, (path) => path.endsWith(".ts"));
for (const file of functionFiles) {
  const source = read(file);
  if (/\.\.\.corsHeaders/.test(source) && !/\b(?:const|let|var)\s+corsHeaders\b/.test(source)) {
    failures.push(`Function file spreads undefined corsHeaders instead of getCorsHeaders(req): ${file}`);
  }
  for (const url of forbiddenProductionUrls) {
    if (source.includes(url)) failures.push(`Forbidden hardcoded production URL in function file ${file}: ${url}`);
  }
  for (const url of forbiddenHardcodedSupabaseUrls) {
    if (source.includes(url)) failures.push(`Forbidden hardcoded Supabase URL in function file ${file}: ${url}`);
  }
}

const processPaymentSource = read(join(functionsDir, "process-payment", "index.ts"));
if (!/responseJson\?\.success\s*===\s*false/.test(processPaymentSource) || !/responseJson\?\.skipped\s*===\s*true/.test(processPaymentSource)) {
  failures.push("process-payment notification fanout must dead-letter provider-level success:false/skipped responses");
}

const paymentRemindersSource = read(join(functionsDir, "send-payment-reminders", "index.ts"));
if (!/Resend email failed/.test(paymentRemindersSource) || !/recipientStatus\s*!==\s*"Success"/.test(paymentRemindersSource)) {
  failures.push("send-payment-reminders must only count provider-confirmed email and SMS deliveries");
}

const bulkSmsSource = read(join(functionsDir, "send-bulk-sms", "index.ts"));
if (!/Provider did not return a status for this recipient/.test(bulkSmsSource) || !/Provider did not return recipient delivery statuses/.test(bulkSmsSource)) {
  failures.push("send-bulk-sms must account for missing provider recipient statuses");
}

const createInvoiceCheckoutSource = read(join(functionsDir, "create-invoice-checkout", "index.ts"));
if (!/Amount mismatch/.test(createInvoiceCheckoutSource) || !/payment_kind:\s*"tenant_invoice"/.test(createInvoiceCheckoutSource)) {
  failures.push("create-invoice-checkout must validate payable amount and tag tenant invoice sessions");
}

const stripeWebhookSource = read(join(functionsDir, "stripe-webhook", "index.ts"));
if (!/functions\/v1\/process-payment/.test(stripeWebhookSource) || !/stripe_checkout/.test(stripeWebhookSource)) {
  failures.push("stripe-webhook must route tenant invoice payments through process-payment");
}

const verifyMpesaStkSource = read(join(functionsDir, "verify-mpesa-stk-status", "index.ts"));
if (!/Forbidden: you can only view your own payment status/.test(verifyMpesaStkSource) || !/source:\s*'verify-mpesa-stk-status'/.test(verifyMpesaStkSource)) {
  failures.push("verify-mpesa-stk-status must authorize transaction lookup and dead-letter fallback processing failures");
}

const supabaseClientSource = read(join(root, "src", "integrations", "supabase", "client.ts"));
if (!/detectSessionInUrl:\s*true/.test(supabaseClientSource) || !/resetPasswordForEmail/.test(supabaseClientSource)) {
  failures.push("Supabase client must support recovery links and reset-password noop fallback");
}

const resetPasswordSource = read(join(root, "src", "features", "auth", "pages", "ResetPassword.tsx"));
if (!/supabase\.auth\.setSession/.test(resetPasswordSource) || !/portalLoginPath/.test(resetPasswordSource)) {
  failures.push("ResetPassword must hydrate Supabase recovery tokens and return users to the correct portal login");
}

const appSource = read(join(root, "src", "App.tsx"));
if (!/type=recovery/.test(appSource) || !/\/reset-password/.test(appSource)) {
  failures.push("AppRoutes must route root-level Supabase recovery links to /reset-password");
}

const routesSource = read(join(root, "src", "app", "routes.ts"));
if (!/path:\s*"\/tenant\/invitation"/.test(routesSource)) {
  failures.push("Tenant invitation acceptance route must be public");
}

for (const loginPage of ["Auth.tsx", "TenantLogin.tsx", "WebhostAuth.tsx"]) {
  const loginSource = read(join(root, "src", "features", "auth", "pages", loginPage));
  if (!/ensureSignedInRole/.test(loginSource)) {
    failures.push(`${loginPage} must validate the signed-in role for its portal`);
  }
}

// LandlordPortalAuth guards by redirecting every signed-in role to its own
// portal (landlords to /landlord/dashboard, everyone else away) instead of
// calling ensureSignedInRole.
const landlordPortalAuth = read(join(root, "src", "features", "auth", "pages", "LandlordPortalAuth.tsx"));
if (!/userRole\.role\s*===\s*'landlord'/.test(landlordPortalAuth)) {
  failures.push("LandlordPortalAuth must route the signed-in role to the correct portal");
}

if (demoPanel) {
  if (!/Reset demo accounts/.test(demoPanel) || !/VITE_ENABLE_DEMO_SEED/.test(demoPanel)) {
    failures.push("DemoControlPanel must provide gated demo reset for staging");
  }
}

const seedDemoSource = read(join(functionsDir, "seed-demo-data", "index.ts"));
if (!/const results = await seedDemoData\(supabase\)/.test(seedDemoSource) || /\bheaders:\s*cors\b/.test(seedDemoSource)) {
  failures.push("seed-demo-data reset must reseed accounts and must not reference undefined cors headers");
}

console.log("Production audit");
console.log(`- Tables discovered: ${createdTables.size}`);
console.log(`- Tables with RLS: ${rlsTables.size}`);
console.log(`- Tables with policies: ${policyTables.size}`);
console.log(`- Edge functions discovered: ${functionNames.length}`);
console.log(`- Edge functions without explicit config.toml entry: ${unconfiguredFunctions.length}`);

const tsconfig = JSON.parse(read(join(root, "tsconfig.json")));
const pkg = JSON.parse(read(join(root, "package.json")));
if (!String(pkg.scripts?.typecheck || "").includes("tsconfig.app.json")) {
  failures.push("package.json typecheck must compile src via tsconfig.app.json (root tsconfig is a Vite stub with files:[]).");
}
if (Array.isArray(tsconfig.files) && tsconfig.files.length === 0) {
  console.log(
    "- Note: root tsconfig.json is a Vite project-references stub; npm run typecheck compiles tsconfig.app.json.",
  );
}

if (unconfiguredFunctions.length > 0) {
  console.log(`  ${unconfiguredFunctions.join(", ")}`);
}

if (uniquePublicPolicies.length > 0) {
  console.log("- Review public-style policies:");
  for (const entry of uniquePublicPolicies) console.log(`  ${entry}`);
}

if (missingEnvByFunction.length > 0) {
  console.log("- External secrets referenced by functions:");
  for (const item of missingEnvByFunction) {
    console.log(`  ${item.name}: ${item.envVars.join(", ")}`);
  }
}

if (failures.length > 0) {
  console.error("\nProduction audit failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Production audit passed.");
