-- Migration: Preisverwaltung für Lead-Dashboard
-- Erweitert die Datenbank um Tabellen für Textilpreise, Handlingkosten und Druckkosten mit Mengenstaffelung

-- Tabelle für Textilpreise (kann pro Textil überschrieben werden)
CREATE TABLE IF NOT EXISTS public.textile_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  textile_id UUID REFERENCES public.textile_catalog(id) ON DELETE CASCADE,
  price NUMERIC(10,2) NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(textile_id)
);

-- Tabelle für Handlingkosten
CREATE TABLE IF NOT EXISTS public.handling_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cost_per_order NUMERIC(10,2) NOT NULL DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Erweitere print_costs um Mengenstaffelung (50 und 100 Stück)
ALTER TABLE public.print_costs
  ADD COLUMN IF NOT EXISTS cost_50_units NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS cost_100_units NUMERIC(10,2);

-- Kommentare
COMMENT ON TABLE public.textile_prices IS 'Preise für Textilien (können den base_price aus textile_catalog überschreiben)';
COMMENT ON TABLE public.handling_costs IS 'Handlingkosten pro Bestellung';
COMMENT ON COLUMN public.print_costs.cost_50_units IS 'Druckkosten für 50 Stück';
COMMENT ON COLUMN public.print_costs.cost_100_units IS 'Druckkosten für 100 Stück';

-- Indizes
CREATE INDEX IF NOT EXISTS idx_textile_prices_textile_id
  ON public.textile_prices (textile_id);

CREATE INDEX IF NOT EXISTS idx_textile_prices_active
  ON public.textile_prices (active);

-- Trigger für updated_at
CREATE TRIGGER update_textile_prices_updated_at
  BEFORE UPDATE ON public.textile_prices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_handling_costs_updated_at
  BEFORE UPDATE ON public.handling_costs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies für textile_prices (öffentlich lesbar, nur Admins können schreiben)
ALTER TABLE public.textile_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active textile prices"
  ON public.textile_prices FOR SELECT
  USING (active = true);

CREATE POLICY "Admins can manage textile prices"
  ON public.textile_prices FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- RLS Policies für handling_costs (öffentlich lesbar, nur Admins können schreiben)
ALTER TABLE public.handling_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active handling costs"
  ON public.handling_costs FOR SELECT
  USING (active = true);

CREATE POLICY "Admins can manage handling costs"
  ON public.handling_costs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- Erstelle einen Standard-Eintrag für Handlingkosten
INSERT INTO public.handling_costs (cost_per_order, active)
VALUES (0, true)
ON CONFLICT DO NOTHING;


