-- ============================================================
-- Füge 'production' Status zu Schulen hinzu
-- ============================================================
-- Erweitert den CHECK-Constraint um 'production' Status

-- Entferne alten Constraint falls vorhanden
do $$
begin
  if exists (
    select 1 from information_schema.table_constraints 
    where constraint_schema = 'public' 
    and constraint_name = 'schools_status_check'
  ) then
    alter table public.schools
    drop constraint schools_status_check;
  end if;
end $$;

-- Füge neuen Constraint mit 'production' hinzu
alter table public.schools
add constraint schools_status_check
check (status in ('lead', 'active', 'production', 'existing'));

-- Aktualisiere Kommentar
comment on column public.schools.status is 'Status der Schule: lead (Lead), active (Aktiv), production (Produktion), existing (Bestand)';





