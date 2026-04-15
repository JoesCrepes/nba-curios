'use client';

import { createClient } from '@supabase/supabase-js';

// Browser-only client — uses anon key, respects RLS
// Only use in 'use client' components
export function createSupabaseBrowserClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
