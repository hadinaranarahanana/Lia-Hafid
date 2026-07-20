/* ============================================================
   SUPABASE.JS
   Backend layer: client init, RSVP CRUD, Ucapan (wishes) CRUD,
   realtime subscriptions, and error handling.

   SETUP:
   1. Create a Supabase project at https://supabase.com
   2. Replace SUPABASE_URL and SUPABASE_ANON_KEY below with your
      project's values (Project Settings > API).
   3. Run the SQL in README.md to create the `rsvp` and `ucapan`
      tables with Row Level Security policies.

   NOTE: The anon/public key is safe to expose in client-side code
   as long as Row Level Security (RLS) policies are configured
   correctly on your Supabase tables (see README.md).
============================================================ */

// ---------- ENVIRONMENT CONFIG ----------
// In production, consider injecting these via a build step or a
// small server-rendered config endpoint instead of hardcoding.
const SUPABASE_CONFIG = {
  url: 'https://YOUR-PROJECT-REF.supabase.co',
  anonKey: 'YOUR-SUPABASE-ANON-PUBLIC-KEY'
};

let supabaseClient = null;

/**
 * Initializes the Supabase client. Safe to call multiple times.
 */
function initSupabase() {
  if (supabaseClient) return supabaseClient;

  if (typeof window.supabase === 'undefined') {
    console.error('[Supabase] SDK belum dimuat. Pastikan script @supabase/supabase-js sudah di-load.');
    return null;
  }

  if (SUPABASE_CONFIG.url.includes('YOUR-PROJECT-REF')) {
    console.warn('[Supabase] Konfigurasi belum diisi. Silakan update SUPABASE_CONFIG di assets/js/supabase.js');
  }

  supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
  return supabaseClient;
}

/* ============================================================
   RSVP FUNCTIONS
============================================================ */

/**
 * Insert a new RSVP record.
 * @param {{nama: string, kehadiran: string, jumlah_tamu: number, pesan: string}} data
 * @returns {Promise<{data: object|null, error: object|null}>}
 */
async function submitRSVP(data) {
  const client = initSupabase();
  if (!client) return { data: null, error: { message: 'Supabase belum terkonfigurasi.' } };

  try {
    const { data: inserted, error } = await client
      .from('rsvp')
      .insert([{
        nama: data.nama,
        kehadiran: data.kehadiran,
        jumlah_tamu: data.jumlah_tamu || 1,
        pesan: data.pesan || null
      }])
      .select()
      .single();

    if (error) throw error;
    return { data: inserted, error: null };
  } catch (err) {
    console.error('[Supabase] submitRSVP error:', err);
    return { data: null, error: err };
  }
}

/**
 * Update an existing RSVP record by id.
 * @param {string|number} id
 * @param {object} updates
 */
async function updateRSVP(id, updates) {
  const client = initSupabase();
  if (!client) return { data: null, error: { message: 'Supabase belum terkonfigurasi.' } };

  try {
    const { data, error } = await client
      .from('rsvp')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return { data, error: null };
  } catch (err) {
    console.error('[Supabase] updateRSVP error:', err);
    return { data: null, error: err };
  }
}

/**
 * Fetch RSVP list, most recent first.
 */
async function getRSVPList(limit = 50) {
  const client = initSupabase();
  if (!client) return { data: [], error: { message: 'Supabase belum terkonfigurasi.' } };

  try {
    const { data, error } = await client
      .from('rsvp')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return { data, error: null };
  } catch (err) {
    console.error('[Supabase] getRSVPList error:', err);
    return { data: [], error: err };
  }
}

/* ============================================================
   UCAPAN (WISHES) FUNCTIONS
============================================================ */

/**
 * Insert a new wish/ucapan.
 * @param {{nama: string, pesan: string}} data
 */
async function submitUcapan(data) {
  const client = initSupabase();
  if (!client) return { data: null, error: { message: 'Supabase belum terkonfigurasi.' } };

  try {
    const { data: inserted, error } = await client
      .from('ucapan')
      .insert([{ nama: data.nama, pesan: data.pesan }])
      .select()
      .single();
    if (error) throw error;
    return { data: inserted, error: null };
  } catch (err) {
    console.error('[Supabase] submitUcapan error:', err);
    return { data: null, error: err };
  }
}

/**
 * Fetch paginated ucapan list.
 * @param {number} page zero-indexed page number
 * @param {number} pageSize
 * @param {'newest'|'oldest'} sort
 */
async function getUcapanList(page = 0, pageSize = 10, sort = 'newest') {
  const client = initSupabase();
  if (!client) return { data: [], error: { message: 'Supabase belum terkonfigurasi.' }, count: 0 };

  const from = page * pageSize;
  const to = from + pageSize - 1;

  try {
    const { data, error, count } = await client
      .from('ucapan')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: sort === 'oldest' })
      .range(from, to);
    if (error) throw error;
    return { data, error: null, count };
  } catch (err) {
    console.error('[Supabase] getUcapanList error:', err);
    return { data: [], error: err, count: 0 };
  }
}

/**
 * Subscribe to realtime inserts on the `ucapan` table.
 * @param {(row: object) => void} onInsert
 * @returns {() => void} unsubscribe function
 */
function subscribeUcapanRealtime(onInsert) {
  const client = initSupabase();
  if (!client) return () => {};

  const channel = client
    .channel('ucapan-realtime')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ucapan' }, (payload) => {
      onInsert(payload.new);
    })
    .subscribe();

  return () => client.removeChannel(channel);
}

/**
 * Subscribe to realtime inserts/updates on the `rsvp` table.
 * @param {(row: object, eventType: string) => void} onChange
 * @returns {() => void} unsubscribe function
 */
function subscribeRSVPRealtime(onChange) {
  const client = initSupabase();
  if (!client) return () => {};

  const channel = client
    .channel('rsvp-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rsvp' }, (payload) => {
      onChange(payload.new, payload.eventType);
    })
    .subscribe();

  return () => client.removeChannel(channel);
}

// Expose functions globally for script.js to consume
window.WeddingSupabase = {
  initSupabase,
  submitRSVP,
  updateRSVP,
  getRSVPList,
  submitUcapan,
  getUcapanList,
  subscribeUcapanRealtime,
  subscribeRSVPRealtime
};
