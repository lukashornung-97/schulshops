-- ============================================================
-- Schulen Status-Spalte hinzufügen
-- ============================================================
-- Füge die status Spalte zur schools Tabelle hinzu
-- Status-Werte: 'lead' (Lead), 'active' (Aktiv), 'existing' (Bestand)

-- Spalte hinzufügen (falls noch nicht vorhanden)
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'schools' 
    and column_name = 'status'
  ) then
    alter table public.schools 
    add column status text default 'lead';
    
    -- Setze bestehende Schulen auf 'existing' (Bestand)
    update public.schools 
    set status = 'existing' 
    where status = 'lead';
  end if;
end $$;

-- Kommentar hinzufügen
comment on column public.schools.status is 'Status der Schule: lead (Lead), active (Aktiv), existing (Bestand)';

-- Optional: Constraint für gültige Werte
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints 
    where constraint_schema = 'public' 
    and constraint_name = 'schools_status_check'
  ) then
    alter table public.schools
    add constraint schools_status_check
    check (status in ('lead', 'active', 'existing'));
  end if;
end $$;


