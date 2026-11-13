import { createClient } from '@supabase/supabase-js';
// This publishable key is public by design. Access is enforced by RLS.
const URL = 'https://axwszwjfbinregsydtqg.supabase.co';
const KEY = 'sb_publishable_TfXwQEgOvHOAO9T-d3zLgQ_EoQf3KKg';
let client;
export const activeAccount = () => {
  const id = localStorage.getItem('intake-active-account');
  return /^[0-9a-f-]{36}$/i.test(id || '') ? id : '';
};
export function getCloud() {
  client ??= createClient(URL,KEY,{auth:{storageKey:'intake-cloud-auth',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  return client;
}
