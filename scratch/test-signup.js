import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pwgqwcvultxihntvaewo.supabase.co';
const supabaseAnonKey = 'sb_publishable_h-C9-i8mXGdqwhuKk1ml1g_GQpI39ur';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const randomSuffix = Math.floor(Math.random() * 1000000);
  const email = `test-coach-${randomSuffix}@example.com`;
  const password = `TestPassword123!`;

  console.log(`Attempting to sign up test account: ${email}`);
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    console.error('Signup error:', error);
    process.exit(1);
  }

  console.log('Signup success!');
  console.log('User ID (UUID):', data.user?.id);
  console.log('User Email:', data.user?.email);
  console.log('User Confirmed At:', data.user?.email_confirmed_at); // Should be null
}

run().catch(console.error);
