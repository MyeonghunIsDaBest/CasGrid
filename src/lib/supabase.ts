import { createClient } from '@supabase/supabase-js';

const url  = import.meta.env.VITE_SUPABASE_URL  as string | undefined;
const key  = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !key) {
  // This surfaces clearly during development instead of a cryptic network error
  console.error(
    '[CasGrid] Missing Supabase env vars.\n' +
    'Copy .env.example → .env.local and fill in your project credentials.\n' +
    'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must both be set.'
  );
}

export const supabase = createClient(
  url  ?? 'https://placeholder.supabase.co',
  key  ?? 'placeholder-anon-key',
  {
    realtime: {
      params: { eventsPerSecond: 10 },
    },
  }
);
