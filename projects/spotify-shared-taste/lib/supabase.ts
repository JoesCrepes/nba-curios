import { createClient } from '@supabase/supabase-js';

// Server-only client — uses service role key, bypasses RLS
// Never import this in client components
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
