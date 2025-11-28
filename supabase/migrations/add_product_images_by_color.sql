-- Migration: Add image and print file fields organized by textile color
-- Date: 2024-01-XX

-- Erstelle Tabelle für Produktbilder nach Textilfarbe
CREATE TABLE IF NOT EXISTS public.product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  textile_color_id uuid REFERENCES public.product_variants(id), -- Optional: Verknüpfung mit Variante
  textile_color_name text, -- Fallback: Name der Textilfarbe (z.B. "Schwarz", "Weiß")
  image_type text NOT NULL CHECK (image_type IN ('front', 'back', 'side')),
  image_url text NOT NULL,
  print_file_url text, -- Optional: Druckdatei für diese Kombination
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(product_id, textile_color_name, image_type) -- Eine Kombination pro Produkt/Farbe/Typ
);

CREATE INDEX IF NOT EXISTS idx_product_images_product_id
  ON public.product_images (product_id);

CREATE INDEX IF NOT EXISTS idx_product_images_textile_color
  ON public.product_images (textile_color_name);

-- Kommentare
COMMENT ON TABLE public.product_images IS 'Produktbilder und Druckdateien organisiert nach Textilfarbe';
COMMENT ON COLUMN public.product_images.textile_color_id IS 'Verknüpfung mit product_variants falls vorhanden';
COMMENT ON COLUMN public.product_images.textile_color_name IS 'Name der Textilfarbe (z.B. "Schwarz", "Weiß", "Navy")';
COMMENT ON COLUMN public.product_images.image_type IS 'Typ des Bildes: front, back, oder side';
COMMENT ON COLUMN public.product_images.image_url IS 'URL zum Shopify Frontend Bild';
COMMENT ON COLUMN public.product_images.print_file_url IS 'URL zur Druckdatei für diese Kombination';

-- Trigger für updated_at
CREATE OR REPLACE FUNCTION update_product_images_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_product_images_updated_at
  BEFORE UPDATE ON public.product_images
  FOR EACH ROW
  EXECUTE FUNCTION update_product_images_updated_at();

