-- Mirella: Lebensbereiche (Auto, Finanzen & Verträge, Gesundheit, Zuhause & Smart Home, Dokumente, Freizeit & Reisen)
-- items.area verweist ab jetzt auf einen Bereich; Bereiche sind frei erweiterbar.

create table areas (
  id text not null,                         -- 'auto', 'geld', 'gesund', 'haus', 'doku', 'frei'
  owner uuid not null references auth.users(id) on delete cascade,
  name text not null,
  sort int not null default 0,
  primary key (owner, id)
);

-- „Das weiß ich“: Fakten je Bereich (Kennzeichen, Kilometer, Hausarzt …)
create table area_facts (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) on delete cascade,
  area text not null,
  label text not null,
  value text not null,
  updated_at timestamptz not null default now()
);

-- Verträge und Abos mit Kündigungsfristen
create table contracts (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) on delete cascade,
  area text not null default 'geld',
  name text not null,                       -- Handy, Strom, Kfz-Versicherung …
  monthly_cost numeric(10,2),
  ends_on date,
  notice_days int,                          -- Kündigungsfrist in Tagen
  auto_renew_months int,                    -- Verlängerung, wenn nicht gekündigt
  remind_days_before int not null default 30,
  note text
);

-- Dokumente mit Ablaufdatum (Ausweis, Pass, Garantie …)
create table documents (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) on delete cascade,
  area text not null default 'doku',
  name text not null,
  valid_until date,
  remind_days_before int not null default 90,
  note text
);

-- Morgen-Check: feste Mitnehm-Punkte; Wetterpunkte erzeugt Mirella selbst
create table morning_items (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) on delete cascade,
  title text not null,                      -- 'Essen für mittags dabei?'
  weekdays int[] not null default '{1,2,3,4,5}',
  active boolean not null default true
);

alter table settings
  add column morning_mode text not null default 'leave_home',  -- 'leave_home' | 'time' | 'off'
  add column morning_read_aloud boolean not null default false,
  add column carplay_min_drive_min int not null default 15;

do $$
declare t text;
begin
  foreach t in array array['areas','area_facts','contracts','documents','morning_items']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy own_rows on %I for all using (owner = auth.uid()) with check (owner = auth.uid())', t);
  end loop;
end $$;

create index on contracts (owner, ends_on);
create index on documents (owner, valid_until);
