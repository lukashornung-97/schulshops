-- ============================================================
-- Automatische Status-Aktualisierung für Schulen
-- ============================================================
-- Wenn ein Shop aktiv wird, wird die Schule automatisch auf 'active' gesetzt

-- Funktion zum Aktualisieren des Schulstatus
create or replace function update_school_status_from_shops()
returns trigger as $$
begin
  -- Wenn ein Shop auf 'live' gesetzt wird, setze die Schule auf 'active'
  if new.status = 'live' then
    update public.schools
    set status = 'active'
    where id = new.school_id
    and status != 'active';  -- Nur aktualisieren wenn nicht bereits 'active'
  end if;
  
  return new;
end;
$$ language plpgsql;

-- Trigger beim Einfügen oder Aktualisieren von Shops
drop trigger if exists trigger_update_school_status_on_shop_change on public.shops;
create trigger trigger_update_school_status_on_shop_change
  after insert or update of status on public.shops
  for each row
  when (new.status = 'live')
  execute function update_school_status_from_shops();

-- Kommentar
comment on function update_school_status_from_shops() is 'Aktualisiert automatisch den Status einer Schule auf "active", wenn ein Shop auf "live" gesetzt wird';


