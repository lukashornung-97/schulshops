# Shopify Produkt mit Bildern testen

## Schritt 1: Shopify Access Token erstellen

Für `graduprint-test.myshopify.com` benötigen Sie einen Admin API Access Token:

1. **Gehen Sie zu Shopify Admin**
   - Öffnen Sie https://graduprint-test.myshopify.com/admin
   - Melden Sie sich an

2. **Erstellen Sie eine App**
   - Gehen Sie zu **Settings** → **Apps and sales channels**
   - Klicken Sie auf **Develop apps** (oder **Create an app**)
   - Geben Sie einen Namen ein (z.B. "Schulshop Integration")
   - Klicken Sie auf **Create app**

3. **Konfigurieren Sie API-Berechtigungen**
   - Klicken Sie auf **Configure Admin API scopes**
   - Aktivieren Sie:
     - ✅ `write_products`
     - ✅ `read_products` (optional, aber empfohlen)
   - Klicken Sie auf **Save**

4. **Erstellen Sie einen Access Token**
   - Gehen Sie zum Tab **API credentials**
   - Klicken Sie auf **Install app** (falls nötig)
   - Klicken Sie auf **Create Admin API access token**
   - Kopieren Sie den Token (beginnt mit `shpat_`)
   - ⚠️ **Wichtig**: Speichern Sie den Token sicher, er wird nur einmal angezeigt!

## Schritt 2: Verbindung konfigurieren

### Option A: Via UI (Empfohlen)

1. Starten Sie den Next.js Server:
   ```bash
   npm run dev
   ```

2. Öffnen Sie http://localhost:3000

3. Gehen Sie zu einem Shop

4. Klicken Sie auf das **Cloud-Upload Icon** oben rechts

5. Geben Sie ein:
   - **Shop Domain**: `graduprint-test.myshopify.com`
   - **Access Token**: `shpat_...` (Ihr Token)

6. Klicken Sie auf **"Verbindung testen"**

7. Wenn erfolgreich, klicken Sie auf **"Verbindung speichern"**

### Option B: Via API direkt

```bash
curl -X POST http://localhost:3000/api/shopify/save-connection \
  -H "Content-Type: application/json" \
  -d '{
    "shopId": "IHRE_SHOP_UUID",
    "shopDomain": "graduprint-test.myshopify.com",
    "accessToken": "shpat_IHR_TOKEN"
  }'
```

### Option C: Direkt in der Datenbank

```sql
-- Finden Sie zuerst Ihre Shop-ID
SELECT id, name FROM shops;

-- Dann fügen Sie die Verbindung hinzu:
INSERT INTO public.shopify_connections (shop_id, shop_domain, access_token)
VALUES (
  'IHRE_SHOP_UUID',  -- Ersetzen Sie mit Ihrer Shop-ID
  'graduprint-test.myshopify.com',
  'shpat_IHR_TOKEN'  -- Ersetzen Sie mit Ihrem Token
)
ON CONFLICT (shop_id) 
DO UPDATE SET 
  shop_domain = EXCLUDED.shop_domain,
  access_token = EXCLUDED.access_token,
  updated_at = now();
```

## Schritt 3: Produkt mit Bildern erstellen

### Option A: Via Test-Script

```bash
node scripts/test-create-product-with-images.js PRODUCT_ID graduprint-test.myshopify.com shpat_...
```

Das Script fragt nach fehlenden Parametern.

### Option B: Via curl

```bash
curl -X POST http://localhost:3000/api/shopify/create-product-with-images \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "IHRE_PRODUKT_UUID",
    "shopDomain": "graduprint-test.myshopify.com",
    "accessToken": "shpat_IHR_TOKEN"
  }'
```

### Option C: Via UI (wenn implementiert)

1. Gehen Sie zu einem Produkt
2. Klicken Sie auf **"Zu Shopify exportieren"**
3. Das Produkt wird mit allen Bildern und Farben erstellt

## Schritt 4: Prüfen Sie das Ergebnis

1. Gehen Sie zu Shopify Admin → **Products**
2. Suchen Sie nach Ihrem Produkt
3. Prüfen Sie:
   - ✅ Produktname und Beschreibung
   - ✅ Varianten (Größen/Farben)
   - ✅ Bilder für jede Farbe
   - ✅ Preise

## Troubleshooting

### "Shopify-Verbindung nicht gefunden"
- Stellen Sie sicher, dass die Verbindung in `shopify_connections` gespeichert ist
- Oder geben Sie `shopDomain` und `accessToken` direkt an

### "401 Unauthorized"
- Prüfen Sie, ob der Access Token korrekt ist
- Prüfen Sie, ob der Token die Berechtigung `write_products` hat
- Token muss mit `shpat_` beginnen

### "Produktbilder nicht gefunden"
- Stellen Sie sicher, dass Bilder in `product_images` vorhanden sind
- Bilder müssen eine `image_url` haben (öffentlich zugänglich)
- Prüfen Sie, ob die Bilder der richtigen Textilfarbe zugeordnet sind

### "Bilder werden nicht angezeigt"
- Shopify benötigt öffentlich zugängliche URLs
- Prüfen Sie, ob die Supabase Storage URLs öffentlich sind
- Prüfen Sie die Storage-Bucket-Policies

### "Varianten werden nicht korrekt erstellt"
- Prüfen Sie, ob Varianten in `product_variants` vorhanden sind
- Prüfen Sie, ob Varianten `active = true` haben
- Prüfen Sie die Varianten-Struktur (Größen vs. Farben)

## Nächste Schritte

Nach erfolgreichem Test können Sie:
1. Die UI erweitern, um Produkte direkt zu exportieren
2. Batch-Export für mehrere Produkte implementieren
3. Automatische Synchronisation einrichten
4. Bild-Upload zu Shopify optimieren (falls nötig)






