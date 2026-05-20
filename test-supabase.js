import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pwgqwcvultxihntvaewo.supabase.co';
const supabaseAnonKey = 'sb_publishable_h-C9-i8mXGdqwhuKk1ml1g_GQpI39ur';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const email = `agent.test.${Date.now()}@gmail.com`;
  const password = 'agentPassword123!';

  console.log("Attempting to sign up test user:", email);
  let session;
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password
  });

  if (signUpError) {
    console.warn("Sign up failed:", signUpError.message);
    console.log("Trying to sign in with admin@example.com...");
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: 'admin@example.com',
      password: 'YOUR_SECURE_PASSWORD'
    });
    if (signInError) {
      console.error("Sign in failed:", signInError.message);
      return;
    }
    session = signInData.session;
  } else {
    session = signUpData.session;
  }

  if (!session) {
    console.error("No session obtained.");
    return;
  }

  console.log("Successfully authenticated!");
  const token = session.access_token;
  const headers = {
    'apikey': supabaseAnonKey,
    'Authorization': `Bearer ${token}`
  };

  const tables = ['team_settings', 'roster', 'events', 'active_session', 'archived_event_sets'];
  for (const table of tables) {
    try {
      const r = await fetch(`${supabaseUrl}/rest/v1/${table}?select=*`, { headers });
      const data = await r.json();
      console.log(`=== TABLE: ${table} ===`);
      console.log(JSON.stringify(data, null, 2));
    } catch(err) {
      console.error(`Error fetching ${table}:`, err);
    }
  }
}

run();
