-- Migration: Sponsoring und Marge für Lead-Konfigurationen
-- Fügt Felder für Sponsoring-Betrag (in Euro) und Marge zur lead_configurations Tabelle hinzu

ALTER TABLE public.lead_configurations
  ADD COLUMN IF NOT EXISTS sponsoring NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS margin NUMERIC(5,2) DEFAULT 0;

COMMENT ON COLUMN public.lead_configurations.sponsoring IS 'Sponsoring-Betrag in Euro (wird auf jedes Textil aufgeschlagen)';
COMMENT ON COLUMN public.lead_configurations.margin IS 'Marge in Prozent (z.B. 20 für 20%)';

