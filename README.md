# Anantya & Bhaskara — Digital Wedding Invitation

Website undangan pernikahan digital premium. Vanilla HTML/CSS/JS,
tanpa framework, dengan backend Supabase untuk RSVP dan Ucapan.

## Struktur Project

```
index.html          → markup utama (envelope + split-screen layout)
style.css            → seluruh styling (design tokens di :root)
script.js            → seluruh logic (animasi, form, slideshow, dll)
assets/
  js/
    supabase.js      → koneksi & fungsi backend Supabase
  image/
    gallery/         → gallery1.webp ... gallery12.webp
    flower/          → elemen dekorasi bunga (opsional)
    icon/            → favicon.png, qris.png
  audio/
    music.mp3         → musik latar
```

## 1. Menyiapkan Foto

Cukup taruh 12 file foto di `assets/image/gallery/` dengan nama:

```
gallery1.webp
gallery2.webp
...
gallery12.webp
```

Tidak perlu mengubah kode apa pun — semua slideshow (hero, panel kiri,
setiap section, gallery Swiper) otomatis membaca nama file tersebut.
Pemetaan section → foto:

| Section     | File          |
|-------------|---------------|
| Hero        | gallery1.webp |
| Bride       | gallery2.webp |
| Groom       | gallery3.webp |
| Love Story  | gallery4.webp |
| Gallery bg  | gallery5.webp |
| Event       | gallery6.webp |
| RSVP        | gallery7.webp |
| Gift        | gallery8.webp |
| Wishes      | gallery9.webp |
| Closing     | gallery10.webp|
| Location bg | gallery11.webp|
| Cadangan    | gallery12.webp (dipakai di gallery slider) |

Selama foto belum diunggah, tampilan akan otomatis menampilkan panel
gradasi lembut sebagai pengganti sementara (bukan error), sehingga
layout tetap terlihat rapi saat development.

Juga siapkan:
- `assets/image/icon/favicon.png`
- `assets/image/icon/qris.png` (kode QRIS hadiah pernikahan)
- `assets/audio/music.mp3` (musik latar, loop-friendly)

## 2. Konfigurasi Supabase

1. Buat project baru di [supabase.com](https://supabase.com).
2. Buka **SQL Editor** dan jalankan skrip berikut:

```sql
-- ================= TABEL RSVP =================
create table public.rsvp (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  kehadiran text not null check (kehadiran in ('Hadir', 'Tidak Hadir', 'Ragu-ragu')),
  jumlah_tamu integer default 1,
  pesan text,
  created_at timestamptz default now()
);

alter table public.rsvp enable row level security;

-- Izinkan siapa saja menambah RSVP
create policy "Public can insert rsvp"
  on public.rsvp for insert
  with check (true);

-- Izinkan siapa saja membaca RSVP (opsional, untuk statistik publik)
create policy "Public can read rsvp"
  on public.rsvp for select
  using (true);

-- ================= TABEL UCAPAN =================
create table public.ucapan (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  pesan text not null,
  created_at timestamptz default now()
);

alter table public.ucapan enable row level security;

create policy "Public can insert ucapan"
  on public.ucapan for insert
  with check (true);

create policy "Public can read ucapan"
  on public.ucapan for select
  using (true);

-- ================= REALTIME =================
alter publication supabase_realtime add table public.ucapan;
alter publication supabase_realtime add table public.rsvp;
```

3. Buka **Project Settings → API**, salin `Project URL` dan `anon public key`.
4. Buka `assets/js/supabase.js` dan isi:

```js
const SUPABASE_CONFIG = {
  url: 'https://xxxxxxxx.supabase.co',
  anonKey: 'ey...'
};
```

> Catatan keamanan: anon key aman untuk dipakai di sisi client
> selama Row Level Security (RLS) aktif seperti skrip di atas —
> policy hanya mengizinkan insert & select, tidak update/delete
> dari publik.

## 3. Menjalankan Secara Lokal

Karena project ini murni static file, cukup jalankan local server,
contoh dengan Python:

```bash
python3 -m http.server 8000
```

lalu buka `http://localhost:8000`.

## 4. Personalisasi Nama Tamu

Tambahkan parameter `?to=Nama+Tamu` pada URL undangan, contoh:

```
https://domainanda.com/?to=Budi+Santoso
```

Nama akan otomatis tampil di halaman amplop pembuka.

## 5. Deploy

Bisa langsung di-deploy ke Netlify, Vercel, GitHub Pages, atau
hosting static lainnya — tidak memerlukan proses build.
