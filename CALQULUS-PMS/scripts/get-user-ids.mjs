import { createClient } from '@supabase/supabase-js';

// Get Supabase URL and service role key from environment
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
if (!SUPABASE_URL) {
  console.error('Set SUPABASE_URL or VITE_SUPABASE_URL.');
  process.exit(1);
}
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  console.error('Set it with: export SUPABASE_SERVICE_ROLE_KEY=your-service-role-key');
  process.exit(1);
}

const EMAILS = [
  'mugo.james27@gmail.com',
  'demo.manager@calqulusrms.com',
  'demo.landlord@calqulusrms.com',
  'demo.agent@calqulusrms.com',
  'demo.tenant1@calqulusrms.com',
];

async function getUserIds() {
  console.log('🔍 Getting User IDs from Database\n');
  console.log(`Supabase URL: ${SUPABASE_URL}\n`);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    // Get all users from auth
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();

    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
      return;
    }

    console.log(`📊 Found ${users.length} users in auth.users\n`);

    // Create email to user ID map
    const userMap = new Map();
    users.forEach(user => {
      userMap.set(user.email, user.id);
    });

    // Generate SQL for role assignments
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📋 COPY AND RUN THIS SQL IN SUPABASE SQL EDITOR:');
    console.log('═══════════════════════════════════════════════════════════════\n');

    let sql = '-- Insert user roles\n';
    sql += 'INSERT INTO public.user_roles (user_id, role, approval_status, created_at, updated_at) VALUES\n';

    const values = [];

    for (const email of EMAILS) {
      const userId = userMap.get(email);
      if (userId) {
        let role = '';
        if (email === 'mugo.james27@gmail.com') role = 'webhost';
        else if (email === 'demo.manager@calqulusrms.com') role = 'manager';
        else if (email === 'demo.landlord@calqulusrms.com') role = 'landlord';
        else if (email === 'demo.agent@calqulusrms.com') role = 'submanager';
        else if (email === 'demo.tenant1@calqulusrms.com') role = 'tenant';

        values.push(`  ('${userId}', '${role}', 'approved', NOW(), NOW()) -- ${email}`);
        console.log(`✓ Found: ${email} → ${userId}`);
      } else {
        console.log(`❌ Not found: ${email}`);
      }
    }

    sql += values.join(',\n');
    sql += '\nON CONFLICT (user_id) DO UPDATE SET \n';
    sql += '  role = EXCLUDED.role,\n';
    sql += '  approval_status = EXCLUDED.approval_status,\n';
    sql += '  updated_at = NOW();\n';

    console.log('\n' + sql);

    // Also generate profile creation SQL
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('📋 COPY AND RUN THIS SQL FOR PROFILES:');
    console.log('═══════════════════════════════════════════════════════════════\n');

    let profileSql = '-- Insert/update profiles\n';
    profileSql += 'INSERT INTO public.profiles (id, full_name, email, created_at, updated_at) VALUES\n';

    const profileValues = [];
    const names = {
      'mugo.james27@gmail.com': 'James Mugo',
      'demo.manager@calqulusrms.com': 'Demo Manager',
      'demo.landlord@calqulusrms.com': 'Demo Landlord',
      'demo.agent@calqulusrms.com': 'Demo Agent',
      'demo.tenant1@calqulusrms.com': 'Demo Tenant 1',
    };

    for (const email of EMAILS) {
      const userId = userMap.get(email);
      if (userId && names[email]) {
        profileValues.push(`  ('${userId}', '${names[email]}', '${email}', NOW(), NOW())`);
      }
    }

    profileSql += profileValues.join(',\n');
    profileSql += '\nON CONFLICT (id) DO UPDATE SET \n';
    profileSql += '  full_name = EXCLUDED.full_name,\n';
    profileSql += '  email = EXCLUDED.email,\n';
    profileSql += '  updated_at = NOW();\n';

    console.log(profileSql);

    // Generate manager profile SQL
    const managerUserId = userMap.get('demo.manager@calqulusrms.com');
    if (managerUserId) {
      console.log('\n═══════════════════════════════════════════════════════════════');
      console.log('📋 COPY AND RUN THIS SQL FOR MANAGER PROFILE:');
      console.log('═══════════════════════════════════════════════════════════════\n');

      console.log(`-- Insert manager profile for demo manager\n`);
      console.log(`INSERT INTO public.manager_profiles (manager_user_id, status, subscription_tier, property_count, unit_count, tenant_count, platform_rate, billing_day, billing_method, created_at, updated_at)\n`);
      console.log(`VALUES ('${managerUserId}', 'approved', 'pro', 0, 0, 0, 600, 1, 'subscription', NOW(), NOW())\n`);
      console.log(`ON CONFLICT (manager_user_id) DO UPDATE SET \n`);
      console.log(`  status = 'approved',\n`);
      console.log(`  subscription_tier = 'pro',\n`);
      console.log(`  updated_at = NOW();\n`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

getUserIds();
