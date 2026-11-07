-- Mirella: Verwaltung je Bereich
-- Jeder Bereich hat eigene Einträge (Fahrzeuge, Verträge, Ärzte, Geräte, Reisen …) mit frei definierbaren Feldern,
-- Dokumenten, Verlauf/Kosten und Erinnerungen. Ersetzt die festen Tabellen contracts, documents, area_facts und morning_items aus 0002.

drop table if exists contracts, documents, area_facts, morning_items;

create table records (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) on delete cascade,
  area text not null,                       -- 'auto', 'geld', 'gesund', 'haus', 'frei'
  kind text not null,                       -- 'Fahrzeug', 'Vertrag', 'Arzt', 'Gerät', 'Reise'
  name text not null,
  fields jsonb not null default '{}',       -- {"Kennzeichen": "LB-FB 123", "Kilometer": "58400", …}
  monthly_cost numeric(10,2),               -- für Summe Abos/Verträge
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

-- Feld-Vorlagen je Art (welche Felder ein neues Fahrzeug/Vertrag … anbietet)
create table record_kinds (
  owner uuid not null references auth.users(id) on delete cascade,
  area text not null,
  kind text not null,
  field_names text[] not null,
  primary key (owner, area, kind)
);

-- Dokumente: an einem Eintrag oder in einem Ablage-Ordner; Datei liegt privat im Supabase Storage (Bucket 'dokumente')
create table files (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) on delete cascade,
  record_id uuid references records(id) on delete cascade,
  folder text,                              -- 'Ausweise', 'Wohnen' … (für die Ablage)
  name text not null,
  storage_path text not null,
  mime text,
  valid_until date,
  remind_days_before int not null default 90,
  created_at timestamptz not null default now()
);

-- Verlauf und Kosten (Inspektion 389 €, Zählerstand, Kilometerstand …)
create table record_log (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) on delete cascade,
  record_id uuid not null references records(id) on delete cascade,
  happened_on date not null default current_date,
  body text not null,
  cost numeric(10,2),
  reading numeric                           -- km-Stand, Zählerstand
);

-- Erinnerungen hängen am Eintrag
alter table items add column record_id uuid references records(id) on delete set null;

do $$
declare t text;
begin
  foreach t in array array['records','record_kinds','files','record_log']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy own_rows on %I for all using (owner = auth.uid()) with check (owner = auth.uid())', t);
  end loop;
end $$;

create index on records (owner, area) where not archived;
create index on files (owner, valid_until);
create index on record_log (record_id, happened_on desc);
