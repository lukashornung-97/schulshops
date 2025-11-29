-- ============================================================
-- Automatische Status-Aktualisierung für Schulen bei Shop-Schließung
-- ============================================================
-- Wenn ein Shop geschlossen wird und es keine aktiven Shops mehr gibt,
-- wird die Schule automatisch auf 'production' gesetzt

-- Funktion zum Aktualisieren des Schulstatus bei Shop-Schließung
create or replace function update_school_status_on_shop_close()
returns trigger as $$
declare
  has_active_shop boolean;
begin
  -- Prüfe ob es noch einen aktiven Shop für diese Schule gibt
  select exists(
    select 1 
    from public.shops 
    where school_id = new.school_id 
    and status = 'live'
  ) into has_active_shop;
  
  -- Wenn kein aktiver Shop mehr vorhanden ist und der Shop geschlossen wurde
  if new.status = 'closed' and not has_active_shop then
    -- Setze die Schule auf 'production' (nur wenn sie nicht bereits 'existing' ist)
    update public.schools
    set status = 'production'
    where id = new.school_id
    and status != 'existing'
    and status != 'production';  -- Nur aktualisieren wenn nicht bereits 'production' oder 'existing'
  end if;
  
  return new;
end;
$$ language plpgsql;

-- Trigger beim Aktualisieren von Shops
drop trigger if exists trigger_update_school_status_on_shop_close on public.shops;
create trigger trigger_update_school_status_on_shop_close
  after update of status on public.shops
  for each row
  when (new.status = 'closed')
  execute function update_school_status_on_shop_close();

-- Kommentar
comment on function update_school_status_on_shop_close() is 'Setzt automatisch den Status einer Schule auf "production", wenn der letzte Shop geschlossen wird';

