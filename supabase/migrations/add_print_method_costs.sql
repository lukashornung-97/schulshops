-- Migration: Druckarten-Preise Tabelle erstellen
-- Verknüpft Druckarten (print_methods) mit Preisen für verschiedene Mengen

CREATE TABLE IF NOT EXISTS public.print_method_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  print_method_id UUID NOT NULL REFERENCES public.print_methods(id) ON DELETE CASCADE,
  cost_per_unit NUMERIC(10,2) NOT NULL,      -- Standardpreis pro Stück
  cost_50_units NUMERIC(10,2),              -- Preis bei 50 Stück (optional)
  cost_100_units NUMERIC(10,2),             -- Preis bei 100 Stück (optional)
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(print_method_id)
);

-- Indizes
CREATE INDEX IF NOT EXISTS idx_print_method_costs_print_method_id
  ON public.print_method_costs (print_method_id);

CREATE INDEX IF NOT EXISTS idx_print_method_costs_active
  ON public.print_method_costs (active);

-- Trigger für updated_at
CREATE TRIGGER update_print_method_costs_updated_at
  BEFORE UPDATE ON public.print_method_costs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Kommentare
COMMENT ON TABLE public.print_method_costs IS 'Preise für Druckarten (pro Druckart, unabhängig von Position)';
COMMENT ON COLUMN public.print_method_costs.cost_per_unit IS 'Standardpreis pro Stück';
COMMENT ON COLUMN public.print_method_costs.cost_50_units IS 'Preis bei 50 Stück';
COMMENT ON COLUMN public.print_method_costs.cost_100_units IS 'Preis bei 100 Stück';

-- RLS Policies (öffentlich lesbar, nur Admins können schreiben)
ALTER TABLE public.print_method_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active print method costs"
  ON public.print_method_costs FOR SELECT
  USING (active = true);

CREATE POLICY "Admins can manage print method costs"
  ON public.print_method_costs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );



