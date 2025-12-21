-- Migration: Products-Tabelle für Lead-Dashboard erweitern
-- Fügt Felder für Textil-Verknüpfung, Druckkonfiguration und berechnete Preise hinzu

-- Verknüpfung mit Textilkatalog
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS textile_id UUID REFERENCES public.textile_catalog(id) ON DELETE SET NULL;

-- Druckkonfiguration: { front: { method_id, method_name, files }, back: {...}, side: {...} }
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS print_config JSONB DEFAULT '{}';

-- Berechnete Preise
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS calculated_ek_netto NUMERIC(10,2);

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS calculated_vk_brutto NUMERIC(10,2);

-- Indizes
CREATE INDEX IF NOT EXISTS idx_products_textile_id
  ON public.products (textile_id);

-- Kommentare
COMMENT ON COLUMN public.products.textile_id IS 'Verknüpfung mit dem Textilkatalog';
COMMENT ON COLUMN public.products.print_config IS 'Druckkonfiguration: { front: { method_id, method_name, files }, back: {...}, side: {...} }';
COMMENT ON COLUMN public.products.calculated_ek_netto IS 'Berechneter Einkaufspreis Netto';
COMMENT ON COLUMN public.products.calculated_vk_brutto IS 'Berechneter Verkaufspreis Brutto';

