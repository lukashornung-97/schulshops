-- ============================================================
-- Tasks und Notizen für Schulen (Timeline)
-- ============================================================
create table if not exists public.school_notes (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references public.schools(id) on delete cascade,
  type          text not null default 'note',  -- 'note' oder 'task'
  title         text not null,
  content       text,
  completed     boolean default false,          -- Nur für Tasks relevant
  due_date      timestamptz,                   -- Optional: Fälligkeitsdatum für Tasks
  created_by    uuid references auth.users(id), -- Optional: Wer hat es erstellt
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Index für school_id
create index if not exists idx_school_notes_school_id
  on public.school_notes (school_id);

-- Index für created_at (für Timeline-Sortierung)
create index if not exists idx_school_notes_created_at
  on public.school_notes (created_at desc);

-- Constraint für gültige Typen
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints 
    where constraint_schema = 'public' 
    and constraint_name = 'school_notes_type_check'
  ) then
    alter table public.school_notes
    add constraint school_notes_type_check
    check (type in ('note', 'task'));
  end if;
end $$;

-- Trigger für updated_at
drop trigger if exists update_school_notes_updated_at on public.school_notes;
create trigger update_school_notes_updated_at
  before update on public.school_notes
  for each row
  execute function update_updated_at_column();

-- RLS aktivieren
alter table public.school_notes enable row level security;

-- RLS Policies
drop policy if exists "Allow authenticated users to read school notes" on public.school_notes;
create policy "Allow authenticated users to read school notes"
  on public.school_notes
  for select
  using (true);

drop policy if exists "Allow authenticated users to insert school notes" on public.school_notes;
create policy "Allow authenticated users to insert school notes"
  on public.school_notes
  for insert
  with check (true);

drop policy if exists "Allow authenticated users to update school notes" on public.school_notes;
create policy "Allow authenticated users to update school notes"
  on public.school_notes
  for update
  using (true)
  with check (true);

drop policy if exists "Allow authenticated users to delete school notes" on public.school_notes;
create policy "Allow authenticated users to delete school notes"
  on public.school_notes
  for delete
  using (true);

-- Kommentare
comment on column public.school_notes.type is 'Typ des Eintrags: note (Notiz) oder task (Aufgabe)';
comment on column public.school_notes.completed is 'Erledigt-Status (nur für Tasks)';
comment on column public.school_notes.due_date is 'Fälligkeitsdatum (optional, nur für Tasks)';


