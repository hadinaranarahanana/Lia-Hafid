/* ============================================================
   SUPABASE.JS — Integrasi backend Supabase untuk undangan
   Menyediakan window.WeddingSupabase yang dipakai oleh script.js:
     - submitRSVP({ nama, kehadiran, jumlah_tamu, pesan })
     - submitUcapan({ nama, pesan })
     - getUcapanList(page, pageSize, sort)
     - subscribeUcapanRealtime(callback)

   CARA SETUP:
   1. Buat project di https://supabase.com (gratis)
   2. Buka Project Settings -> API, salin "Project URL" dan "anon public key"
   3. Ganti nilai SUPABASE_URL dan SUPABASE_ANON_KEY di bawah ini
   4. Jalankan SQL schema (lihat file supabase-schema.sql) di Supabase SQL Editor
   5. Aktifkan Realtime untuk tabel "ucapan" (Database -> Replication)
============================================================ */

(function () {
  'use strict';

  // ============ GANTI DENGAN KREDENSIAL PROJECT SUPABASE KAMU ============
  const SUPABASE_URL = 'https://mwjcoavkwjpoldkrfons.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_9i9MaG2rhHTIAHKvlCHzww_E9JDu1AI';
  // =========================================================================

  if (typeof window.supabase === 'undefined') {
    console.error('[WeddingSupabase] Supabase SDK belum termuat. Pastikan script @supabase/supabase-js dimuat sebelum supabase.js');
    return;
  }

  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  /**
   * Kirim konfirmasi kehadiran (RSVP) ke tabel "rsvp".
   */
  async function submitRSVP({ nama, kehadiran, jumlah_tamu, pesan }) {
    try {
      const { data, error } = await client
        .from('rsvp')
        .insert([{ nama, kehadiran, jumlah_tamu, pesan }])
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('[WeddingSupabase] submitRSVP error:', error);

      const message = String(error?.message || '').toLowerCase();
      const details = String(error?.details || '').toLowerCase();
      const fallback = message.includes('rsvp') || details.includes('rsvp') || message.includes('table "rsvp"') || details.includes('relation "rsvp"');
      const fallbackMessage = pesan
        ? `${pesan} — ${kehadiran}, ${jumlah_tamu} tamu`
        : `${kehadiran} • ${jumlah_tamu} tamu`;

      if (fallback) {
        return submitUcapan({ nama, pesan: fallbackMessage });
      }

      return { data: null, error };
    }
  }

  /**
   * Kirim ucapan & doa ke tabel "ucapan".
   */
  async function submitUcapan({ nama, pesan }) {
    try {
      const { data, error } = await client
        .from('ucapan')
        .insert([{ nama, pesan }])
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('[WeddingSupabase] submitUcapan error:', error);
      return { data: null, error };
    }
  }

  /**
   * Ambil daftar ucapan dengan pagination + sorting.
   * page dimulai dari 0. sort: 'newest' | 'oldest'.
   * Mengembalikan { data, error, count } — count = total baris (untuk load more).
   */
  async function getUcapanList(page = 0, pageSize = 8, sort = 'newest') {
    try {
      const from = page * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await client
        .from('ucapan')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: sort === 'oldest' })
        .range(from, to);

      if (error) throw error;
      return { data, error: null, count };
    } catch (error) {
      console.error('[WeddingSupabase] getUcapanList error:', error);
      return { data: null, error, count: 0 };
    }
  }

  /**
   * Subscribe ke insert baru pada tabel "ucapan" secara realtime.
   * callback dipanggil dengan row baru setiap ada ucapan masuk.
   */
  function subscribeUcapanRealtime(callback) {
    try {
      client
        .channel('ucapan-realtime-channel')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'ucapan' },
          (payload) => {
            if (payload && payload.new) callback(payload.new);
          }
        )
        .subscribe();
    } catch (error) {
      console.error('[WeddingSupabase] subscribeUcapanRealtime error:', error);
    }
  }

  window.WeddingSupabase = {
    submitRSVP,
    submitUcapan,
    getUcapanList,
    subscribeUcapanRealtime
  };
})();
