# Supabase Storage Setup für Produktbilder

## Storage Buckets erstellen

In der Supabase Console müssen zwei Storage Buckets erstellt werden:

### 1. `product-images` Bucket
- **Name**: `product-images`
- **Public**: ✅ Ja (für Shopify Frontend)
- **File size limit**: Nach Bedarf (z.B. 5MB)
- **Allowed MIME types**: `image/*`

### 2. `print-files` Bucket
- **Name**: `print-files`
- **Public**: ⚠️ Optional (je nach Anforderung)
- **File size limit**: Nach Bedarf (z.B. 50MB für große Druckdateien)
- **Allowed MIME types**: `application/pdf`, `image/*`, `application/postscript`, `application/illustrator`

## Storage Policies

Für beide Buckets sollten Policies erstellt werden:

### Policy: Authenticated users can upload
```sql
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-images' OR bucket_id = 'print-files');
```

### Policy: Authenticated users can update
```sql
CREATE POLICY "Authenticated users can update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'product-images' OR bucket_id = 'print-files');
```

### Policy: Authenticated users can delete
```sql
CREATE POLICY "Authenticated users can delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'product-images' OR bucket_id = 'print-files');
```

### Policy: Public can read (nur für product-images)
```sql
CREATE POLICY "Public can read product images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'product-images');
```

## Setup via Supabase Dashboard

1. Gehe zu **Storage** in der Supabase Console
2. Klicke auf **New bucket**
3. Erstelle beide Buckets mit den oben genannten Einstellungen
4. Gehe zu **Policies** für jeden Bucket
5. Füge die oben genannten Policies hinzu

## Alternative: SQL Migration

Falls du die Buckets via SQL erstellen möchtest:

```sql
-- Erstelle product-images Bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Erstelle print-files Bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('print-files', 'print-files', false)
ON CONFLICT (id) DO NOTHING;
```












