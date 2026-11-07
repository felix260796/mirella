-- Mirella: Ausgaben aus Fotos (Kassenbon, Rechnung) und Einkaufszettel per Foto
-- Ablauf: Foto -> Supabase Storage -> Edge Function schickt Bild an Claude (Bilderkennung)
--         -> Laden, Datum, Betrag, Positionen, Kategorie-Vorschlag -> Felix bestätigt mit einem Tipp.

create table expenses (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) on delete cascade,
  spent_on date not null,
  merchant text,
  amount numeric(10,2) not null,
  category text not null default 'Sonstiges',   -- Lebensmittel, Auto, Haushalt, Drogerie, Essen gehen …
  record_id uuid references records(id) on delete set null,  -- z. B. Tankbeleg -> VW Golf
  file_id uuid references files(id) on delete set null,      -- Foto des Belegs
  line_items jsonb,                             -- [{"name":"Kaffee Bohnen 1kg","price":13.99}]
  confirmed boolean not null default false,     -- erst nach Felix' Bestätigung in der Statistik
  created_at timestamptz not null default now()
);

alter table expenses enable row level security;
create policy own_rows on expenses for all using (owner = auth.uid()) with check (owner = auth.uid());
create index on expenses (owner, spent_on desc);

-- Einkaufsliste: Herkunft merken (Sprache, Tippen, Foto)
alter table shopping_items add column source text not null default 'typed';  -- 'typed' | 'voice' | 'photo'
