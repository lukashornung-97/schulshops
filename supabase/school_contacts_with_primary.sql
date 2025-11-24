-- ============================================================
-- Vollständiges SQL-Script: Schools mit Primary Contact
-- ============================================================
-- Dieses Script erstellt/erweitert die Tabellen für CRM-Funktionalität
-- mit einer Verknüpfung zwischen schools und school_contacts

-- ============================================================
-- Schritt 1: Schulen-Tabelle (falls noch nicht vorhanden)
-- ============================================================
create table if not exists public.schools (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  short_code text unique,             -- z.B. "GSG-HH"
  city       text,
  country    text default 'DE',
  created_at timestamptz default now()
);

-- ============================================================
-- Schritt 2: School Contacts Tabelle erstellen
-- ============================================================
create table if not exists public.school_contacts (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references public.schools(id) on delete cascade,
  first_name    text not null,
  last_name     text not null,
  title         text,                       -- z.B. "Schulleiter", "Sekretärin"
  role          text,                       -- z.B. "Schulleitung", "Verwaltung", "IT"
  email         text,
  phone         text,
  mobile        text,
  notes         text,                       -- Notizen zum Kontakt
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Index für school_id
create index if not exists idx_school_contacts_school_id
  on public.school_contacts (school_id);

-- ============================================================
-- Schritt 3: contact_id zur schools Tabelle hinzufügen
-- ============================================================
-- Füge das Feld hinzu (falls es noch nicht existiert)
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'schools' 
    and column_name = 'contact_id'
  ) then
    alter table public.schools 
    add column contact_id uuid;
  end if;
end $$;

-- Foreign Key Constraint hinzufügen (falls noch nicht vorhanden)
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints 
    where constraint_schema = 'public' 
    and constraint_name = 'schools_contact_id_fkey'
  ) then
    alter table public.schools
    add constraint schools_contact_id_fkey
    foreign key (contact_id) 
    references public.school_contacts(id) 
    on delete set null;
  end if;
end $$;

-- Index für contact_id (für bessere Performance)
create index if not exists idx_schools_contact_id
  on public.schools (contact_id);

-- ============================================================
-- Schritt 4: Trigger für updated_at in school_contacts
-- ============================================================
-- Trigger-Funktion für updated_at (falls noch nicht vorhanden)
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger erstellen (löscht alten Trigger falls vorhanden und erstellt neuen)
drop trigger if exists update_school_contacts_updated_at on public.school_contacts;
create trigger update_school_contacts_updated_at
  before update on public.school_contacts
  for each row
  execute function update_updated_at_column();

-- ============================================================
-- Schritt 5: RLS (Row Level Security) - Optional
-- ============================================================
-- RLS für school_contacts aktivieren
alter table public.school_contacts enable row level security;

-- RLS Policies für school_contacts
drop policy if exists "Allow authenticated users to read school contacts" on public.school_contacts;
create policy "Allow authenticated users to read school contacts"
  on public.school_contacts
  for select
  using (true);

drop policy if exists "Allow authenticated users to insert school contacts" on public.school_contacts;
create policy "Allow authenticated users to insert school contacts"
  on public.school_contacts
  for insert
  with check (true);

drop policy if exists "Allow authenticated users to update school contacts" on public.school_contacts;
create policy "Allow authenticated users to update school contacts"
  on public.school_contacts
  for update
  using (true)
  with check (true);

drop policy if exists "Allow authenticated users to delete school contacts" on public.school_contacts;
create policy "Allow authenticated users to delete school contacts"
  on public.school_contacts
  for delete
  using (true);

-- ============================================================
-- Schritt 6: Kommentare für Dokumentation
-- ============================================================
comment on column public.schools.contact_id is 'Referenz zum primären Ansprechpartner der Schule';
comment on column public.school_contacts.school_id is 'Referenz zur Schule, zu der dieser Kontakt gehört';

-- ============================================================
-- Fertig!
-- ============================================================
-- Die Tabellen sind jetzt erstellt und verknüpft:
-- - schools.contact_id -> school_contacts.id (optional, kann NULL sein)
-- - school_contacts.school_id -> schools.id (erforderlich)
--
-- Verwendung:
-- - Eine Schule kann einen primären Kontakt haben (contact_id)
-- - Eine Schule kann mehrere Kontakte haben (über school_contacts.school_id)
-- - Wenn ein Kontakt gelöscht wird, wird contact_id auf NULL gesetzt (on delete set null)

