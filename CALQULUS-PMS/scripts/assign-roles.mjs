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
  console.error('Get it from: Supabase Dashboard → Project Settings → API → service_role (secret)');
  process.exit(1);
}

// User email to role mapping
const ROLE_ASSIGNMENTS = [
  { email: 'mugo.james27@gmail.com', role: 'webhost', name: 'James Mugo' },
  { email: 'demo.manager@calqulusrms.com', role: 'manager', name: 'Demo Manager' },
  { email: 'demo.landlord@calqulusrms.com', role: 'landlord', name: 'Demo Landlord' },
  { email: 'demo.agent@calqulusrms.com', role: 'submanager', name: 'Demo Agent' },
  { email: 'demo.tenant1@calqulusrms.com', role: 'tenant', name: 'Demo Tenant 1' },
];

async function assignRoles() {
  console.log('🔐 Assigning Roles to Users\n');
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
      userMap.set(user.email, user);
    });

    let successCount = 0;
    let failureCount = 0;

    for (const assignment of ROLE_ASSIGNMENTS) {
      console.log(`🔧 Processing: ${assignment.email} → ${assignment.role}`);

      const user = userMap.get(assignment.email);

      if (!user) {
        console.log(`   ❌ User not found in auth.users`);
        failureCount++;
        console.log('');
        continue;
      }

      console.log(`   ✓ User found: ${user.id}`);

      // Create or update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          full_name: assignment.name,
          email: assignment.email,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });

      if (profileError) {
        console.log(`   ❌ Profile error: ${profileError.message}`);
        failureCount++;
        console.log('');
        continue;
      }

      console.log(`   ✓ Profile created/updated`);

      // Assign role in user_roles table
      const { error: roleError } = await supabase
        .from('user_roles')
        .upsert({
          user_id: user.id,
          role: assignment.role,
          approval_status: 'approved',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (roleError) {
        console.log(`   ❌ Role assignment error: ${roleError.message}`);
        failureCount++;
        console.log('');
        continue;
      }

      console.log(`   ✅ Role assigned successfully`);
      successCount++;
      console.log('');
    }

    // Special handling for webhost - create platform admin entry if needed
    const webhostUser = userMap.get('mugo.james27@gmail.com');
    if (webhostUser) {
      console.log(`🔧 Setting up platform admin for webhost...`);

      // Check if platform_admins table exists and create entry
      const { error: adminError } = await supabase
        .from('platform_admins')
        .upsert({
          user_id: webhostUser.id,
          admin_level: 'owner',
          is_immutable: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (adminError) {
        console.log(`   ⚠️  Platform admin error (table may not exist): ${adminError.message}`);
      } else {
        console.log(`   ✅ Platform admin entry created`);
      }
      console.log('');
    }

    // Create manager profile for demo manager
    const managerUser = userMap.get('demo.manager@calqulusrms.com');
    if (managerUser) {
      console.log(`🔧 Setting up manager profile for demo manager...`);

      const { error: managerProfileError } = await supabase
        .from('manager_profiles')
        .upsert({
          manager_user_id: managerUser.id,
          status: 'approved',
          subscription_tier: 'pro',
          property_count: 0,
          unit_count: 0,
          tenant_count: 0,
          platform_rate: 600,
          billing_day: 1,
          billing_method: 'subscription',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, { onConflict: 'manager_user_id' });

      if (managerProfileError) {
        console.log(`   ⚠️  Manager profile error: ${managerProfileError.message}`);
      } else {
        console.log(`   ✅ Manager profile created`);
      }
      console.log('');
    }

    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`📊 Results: ${successCount} successful, ${failureCount} failed`);
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('\n✅ Role assignment complete!');
    console.log('\n📝 Next steps:');
    console.log('1. Test logins with the assigned credentials');
    console.log('2. For demo manager: Create properties, units, and tenants');
    console.log('3. For demo tenant: Link to a unit after properties are created');
    console.log('4. For demo landlord: Link to properties via landlord invitations');

  } catch (error) {
    console.error('❌ Error during role assignment:', error);
  }
}

assignRoles();
