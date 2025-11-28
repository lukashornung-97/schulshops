# Shopify OAuth vs. Direct Access Token

## Unterschied: Client ID/Secret vs. Access Token

### Client ID & Secret (OAuth Flow)
- **Verwendung**: Für OAuth-Authentifizierung
- **Zweck**: Ermöglicht es Benutzern, Ihre App zu autorisieren
- **Ergebnis**: Nach OAuth-Flow erhalten Sie einen **Access Token**

### Access Token (Direkte API-Aufrufe)
- **Verwendung**: Für direkte API-Aufrufe
- **Zweck**: Authentifizierung bei Shopify API
- **Format**: Beginnt mit `shpat_` (Admin API) oder `shpatat_` (Custom App)

## Option 1: Access Token direkt verwenden (Einfacher)

Wenn Sie eine **Custom App im Shopify Admin** erstellt haben:

1. Gehen Sie zu **Shopify Admin** → **Settings** → **Apps and sales channels**
2. Finden Sie Ihre App
3. Klicken Sie auf die App
4. Gehen Sie zu **API credentials**
5. Unter **Admin API access token** sollte der Token angezeigt werden
6. **Kopieren Sie diesen Token** (beginnt mit `shpat_`)

**Dieser Token kann direkt verwendet werden** - keine OAuth nötig!

## Option 2: OAuth Flow implementieren (Komplexer)

Wenn Sie eine App über das **Partner Dashboard** erstellt haben, benötigen Sie OAuth:

### OAuth Flow Schritte:

1. **Authorization URL generieren**:
   ```
   https://{shop}.myshopify.com/admin/oauth/authorize?
     client_id={CLIENT_ID}&
     scope=read_products,write_products&
     redirect_uri={REDIRECT_URI}
   ```

2. **Benutzer autorisiert** → Redirect mit `code` Parameter

3. **Access Token austauschen**:
   ```bash
   POST https://{shop}.myshopify.com/admin/oauth/access_token
   {
     "client_id": "{CLIENT_ID}",
     "client_secret": "{CLIENT_SECRET}",
     "code": "{CODE_FROM_REDIRECT}"
   }
   ```

4. **Response enthält Access Token**:
   ```json
   {
     "access_token": "shpat_...",
     "scope": "read_products,write_products"
   }
   ```

## Empfehlung für Ihre Situation

Da Sie bereits Client ID und Secret haben, haben Sie wahrscheinlich eine App über das Partner Dashboard erstellt.

**Einfachste Lösung**: 
- Erstellen Sie eine **Custom App direkt im Shopify Admin** (kein Partner Dashboard nötig)
- Diese gibt Ihnen sofort einen Access Token
- Kein OAuth-Flow nötig

**Alternative**: 
- Implementieren Sie einen OAuth-Flow in der App
- Benutzer werden zu Shopify weitergeleitet zur Autorisierung
- Nach Autorisierung erhalten Sie einen Access Token

## Was möchten Sie tun?

1. **Custom App im Admin erstellen** (empfohlen - einfacher)
   - Siehe: `SHOPIFY_TOKEN_GUIDE.md`

2. **OAuth Flow implementieren** (komplexer, aber flexibler)
   - Benötigt Redirect-URL
   - Benötigt Backend für Token-Austausch
   - Ermöglicht Multi-Store-Support


