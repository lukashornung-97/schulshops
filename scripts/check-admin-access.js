/**
 * Script to check and fix admin access
 * Run this with: node scripts/check-admin-access.js <your-email>
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

// Use service role to bypass RLS
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function checkAdminAccess(email) {
  console.log(`\nChecking admin access for: ${email}\n`)

  // Check admin_users table
  const { data: adminUsers, error: adminError } = await supabase
    .from('admin_users')
    .select('*')
    .ilike('email', email.toLowerCase())

  if (adminError) {
    console.error('Error querying admin_users:', adminError)
    return
  }

  if (!adminUsers || adminUsers.length === 0) {
    console.log('❌ No admin_users record found for this email')
    console.log('\nTo add yourself as admin, run this SQL in Supabase:')
    console.log(`INSERT INTO admin_users (email) VALUES ('${email.toLowerCase()}');`)
    return
  }

  console.log('✅ Found admin_users record(s):')
  adminUsers.forEach((admin, index) => {
    console.log(`\n  Record ${index + 1}:`)
    console.log(`    ID: ${admin.id}`)
    console.log(`    Email: ${admin.email}`)
    console.log(`    User ID: ${admin.user_id || 'NULL (not linked yet)'}`)
    console.log(`    Created: ${admin.created_at}`)
  })

  // Check auth.users
  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()
  
  if (authError) {
    console.error('Error querying auth.users:', authError)
    return
  }

  const matchingAuthUser = authUsers.users.find(u => 
    u.email?.toLowerCase() === email.toLowerCase()
  )

  if (matchingAuthUser) {
    console.log(`\n✅ Found auth.users record:`)
    console.log(`    User ID: ${matchingAuthUser.id}`)
    console.log(`    Email: ${matchingAuthUser.email}`)
    console.log(`    Created: ${matchingAuthUser.created_at}`)

    // Check if user_id needs to be linked
    const adminRecord = adminUsers.find(a => !a.user_id)
    if (adminRecord && matchingAuthUser) {
      console.log(`\n⚠️  Admin record has no user_id. Linking now...`)
      
      const { error: updateError } = await supabase
        .from('admin_users')
        .update({ user_id: matchingAuthUser.id })
        .eq('id', adminRecord.id)

      if (updateError) {
        console.error('❌ Error linking user_id:', updateError)
      } else {
        console.log('✅ Successfully linked user_id!')
      }
    }
  } else {
    console.log(`\n⚠️  No auth.users record found for this email`)
    console.log('   You need to sign up/login first to create an auth.users record')
  }

  // Verify RLS access
  console.log('\n📋 RLS Policy Check:')
  console.log('   The RLS policy allows reading if:')
  console.log('   1. user_id matches auth.uid() (after linking)')
  console.log('   2. OR email matches auth.users.email')
  console.log('\n   Make sure the email in admin_users matches your auth.users email exactly (case-insensitive)')
}

const email = process.argv[2]

if (!email) {
  console.error('Usage: node scripts/check-admin-access.js <your-email>')
  process.exit(1)
}

checkAdminAccess(email)
  .then(() => {
    console.log('\n✅ Check complete!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })




