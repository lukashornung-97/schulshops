# Shopify Verbindung testen

## Option 1: Via UI (Empfohlen)

1. Öffnen Sie http://localhost:3000 in Ihrem Browser
2. Gehen Sie zu einem Shop (oder erstellen Sie einen)
3. Klicken Sie auf das **Cloud-Upload Icon** oben rechts
4. Geben Sie ein:
   - **Shop Domain**: Ihre Shopify-Domain (z.B. `ihr-shop.myshopify.com`)
   - **Access Token**: Ihr Shopify Admin API Token (beginnt mit `shpat_`)
5. Klicken Sie auf **"Verbindung testen"**
6. Sie sehen sofort, ob die Verbindung erfolgreich war

## Option 2: Via API direkt testen

Sie können die Verbindung auch direkt via API testen:

```bash
curl -X POST http://localhost:3000/api/shopify/test-connection \
  -H "Content-Type: application/json" \
  -d '{
    "shopDomain": "ihr-shop.myshopify.com",
    "accessToken": "shpat_..."
  }'
```

## Option 3: Shopify App im schulshop-beta Verzeichnis

Falls Sie die Shopify App im `schulshop-beta` Verzeichnis verwenden möchten:

1. Gehen Sie ins Verzeichnis:
   ```bash
   cd schulshop-beta
   ```

2. Starten Sie die Shopify App:
   ```bash
   npm run dev
   ```

3. Die Shopify CLI wird Sie durch den Setup-Prozess führen

## Credentials aus schulshop-beta verwenden

Die Shopify App im `schulshop-beta` Verzeichnis hat:
- **Client ID**: `4c1c59dff71bd75e8ac4c443f3dc9639`
- **Scopes**: `write_products`

Sie können diese Credentials in Ihrer `.env.local` verwenden:

```env
SHOPIFY_CLIENT_ID=4c1c59dff71bd75e8ac4c443f3dc9639
SHOPIFY_CLIENT_SECRET=ihr_client_secret
SHOPIFY_REDIRECT_URI=http://localhost:3000/api/shopify/oauth/callback
```

Dann können Sie den OAuth Flow in der UI verwenden.

## Troubleshooting

### 401 Unauthorized
- Stellen Sie sicher, dass Sie einen Admin API Token verwenden (beginnt mit `shpat_`)
- Prüfen Sie, ob der Token die Berechtigung `write_products` hat

### Domain-Fehler
- Format: `shop-name.myshopify.com` (ohne `https://`)
- Nicht: Shop-ID oder andere Formate

### OAuth-Fehler
- Stellen Sie sicher, dass `SHOPIFY_CLIENT_ID` und `SHOPIFY_CLIENT_SECRET` in `.env.local` gesetzt sind
- Prüfen Sie die Redirect URI in Shopify Partner Dashboard


