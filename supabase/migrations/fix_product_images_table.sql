-- ============================================================
-- Fix product_images table: Make image_url optional
-- ============================================================
-- Diese Migration passt die product_images Tabelle an, falls sie bereits existiert

-- Mache image_url optional (falls Tabelle bereits existiert)
DO $$
BEGIN
  -- Prüfe ob die Tabelle existiert
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'product_images'
  ) THEN
    -- Entferne NOT NULL Constraint von image_url, falls vorhanden
    ALTER TABLE public.product_images 
    ALTER COLUMN image_url DROP NOT NULL;
    
    -- Füge Constraint hinzu, dass mindestens eine URL vorhanden sein muss
    -- Entferne zuerst den alten Constraint, falls vorhanden
    ALTER TABLE public.product_images 
    DROP CONSTRAINT IF EXISTS check_at_least_one_url;
    
    ALTER TABLE public.product_images 
    ADD CONSTRAINT check_at_least_one_url 
    CHECK (image_url IS NOT NULL OR print_file_url IS NOT NULL);
  END IF;
END $$;



