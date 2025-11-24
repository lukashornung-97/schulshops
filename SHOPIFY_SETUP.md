# Shopify Integration Setup

## Ihre Shopify-Credentials

Sie benötigen folgende Werte:
- Shop ID: `YOUR_SHOP_ID_HERE`
- Session Token: `YOUR_SESSION_TOKEN_HERE`

**Wichtig**: Der Session Token (`shpss_`) ist für die Admin API nicht direkt verwendbar. Sie benötigen einen Admin API Access Token (beginnt mit `shpat_`).

## Konfiguration

### Option 1: Via UI (Empfohlen)
1. Gehen Sie zu einem Shop in der App
2. Klicken Sie auf das Cloud-Upload Icon oben rechts
3. Geben Sie ein:
   - **Shop Domain**: Falls der erste Wert eine Shop-ID ist, benötigen Sie die vollständige Domain (z.B. `ihr-shop.myshopify.com`)
   - **Access Token**: `YOUR_ADMIN_API_TOKEN_HERE` (beginnt mit `shpat_`)

### Option 2: Direkt in der Datenbank
Falls Sie die Shopify-Verbindung direkt in der Datenbank speichern möchten, führen Sie folgendes SQL aus:

```sql
-- Ersetzen Sie SHOP_ID mit der ID Ihres Shops
INSERT INTO public.shopify_connections (shop_id, shop_domain, access_token)
VALUES (
  'SHOP_ID',  -- Ihre Shop-ID aus der shops Tabelle
  'ihr-shop.myshopify.com',  -- Ihre vollständige Shopify Domain
  'YOUR_ADMIN_API_TOKEN_HERE'
);
```

## Wichtige Hinweise

1. **Shop Domain Format**: 
   - Muss im Format `shop-name.myshopify.com` sein
   - Die Shop-ID sieht nach einem Hash aus
   - Sie benötigen die vollständige Domain

2. **Access Token**:
   - Der Token `shpss_...` ist ein Session Token
   - Für die Admin API benötigen Sie normalerweise einen Token mit `shpat_` Präfix
   - Stellen Sie sicher, dass der Token die Berechtigung `write_products` hat

3. **Token-Berechtigungen**:
   - Gehen Sie zu Shopify Admin → Settings → Apps and sales channels
   - Entwickeln Sie eine App oder verwenden Sie eine bestehende
   - Stellen Sie sicher, dass der Token `write_products` Berechtigung hat

## Testen der Verbindung

Nach der Konfiguration können Sie:
1. Zu einem Produkt gehen
2. Auf das Cloud-Upload Icon klicken
3. Das Produkt sollte zu Shopify exportiert werden

