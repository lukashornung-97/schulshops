-- Migration: Update textile_catalog für CSV-Import
-- Passt die Tabelle an, um Daten aus der Probepaketdatenbank-CSV zu importieren

-- Ändere base_price zu DEFAULT 0 und optional
ALTER TABLE public.textile_catalog 
  ALTER COLUMN base_price SET DEFAULT 0,
  ALTER COLUMN base_price DROP NOT NULL;

-- Stelle sicher, dass id nicht automatisch generiert wird (wird aus CSV übernommen)
-- Die id wird bereits als PRIMARY KEY definiert, also ist das OK

-- Kommentar aktualisieren
COMMENT ON COLUMN public.textile_catalog.id IS 'UUID aus Probepaketdatenbank-CSV';
COMMENT ON COLUMN public.textile_catalog.name IS 'Produktname aus CSV (produktname)';
COMMENT ON COLUMN public.textile_catalog.brand IS 'Herstellername aus CSV (herstellername)';
COMMENT ON COLUMN public.textile_catalog.base_price IS 'Einkaufspreis (kann später gesetzt werden, Standard: 0)';
COMMENT ON COLUMN public.textile_catalog.available_colors IS 'Farben aus CSV (produktfarben als JSON-Array)';
COMMENT ON COLUMN public.textile_catalog.available_sizes IS 'Größen aus CSV (produktgrößen als JSON-Array)';


