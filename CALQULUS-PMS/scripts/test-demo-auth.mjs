import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_ANON_KEY (or VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY).');
  process.exit(1);
}

// Demo accounts to test. Credentials must be supplied through environment
// variables; never commit live/demo passwords to the repository.
const DEMO_ACCOUNTS = [
  ['manager', 'Manager'],
  ['tenant1', 'Tenant 1'],
  ['tenant2', 'Tenant 2'],
  ['tenant3', 'Tenant 3 (Orphan)'],
  ['landlord', 'Landlord'],
  ['agent', 'Agent/Submanager'],
  ['provider', 'Service Provider'],
].map(([key, name]) => ({
  email: process.env[`DEMO_${key.toUpperCase()}_EMAIL`],
  password: process.env[`DEMO_${key.toUpperCase()}_PASSWORD`],
  name,
})).filter((account) => account.email && account.password);

if (DEMO_ACCOUNTS.length === 0) {
  console.error('No demo credentials configured. Set DEMO_<ROLE>_EMAIL and DEMO_<ROLE>_PASSWORD environment variables.');
  process.exit(1);
}

async function testDemoAuth() {
  console.log('🔍 Testing Demo Account Authentication\n');
  console.log(`Supabase URL: ${SUPABASE_URL}`);
  console.log(`Using Anon Key: ${SUPABASE_ANON_KEY.substring(0, 20)}...\n`);

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  let successCount = 0;
  let failureCount = 0;

  for (const account of DEMO_ACCOUNTS) {
    console.log(`🔐 Testing ${account.name}: ${account.email}`);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: account.email,
        password: account.password,
      });

      if (error) {
        console.log(`   ❌ FAILED: ${error.message}`);
        failureCount++;
      } else if (data.user) {
        console.log(`   ✅ SUCCESS: User authenticated`);
        console.log(`   User ID: ${data.user.id}`);
        console.log(`   Email confirmed: ${data.user.email_confirmed_at ? 'Yes' : 'No'}`);
        successCount++;

        // Sign out after successful test
        await supabase.auth.signOut();
      } else {
        console.log(`   ❌ FAILED: No user data returned`);
        failureCount++;
      }
    } catch (err) {
      console.log(`   ❌ ERROR: ${err.message}`);
      failureCount++;
    }

    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`📊 Results: ${successCount} successful, ${failureCount} failed`);
  console.log('═══════════════════════════════════════════════════════════════');

  if (failureCount > 0) {
    console.log('\n⚠️  Demo accounts may not exist in the database.');
    console.log('💡 To seed demo accounts, run the seed-demo-data edge function:');
    console.log(`   curl -X POST ${SUPABASE_URL}/functions/v1/seed-demo-data \\`);
    console.log('     -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \\');
    console.log('     -H "Content-Type: application/json" \\');
    console.log('     -d \'{"action": "seed"}\'');
    console.log('\n   Or use the SQL script: supabase/demo/seed_demo_data.sql');
  }
}

testDemoAuth().catch(console.error);
