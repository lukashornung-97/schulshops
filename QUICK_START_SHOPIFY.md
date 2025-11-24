# Quick Start: Shopify Credentials eintragen

## Ihre bereitgestellten Werte

- **Shop ID**: `YOUR_SHOP_ID_HERE`
- **Token**: `YOUR_SESSION_TOKEN_HERE`

## Schnelle Konfiguration

### Schritt 1: Shop Domain ermitteln

Der Shop-ID Wert ist eine Shop-ID. Sie benötigen die vollständige Domain im Format:
```
ihr-shop-name.myshopify.com
```

Diese finden Sie in Ihrem Shopify Admin unter:
- Settings → General → Store details → Store address

### Schritt 2: Admin API Access Token erstellen

Der Session Token ist für die Admin API nicht direkt verwendbar. Sie benötigen einen Access Token:

1. Gehen Sie zu Shopify Admin → **Settings** → **Apps and sales channels**
2. Klicken Sie auf **Develop apps** (oder erstellen Sie eine neue App)
3. Gehen Sie zu **API credentials**
4. Erstellen Sie einen **Admin API access token** mit folgenden Berechtigungen:
   - ✅ `write_products`
   - ✅ `read_products` (optional)
5. Kopieren Sie den Token (beginnt mit `shpat_`)

### Schritt 3: In der App konfigurieren

1. Öffnen Sie einen Shop in der App
2. Klicken Sie auf das **Cloud-Upload Icon** oben rechts
3. Geben Sie ein:
   - **Shop Domain**: `ihr-shop-name.myshopify.com`
   - **Access Token**: `shpat_...` (Ihr Admin API Token)

Die Credentials werden automatisch gespeichert und für zukünftige Exports verwendet.

## Alternative: Direkt in der Datenbank

Falls Sie die Verbindung direkt in der Datenbank speichern möchten:

```sql
-- Führen Sie zuerst das Schema aus: supabase/shopify_integration.sql
-- Dann fügen Sie die Verbindung hinzu:

INSERT INTO public.shopify_connections (shop_id, shop_domain, access_token)
VALUES (
  'IHRE_SHOP_UUID',  -- UUID aus der shops Tabelle
  'ihr-shop-name.myshopify.com',
  'shpat_IHR_ADMIN_API_TOKEN'
);
```

## Testen

Nach der Konfiguration:
1. Gehen Sie zu einem Produkt
2. Klicken Sie auf das Cloud-Upload Icon neben dem Produkt
3. Das Produkt wird zu Shopify exportiert

