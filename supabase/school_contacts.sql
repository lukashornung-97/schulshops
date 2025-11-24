-- ============================================================
-- CRM: Ansprechpartner und Kontaktdaten für Schulen
-- ============================================================
-- Führen Sie dieses Script in Ihrer Supabase SQL-Konsole aus
-- oder über die Supabase CLI

-- Tabelle erstellen (falls noch nicht vorhanden)
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

-- Index erstellen
create index if not exists idx_school_contacts_school_id
  on public.school_contacts (school_id);

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

-- RLS (Row Level Security) aktivieren (optional, falls RLS verwendet wird)
alter table public.school_contacts enable row level security;

-- RLS Policies: Erlaube allen authentifizierten Benutzern Lese- und Schreibzugriff
-- Passen Sie diese Policies an Ihre Anforderungen an!

-- Policy für SELECT (Lesen)
drop policy if exists "Allow authenticated users to read school contacts" on public.school_contacts;
create policy "Allow authenticated users to read school contacts"
  on public.school_contacts
  for select
  using (true);

-- Policy für INSERT (Einfügen)
drop policy if exists "Allow authenticated users to insert school contacts" on public.school_contacts;
create policy "Allow authenticated users to insert school contacts"
  on public.school_contacts
  for insert
  with check (true);

-- Policy für UPDATE (Aktualisieren)
drop policy if exists "Allow authenticated users to update school contacts" on public.school_contacts;
create policy "Allow authenticated users to update school contacts"
  on public.school_contacts
  for update
  using (true)
  with check (true);

-- Policy für DELETE (Löschen)
drop policy if exists "Allow authenticated users to delete school contacts" on public.school_contacts;
create policy "Allow authenticated users to delete school contacts"
  on public.school_contacts
  for delete
  using (true);

-- Falls Sie RLS nicht verwenden möchten, können Sie es deaktivieren:
-- alter table public.school_contacts disable row level security;

