-- ============================================================
-- Lead Dashboard: Textilkatalog, Lead-Konfigurationen, Druckkosten
-- ============================================================

-- 1. Textilkatalog-Tabelle
CREATE TABLE IF NOT EXISTS public.textile_catalog (
  id uuid PRIMARY KEY,                   -- UUID aus CSV/Probepaketdatenbank
  name text NOT NULL,                    -- z.B. "T-Shirt", "Hoodie" (produktname aus CSV)
  brand text,                           -- z.B. "Stanley/Stella" (herstellername aus CSV)
  article_number text,                  -- Artikelnummer (optional)
  base_price numeric(10,2) DEFAULT 0,   -- Einkaufspreis (kann später gesetzt werden)
  available_colors text[],              -- ["Schwarz", "Weiß", "Navy"] (produktfarben aus CSV)
  available_sizes text[],               -- ["XS", "S", "M", "L", "XL", "XXL"] (produktgrößen aus CSV)
  image_url text,                        -- Vorschaubild (optional)
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_textile_catalog_active
  ON public.textile_catalog (active);

-- 2. Druckkosten-Tabelle
CREATE TABLE IF NOT EXISTS public.print_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,                    -- z.B. "Standard Druck Vorne"
  position text NOT NULL CHECK (position IN ('front', 'back', 'side')),
  cost_per_unit numeric(10,2) NOT NULL,  -- Kosten pro Stück
  setup_fee numeric(10,2) DEFAULT 0,    -- Einrichtungsgebühr (optional)
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_print_costs_position
  ON public.print_costs (position);

CREATE INDEX IF NOT EXISTS idx_print_costs_active
  ON public.print_costs (active);

-- 3. Lead-Konfiguration-Tabelle
CREATE TABLE IF NOT EXISTS public.lead_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  shop_id uuid REFERENCES public.shops(id) ON DELETE SET NULL,  -- wird nach Bestätigung gesetzt
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected')),
  selected_textiles jsonb NOT NULL DEFAULT '[]'::jsonb,  -- Ausgewählte Textilien mit Konfiguration
  print_positions jsonb NOT NULL DEFAULT '{}'::jsonb,     -- Druckpositionen pro Textil
  price_calculation jsonb,                                 -- Berechnete Preise
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_configurations_school_id
  ON public.lead_configurations (school_id);

CREATE INDEX IF NOT EXISTS idx_lead_configurations_status
  ON public.lead_configurations (status);

CREATE INDEX IF NOT EXISTS idx_lead_configurations_shop_id
  ON public.lead_configurations (shop_id);

-- Trigger für updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_textile_catalog_updated_at
  BEFORE UPDATE ON public.textile_catalog
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_print_costs_updated_at
  BEFORE UPDATE ON public.print_costs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lead_configurations_updated_at
  BEFORE UPDATE ON public.lead_configurations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Kommentare
COMMENT ON TABLE public.textile_catalog IS 'Katalog verfügbarer Textilien für Lead-Schulen';
COMMENT ON TABLE public.print_costs IS 'Druckkosten pro Position (Vorne/Hinten/Seite)';
COMMENT ON TABLE public.lead_configurations IS 'Konfigurationen für Lead-Schulen (Textilauswahl, Druckpositionen, Preise)';

-- RLS Policies für textile_catalog (öffentlich lesbar, nur Admins können schreiben)
ALTER TABLE public.textile_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active textile catalog"
  ON public.textile_catalog FOR SELECT
  USING (active = true);

CREATE POLICY "Admins can manage textile catalog"
  ON public.textile_catalog FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- RLS Policies für print_costs (öffentlich lesbar, nur Admins können schreiben)
ALTER TABLE public.print_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active print costs"
  ON public.print_costs FOR SELECT
  USING (active = true);

CREATE POLICY "Admins can manage print costs"
  ON public.print_costs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- RLS Policies für lead_configurations (nur für betroffene Schule sichtbar)
ALTER TABLE public.lead_configurations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read lead configs for their schools"
  ON public.lead_configurations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.school_id = lead_configurations.school_id
    )
    OR EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create lead configs for their schools"
  ON public.lead_configurations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.school_id = lead_configurations.school_id
    )
    OR EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update lead configs for their schools"
  ON public.lead_configurations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.school_id = lead_configurations.school_id
    )
    OR EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

