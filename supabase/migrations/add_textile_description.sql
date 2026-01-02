-- ============================================================
-- Migration: Beschreibungsfeld für textile_catalog hinzufügen
-- ============================================================

-- Füge description Feld hinzu, falls es noch nicht existiert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'textile_catalog' 
    AND column_name = 'description'
  ) THEN
    ALTER TABLE public.textile_catalog
    ADD COLUMN description text;
    
    COMMENT ON COLUMN public.textile_catalog.description IS 'Produktbeschreibung, kann von l-shop-team.de geladen werden';
  END IF;
END $$;


