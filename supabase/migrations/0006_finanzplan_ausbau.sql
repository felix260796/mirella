-- Mirella: Finanzplan-Ausbau (Monate, Trends, Prognose, Sparziele, Jahreskosten)
-- Trends und Prognose werden aus expenses + monthly_spending berechnet, keine eigene Tabelle nötig.

-- Sparziele
create table savings_goals (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) on delete cascade,
  name text not null,                      -- 'Skiurlaub Februar', 'Notgroschen'
  target numeric(10,2) not null,
  saved numeric(10,2) not null default 0,
  due_on date,
  archived boolean not null default false
);

-- Jahreskosten: Verträge mit jährlicher Zahlung werden auf Monate umgerechnet (Rücklage)
alter table records
  add column payment_interval_months int,   -- 1 = monatlich, 12 = jährlich
  add column payment_amount numeric(10,2),
  add column payment_month int;             -- Monat der Fälligkeit bei jährlich (1-12)

-- Einkommen kann sich ändern: je Monat speichern
create table monthly_income (
  owner uuid not null references auth.users(id) on delete cascade,
  month date not null,                      -- erster Tag des Monats
  amount numeric(10,2) not null,
  primary key (owner, month)
);

do $$
declare t text;
begin
  foreach t in array array['savings_goals','monthly_income']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy own_rows on %I for all using (owner = auth.uid()) with check (owner = auth.uid())', t);
  end loop;
end $$;
