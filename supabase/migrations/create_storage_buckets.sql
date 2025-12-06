-- ============================================================
-- Erstelle Storage Buckets für Produktbilder und Druckdateien
-- ============================================================
-- Diese Migration erstellt die benötigten Storage Buckets in Supabase

-- Erstelle product-images Bucket (für Produktbilder)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  5242880, -- 5MB
  ARRAY['image/*']
)
ON CONFLICT (id) DO UPDATE
SET 
  name = EXCLUDED.name,
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Erstelle print-files Bucket (für Druckdateien)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'print-files',
  'print-files',
  true, -- Öffentlich, damit Druckdateien im Frontend angezeigt werden können
  52428800, -- 50MB für große Druckdateien
  ARRAY['application/pdf', 'image/*', 'application/postscript', 'application/illustrator', 'application/x-illustrator']
)
ON CONFLICT (id) DO UPDATE
SET 
  name = EXCLUDED.name,
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================================
-- Storage Policies für product-images Bucket
-- ============================================================

-- Policy: Authenticated users can upload product images
DROP POLICY IF EXISTS "Authenticated users can upload product images" ON storage.objects;
CREATE POLICY "Authenticated users can upload product images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-images');

-- Policy: Authenticated users can update product images
DROP POLICY IF EXISTS "Authenticated users can update product images" ON storage.objects;
CREATE POLICY "Authenticated users can update product images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'product-images');

-- Policy: Authenticated users can delete product images
DROP POLICY IF EXISTS "Authenticated users can delete product images" ON storage.objects;
CREATE POLICY "Authenticated users can delete product images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'product-images');

-- Policy: Public can read product images (für Shopify Frontend)
DROP POLICY IF EXISTS "Public can read product images" ON storage.objects;
CREATE POLICY "Public can read product images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'product-images');

-- ============================================================
-- Storage Policies für print-files Bucket
-- ============================================================

-- Policy: Authenticated users can upload print files
DROP POLICY IF EXISTS "Authenticated users can upload print files" ON storage.objects;
CREATE POLICY "Authenticated users can upload print files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'print-files');

-- Policy: Authenticated users can update print files
DROP POLICY IF EXISTS "Authenticated users can update print files" ON storage.objects;
CREATE POLICY "Authenticated users can update print files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'print-files');

-- Policy: Authenticated users can delete print files
DROP POLICY IF EXISTS "Authenticated users can delete print files" ON storage.objects;
CREATE POLICY "Authenticated users can delete print files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'print-files');

-- Policy: Authenticated users can read print files
DROP POLICY IF EXISTS "Authenticated users can read print files" ON storage.objects;
CREATE POLICY "Authenticated users can read print files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'print-files');

-- Policy: Public can read print files (da Bucket jetzt öffentlich ist)
DROP POLICY IF EXISTS "Public can read print files" ON storage.objects;
CREATE POLICY "Public can read print files"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'print-files');

