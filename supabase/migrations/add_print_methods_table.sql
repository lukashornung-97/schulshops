-- Migration: Druckarten-Tabelle erstellen
-- Speichert die verfügbaren Druckarten (Siebdruck 1-8 Farben, Digitaldruck klein/mittel/groß)

CREATE TABLE IF NOT EXISTS public.print_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,                    -- z.B. "1 farbig Siebdruck", "Digitaldruck klein"
  display_order INTEGER DEFAULT 0,              -- Reihenfolge für Anzeige
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indizes
CREATE INDEX IF NOT EXISTS idx_print_methods_active
  ON public.print_methods (active);

CREATE INDEX IF NOT EXISTS idx_print_methods_display_order
  ON public.print_methods (display_order);

-- Trigger für updated_at
CREATE TRIGGER update_print_methods_updated_at
  BEFORE UPDATE ON public.print_methods
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Kommentare
COMMENT ON TABLE public.print_methods IS 'Verfügbare Druckarten für das Lead-Dashboard';

-- RLS Policies (öffentlich lesbar, nur Admins können schreiben)
ALTER TABLE public.print_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active print methods"
  ON public.print_methods FOR SELECT
  USING (active = true);

CREATE POLICY "Admins can manage print methods"
  ON public.print_methods FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- Standard-Druckarten einfügen
INSERT INTO public.print_methods (name, display_order, active) VALUES
  ('1 farbig Siebdruck', 1, true),
  ('2 farbig Siebdruck', 2, true),
  ('3 farbig Siebdruck', 3, true),
  ('4 farbig Siebdruck', 4, true),
  ('5 farbig Siebdruck', 5, true),
  ('6 farbig Siebdruck', 6, true),
  ('7 farbig Siebdruck', 7, true),
  ('8 farbig Siebdruck', 8, true),
  ('Digitaldruck klein', 9, true),
  ('Digitaldruck mittel', 10, true),
  ('Digitaldruck groß', 11, true)
ON CONFLICT (name) DO NOTHING;



