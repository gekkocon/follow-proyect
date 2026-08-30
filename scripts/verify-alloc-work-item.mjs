import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const EMAIL = process.env.TEST_EMAIL;
const PASSWORD = process.env.TEST_PASSWORD;
const PROJECT_ID = Number(process.env.TEST_PROJECT_ID);
const TYPE = process.env.TEST_TYPE || 'bug';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !EMAIL || !PASSWORD || !PROJECT_ID) {
  console.error('Faltan variables: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, TEST_EMAIL, TEST_PASSWORD, TEST_PROJECT_ID');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
  email: EMAIL,
  password: PASSWORD,
});

if (authError || !authData.session) {
  console.error('Login falló:', authError?.message);
  process.exit(1);
}

console.log(`Sesión iniciada como ${EMAIL}`);

const { data: code, error: rpcError } = await supabase.rpc('alloc_work_item_code', {
  p_project_id: PROJECT_ID,
  p_type: TYPE,
});

if (rpcError) {
  console.log('RPC devolvió ERROR:');
  console.log(`  code: ${rpcError.code}`);
  console.log(`  message: ${rpcError.message}`);
} else {
  console.log('RPC devolvió código:', code);
}

await supabase.auth.signOut();
