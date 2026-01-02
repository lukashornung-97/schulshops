-- Migration: Entferne Standard-Preis (cost_per_unit) aus print_method_costs
-- Es gibt nur noch Staffelpreise für 50 und 100 Stück

-- Mache cost_per_unit optional (NULL erlaubt)
ALTER TABLE public.print_method_costs
  ALTER COLUMN cost_per_unit DROP NOT NULL;

-- Kommentar aktualisieren
COMMENT ON COLUMN public.print_method_costs.cost_per_unit IS 'Veraltet: Nicht mehr verwendet. Verwenden Sie cost_50_units und cost_100_units.';



