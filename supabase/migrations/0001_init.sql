-- Mirella, die Sekretärin: Grundschema
-- Eine Person nutzt die App (Felix). Jede Tabelle gehört einem Nutzer (owner) und ist per Row Level Security geschützt.

create extension if not exists "pgcrypto";

-- Einstellungen (eine Zeile pro Nutzer)
create table settings (
  owner uuid primary key references auth.users(id) on delete cascade,
  nag_interval_min int not null default 60,          -- Nerv-Takt am ersten Tag
  nag_interval_day2_min int not null default 30,     -- ab Tag 2
  call_window_start time not null default '08:00',
  call_window_end time not null default '18:00',
  call_weekdays int[] not null default '{1,2,3,4,5}', -- 1 = Montag
  message_window_start time not null default '08:00',
  message_window_end time not null default '21:00',
  max_calls_per_day int not null default 3,
  birthday_hour time not null default '09:00',
  gift_lead_days int not null default 14,
  retry_after_workdays int not null default 2,
  briefing_time time not null default '07:00',
  briefing_on_leave boolean not null default true,
  home_lat double precision,
  home_lon double precision,
  vacation_until date,
  updated_at timestamptz not null default now()
);

create type call_cycle as enum ('weekly','biweekly','monthly','quarterly','yearly','birthday_only');

create table contacts (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) on delete cascade,
  first_name text not null,
  last_name text,
  nickname text,
  phone text,
  address text,
  group_name text,                         -- Familie, Freunde, Paddeln …
  cycle call_cycle not null default 'monthly',
  birthday date,
  gift_person boolean not null default false,
  last_call_at timestamptz,
  next_call_due date,                      -- von der Erinnerungslogik gepflegt
  paused_until date,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

-- Akte: Notizen, Lebensereignisse, Geschenkideen, offene Nachfragen
create type note_kind as enum ('note','event','gift','follow_up');
create table contact_notes (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  kind note_kind not null,
  body text not null,
  event_date date,                         -- z. B. Abflugtag, Hochzeit
  due_at timestamptz,                      -- für Nachfragen
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create type call_result as enum ('reached','not_reached');
create table calls (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  at timestamptz not null default now(),
  result call_result not null,
  note text
);

-- Aufgaben, Termine, Erinnerungen (alles, was nicht Kontakt ist)
create type item_kind as enum ('task','appointment','group','reminder');
create type trigger_kind as enum ('time','leave_home','arrive_place','carplay');
create table items (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) on delete cascade,
  kind item_kind not null default 'task',
  title text not null,
  area text,                               -- Haushalt, Finanzen, Auto …
  trigger trigger_kind not null default 'time',
  due_at timestamptz,
  place text,                              -- bei arrive_place
  repeat_rule text,                        -- z. B. 'weekly:THU', 'monthly:1', 'yearly'
  nag boolean not null default false,
  contact_id uuid references contacts(id) on delete set null,
  done_at timestamptz,
  snoozed_until timestamptz,
  created_at timestamptz not null default now()
);

create table shopping_items (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) on delete cascade,
  title text not null,
  category text,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

-- Vorlagen (Geburtstags-Paket, Urlaub, Gastgeber …)
create table templates (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) on delete cascade,
  name text not null,
  steps jsonb not null                     -- [{title, offset_days, trigger, nag}]
);

-- Orts- und Smart-Home-Regeln (ausgelöst über iPhone-Kurzbefehle)
create table rules (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) on delete cascade,
  trigger trigger_kind not null,
  place text,
  action text not null,                    -- z. B. 'nag:quiet_until_18', 'remind:<item_id>'
  active boolean not null default true
);

-- Gesendete Push-Nachrichten (für Nerv-Modus und Verlauf)
create table pushes (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) on delete cascade,
  ref_table text not null,
  ref_id uuid not null,
  sent_at timestamptz not null default now(),
  title text not null,
  body text not null
);

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null
);

-- Row Level Security: jeder sieht nur seine eigenen Zeilen
do $$
declare t text;
begin
  foreach t in array array['settings','contacts','contact_notes','calls','items','shopping_items','templates','rules','pushes','push_subscriptions']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy own_rows on %I for all using (owner = auth.uid()) with check (owner = auth.uid())', t);
  end loop;
end $$;

create index on contacts (owner, next_call_due) where not archived;
create index on items (owner, due_at) where done_at is null;
create index on contact_notes (owner, due_at) where kind = 'follow_up' and not done;
