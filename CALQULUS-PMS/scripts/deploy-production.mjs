/**
 * deploy-production.mjs — Full production deployment helper for CALQULUS RMS
 *
 * Usage:
 *   node scripts/deploy-production.mjs [--dry-run]
 *
 * Steps:
 *   1. Verify all required secrets are set in .env.local
 *   2. Run production build
 *   3. Push to GitHub main branch → triggers Vercel auto-deploy
 *   4. Verify edge functions are deployed to Supabase
 *   5. Display payment configuration status
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const ENV_FILE = resolve(ROOT, '.env.local');

const REQUIRED_VARS = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
];

const OPTIONAL_VARS = [
  'VITE_SENTRY_DSN',
  'VITE_SENTRY_ENV',
  'VITE_AUTH_TIMEOUT_MS',
];

function log(label, msg, ok = true) {
  const icon = ok ? '✓' : '✗';
  console.log(`  ${icon} ${label}: ${msg}`);
}

function checkEnvVars() {
  console.log('\n📋 Checking environment variables...');
  if (!existsSync(ENV_FILE)) {
    log('.env.local', 'MISSING — create from .env.example', false);
    return false;
  }
  const content = readFileSync(ENV_FILE, 'utf-8');
  let allOk = true;
  for (const v of REQUIRED_VARS) {
    const match = content.match(new RegExp(`${v}=(.+)`));
    if (match && match[1].trim()) {
      log(v, match[1].trim().slice(0, 20) + '...');
    } else {
      log(v, 'NOT SET', false);
      allOk = false;
    }
  }
  for (const v of OPTIONAL_VARS) {
    const match = content.match(new RegExp(`${v}=(.+)`));
    if (match && match[1].trim()) {
      log(v, 'set');
    }
  }
  return allOk;
}

function checkSupabaseClient() {
  console.log('\n🔧 Checking CLI tools...');
  try {
    execSync('npx supabase --version', { stdio: 'pipe', cwd: ROOT });
    log('Supabase CLI', 'installed');
  } catch {
    log('Supabase CLI', 'NOT FOUND — install with: npm install -g supabase', false);
  }
}

function runBuild() {
  console.log('\n🏗️  Building production bundle...');
  try {
    execSync('npm run build', { stdio: 'inherit', cwd: ROOT });
    log('Build', 'successful');
    return true;
  } catch (e) {
    log('Build', 'FAILED', false);
    console.error(e.message);
    return false;
  }
}

function runChecks() {
  console.log('\n🔍 Running pre-deploy checks...');
  try {
    execSync('npx tsc --noEmit', { stdio: 'pipe', cwd: ROOT });
    log('TypeScript', 'no errors');
  } catch {
    log('TypeScript', 'has errors — fix before deploying', false);
    return false;
  }
  try {
    execSync('npx vitest run', { stdio: 'pipe', cwd: ROOT });
    log('Tests', 'passed');
  } catch {
    log('Tests', 'some failed', false);
    return false;
  }
  return true;
}

function getProjectRef() {
  const config = readFileSync(resolve(ROOT, 'supabase', 'config.toml'), 'utf-8');
  const match = config.match(/^project_id\s*=\s*\"([^\"]+)\"/m);
  if (!match) throw new Error('supabase/config.toml is missing project_id');
  return match[1];
}

function runDeploymentGates() {
  console.log('\n🛡️  Running production deployment gates...');
  for (const script of ['gate:environment', 'gate:reconciliation']) {
    try {
      execSync(`npm run ${script}`, { stdio: 'inherit', cwd: ROOT });
    } catch {
      log(script, 'FAILED — deployment blocked', false);
      return false;
    }
  }
  return true;
}

function deployEdgeFunctions() {
  console.log('\n⚡ Deploying Supabase Edge Functions...');
  try {
    execSync(`npx supabase functions deploy --project-ref ${getProjectRef()}`, {
      stdio: 'inherit',
      cwd: ROOT,
      timeout: 120000,
    });
    log('Edge Functions', 'deployed');
    return true;
  } catch (e) {
    log('Edge Functions', 'deployment failed — check Supabase CLI login', false);
    return false;
  }
}

function showPaymentConfig() {
  console.log('\n💳 ===============================================');
  console.log('   LIVE PAYMENT RUN — Configuration Required');
  console.log('   ===============================================');
  console.log();
  console.log('   Set these secrets in Supabase Dashboard →');
  console.log('   Edge Functions → Secrets:');
  console.log();
  console.log('   Required:');
  console.log('     MPESA_CONSUMER_KEY      — Safaricom API consumer key');
  console.log('     MPESA_CONSUMER_SECRET   — Safaricom API consumer secret');
  console.log('     MPESA_PASSKEY           — Safaricom online passkey');
  console.log('     MPESA_SHORTCODE         — Paybill/Till number');
  console.log('     MPESA_ENV               — "production" (not "sandbox")');
  console.log('     MPESA_CALLBACK_SECRET   — URL param secret for /mpesa-callback');
  console.log();
  console.log('   Recommended:');
  console.log('     RESEND_API_KEY          — Email (Resend)');
  console.log('     AFRICASTALKING_API_KEY  — SMS (AfricasTalking)');
  console.log('     META_WHATSAPP_TOKEN     — WhatsApp Business API');
  console.log();
  console.log('   Then configure in Webhost Dashboard → Payment Settings:');
  console.log('     - M-Pesa Paybill/Till number');
  console.log('     - Bank account details');
  console.log('     - Registration fee amount');
  console.log('   ===============================================');
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  console.log('\n🚀 CALQULUS RMS Production Deploy');
  console.log('   =========================');
  if (isDryRun) console.log('   🔸 DRY RUN — no changes will be made\n');

  checkEnvVars();
  checkSupabaseClient();

  if (isDryRun) {
    console.log('\n   Dry run complete. Run without --dry-run to deploy.');
    process.exit(0);
  }

  const checksOk = runChecks();
  const gatesOk = checksOk && runDeploymentGates();
  if (!gatesOk) {
    console.log('\n❌ Pre-deploy checks failed. Fix before deploying.\n');
    process.exit(1);
  }

  runBuild();
  deployEdgeFunctions();
  showPaymentConfig();

  console.log('\n✅ Deploy ready. Push to GitHub main to trigger Vercel:');
  console.log('   git push origin main\n');
}

main().catch(console.error);
