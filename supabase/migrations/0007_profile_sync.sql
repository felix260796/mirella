-- Mirella: Geräte-Sync, Profile (Privat / Geschäft) und mehrere Personen
--
-- Login  = eine Person (Felix, später z. B. Freundin oder Kumpel). Anmeldung nur mit Einladung.
-- Profil = eine eigene Welt innerhalb einer Person: "Privat" und "Geschäft". Daten zweier Profile sehen sich nie.
-- Alle Geräte mit demselben Profil haben sofort denselben Stand (Supabase Realtime).
--
-- Kniff: Die Spalte "owner" in allen Tabellen zeigt ab jetzt auf ein Profil statt auf das Login.
-- Damit verhält sich jedes Profil wie ein eigenes Konto; alle Schlüssel und Regeln aus 0001–0006 bleiben gültig.
-- Das Profil "Privat" hat dieselbe id wie das Login.

-- ---------- 1. Profile ----------
create table profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,                            -- 'Privat', 'Geschäft' …
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, label)
);
create index on profiles (user_id);
alter table profiles enable row level security;
create policy own_profiles on profiles for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Das Privat-Profil darf nicht gelöscht werden (sonst wäre alles Private weg)
create policy keep_private on profiles as restrictive for delete using (id <> auth.uid());

-- Alle Profile des angemeldeten Logins (schnell, wird von jeder Regel benutzt)
create or replace function my_profiles() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from profiles where user_id = auth.uid()
$$;
revoke execute on function my_profiles() from public, anon;
grant execute on function my_profiles() to authenticated;

-- ---------- 2. owner -> Profil, Zugriffsregel neu ----------
do $$
declare t text;
begin
  foreach t in array array[
    'settings','contacts','contact_notes','calls','items','shopping_items','templates','rules','pushes',
    'push_subscriptions','areas','records','record_kinds','files','record_log','expenses',
    'expense_categories','savings_goals','monthly_income']
  loop
    execute format('alter table %I drop constraint %I', t, t || '_owner_fkey');
    execute format('alter table %I add constraint %I foreign key (owner) references profiles(id) on delete cascade', t, t || '_owner_fkey');
    execute format('drop policy own_rows on %I', t);
    execute format('create policy own_rows on %I for all to authenticated
                      using (owner in (select my_profiles())) with check (owner in (select my_profiles()))', t);
  end loop;
end $$;

-- ---------- 3. Startdaten je Profil ----------
create or replace function seed_profile(p uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into settings (owner) values (p) on conflict do nothing;
  insert into areas (owner, id, name, sort) values
    (p,'auto','Auto',1),(p,'geld','Finanzen & Verträge',2),(p,'gesund','Gesundheit',3),
    (p,'haus','Zuhause & Smart Home',4),(p,'doku','Dokumente',5),(p,'frei','Freizeit & Reisen',6)
    on conflict do nothing;
  perform seed_expense_categories(p);
end $$;
revoke execute on function seed_profile(uuid) from public, anon, authenticated;
revoke execute on function seed_expense_categories(uuid) from public, anon, authenticated;

-- Jedes neue Profil bekommt automatisch Einstellungen, Bereiche und Kategorien
create or replace function handle_new_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin perform seed_profile(new.id); return new; end $$;
create trigger on_profile_created after insert on profiles
  for each row execute function handle_new_profile();

-- Neue Person: Profil "Privat" (id = Login-id) anlegen
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, user_id, label, sort) values (new.id, new.id, 'Privat', 1);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ---------- 4. updated_at überall (Grundlage für den Abgleich: neuester Stand gewinnt) ----------
create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'settings','contacts','contact_notes','calls','items','shopping_items','templates','rules','pushes',
    'push_subscriptions','areas','records','record_kinds','files','record_log','expenses',
    'expense_categories','savings_goals','monthly_income','profiles']
  loop
    execute format('alter table %I add column if not exists updated_at timestamptz not null default now()', t);
    execute format('create trigger touch before update on %I for each row execute function touch_updated_at()', t);
  end loop;
end $$;

-- ---------- 5. Verknüpfungen nur innerhalb desselben Profils ----------
-- Fremdschlüssel prüfen sonst nicht, zu welchem Profil die verknüpfte Zeile gehört. Daher (id, owner) gemeinsam.
alter table contacts add constraint contacts_id_owner_key unique (id, owner);
alter table records  add constraint records_id_owner_key  unique (id, owner);
alter table files    add constraint files_id_owner_key    unique (id, owner);

alter table contact_notes drop constraint contact_notes_contact_id_fkey,
  add constraint contact_notes_contact_fk foreign key (contact_id, owner) references contacts (id, owner) on delete cascade;
alter table calls drop constraint calls_contact_id_fkey,
  add constraint calls_contact_fk foreign key (contact_id, owner) references contacts (id, owner) on delete cascade;
alter table items drop constraint items_contact_id_fkey,
  add constraint items_contact_fk foreign key (contact_id, owner) references contacts (id, owner) on delete set null (contact_id);
alter table items drop constraint items_record_id_fkey,
  add constraint items_record_fk foreign key (record_id, owner) references records (id, owner) on delete set null (record_id);
alter table files drop constraint files_record_id_fkey,
  add constraint files_record_fk foreign key (record_id, owner) references records (id, owner) on delete cascade;
alter table record_log drop constraint record_log_record_id_fkey,
  add constraint record_log_record_fk foreign key (record_id, owner) references records (id, owner) on delete cascade;
alter table expenses drop constraint expenses_record_id_fkey,
  add constraint expenses_record_fk foreign key (record_id, owner) references records (id, owner) on delete set null (record_id);
alter table expenses drop constraint expenses_file_id_fkey,
  add constraint expenses_file_fk foreign key (file_id, owner) references files (id, owner) on delete set null (file_id);

-- ---------- 6. Push: ein Gerät kann Hinweise für mehrere Profile bekommen (einstellbar je Gerät) ----------
alter table push_subscriptions drop constraint push_subscriptions_endpoint_key,
  add constraint push_subscriptions_owner_endpoint_key unique (owner, endpoint);

-- ---------- 7. Dateispeicher (Belege, Dokumente): jedes Profil nur im eigenen Ordner ----------
-- Pfad immer: <profil-id>/<datei>, z. B. '3f2a…/belege/2026-11-07-aral.jpg'
insert into storage.buckets (id, name, public) values ('dokumente', 'dokumente', false)
  on conflict (id) do nothing;

create policy dokumente_own on storage.objects for all to authenticated
  using (bucket_id = 'dokumente' and (storage.foldername(name))[1] in (select id::text from my_profiles() id))
  with check (bucket_id = 'dokumente' and (storage.foldername(name))[1] in (select id::text from my_profiles() id));

-- ---------- 8. Echtzeit-Sync: Änderungen sofort an alle Geräte mit demselben Profil ----------
-- Realtime hält sich an Row Level Security. Bei Löschungen kommt nur der Schlüssel an (kein Inhalt).
do $$
declare t text;
begin
  foreach t in array array[
    'settings','contacts','contact_notes','calls','items','shopping_items','templates','rules',
    'areas','records','record_kinds','files','record_log','expenses','expense_categories',
    'savings_goals','monthly_income','profiles']
  loop
    execute format('alter publication supabase_realtime add table %I', t);
  end loop;
end $$;

-- Hinweis Einrichtung (Supabase-Oberfläche, kein SQL):
--   Authentication > Sign In / Providers > "Allow new users to sign up" AUS.
--   Neue Personen nur über Authentication > Users > "Invite user" (Felix lädt per E-Mail ein).
