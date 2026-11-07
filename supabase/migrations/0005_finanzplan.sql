-- Mirella: Finanzplan unter Finanzen
-- 12 Start-Kategorien mit Monatsbudget, Einkommen, feste Kosten aus Verträgen (records mit monthly_cost).

create table expense_categories (
  owner uuid not null references auth.users(id) on delete cascade,
  name text not null,
  monthly_budget numeric(10,2),
  sort int not null default 0,
  keywords text[] not null default '{}',   -- Hilfe für die Zuordnung, z. B. {'Aral','Shell','Tankstelle'}
  primary key (owner, name)
);

alter table settings add column monthly_net_income numeric(10,2);

-- Startwerte (beim ersten Login für den Nutzer anlegen)
create or replace function seed_expense_categories(u uuid) returns void language sql as $$
  insert into expense_categories (owner, name, monthly_budget, sort) values
    (u,'Lebensmittel',400,1),(u,'Restaurant & Café',150,2),(u,'Tanken & Auto',200,3),(u,'Kleidung',80,4),
    (u,'Drogerie & Gesundheit',50,5),(u,'Haushalt & Wohnen',80,6),(u,'Hobby & Sport',60,7),(u,'Freizeit & Ausgehen',80,8),
    (u,'Reisen',150,9),(u,'Geschenke',50,10),(u,'Technik & Abos',40,11),(u,'Sonstiges',50,12)
  on conflict do nothing;
$$;

alter table expense_categories enable row level security;
create policy own_rows on expense_categories for all using (owner = auth.uid()) with check (owner = auth.uid());

-- Monatsübersicht: frei ausgegeben je Kategorie
create view monthly_spending with (security_invoker = true) as
  select owner, date_trunc('month', spent_on)::date as month, category, sum(amount) as total
  from expenses where confirmed
  group by owner, date_trunc('month', spent_on), category;
