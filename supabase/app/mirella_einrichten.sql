-- Mirella: Speicher für die App (einmal im Supabase SQL Editor ausführen)
-- Jede Person sieht nur ihre eigenen Daten (Row Level Security).

create table if not exists public.mirella_state (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  version    bigint not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.mirella_state enable row level security;
drop policy if exists "eigene Daten" on public.mirella_state;
create policy "eigene Daten" on public.mirella_state
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Wöchentliche Sicherungen (Mirella legt sie selbst an, die letzten 8 bleiben)
create table if not exists public.mirella_backup (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  data       jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.mirella_backup enable row level security;
drop policy if exists "eigene Sicherungen" on public.mirella_backup;
create policy "eigene Sicherungen" on public.mirella_backup
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Geräte für Push-Nachrichten
create table if not exists public.mirella_device (
  token      text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  platform   text not null default 'ios',
  created_at timestamptz not null default now()
);
alter table public.mirella_device enable row level security;
drop policy if exists "eigene Geräte" on public.mirella_device;
create policy "eigene Geräte" on public.mirella_device
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Fotos und PDFs: privater Speicher, Ordner = eigene Nutzer-ID
insert into storage.buckets (id, name, public) values ('mirella', 'mirella', false)
  on conflict (id) do nothing;
drop policy if exists "eigene Dateien" on storage.objects;
create policy "eigene Dateien" on storage.objects for all
  using (bucket_id = 'mirella' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'mirella' and (storage.foldername(name))[1] = auth.uid()::text);
