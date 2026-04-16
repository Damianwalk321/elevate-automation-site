import { createClient } from '@supabase/supabase-js';

export function getServerClient(req){
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      global: {
        headers: {
          Authorization: req.headers.authorization || ''
        }
      }
    }
  );

  return supabase;
}

export async function getUser(req){
  const supabase = getServerClient(req);
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}