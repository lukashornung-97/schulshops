# Shopify OAuth mit Client ID und Secret

## Sie haben Client ID und Secret - das ist gut!

Mit Client ID und Secret können Sie einen **OAuth-Flow** implementieren, um einen Access Token zu erhalten.

## Setup

### 1. Umgebungsvariablen konfigurieren

Fügen Sie zu Ihrer `.env.local` Datei hinzu:

```env
SHOPIFY_CLIENT_ID=ihre_client_id
SHOPIFY_CLIENT_SECRET=ihr_client_secret
SHOPIFY_REDIRECT_URI=http://localhost:3000/api/shopify/oauth/callback
```

**Für Produktion** ändern Sie die Redirect URI zu Ihrer Produktions-URL:
```env
SHOPIFY_REDIRECT_URI=https://ihre-domain.com/api/shopify/oauth/callback
```

### 2. Redirect URI in Shopify App konfigurieren

1. Gehen Sie zu Ihrem **Shopify Partner Dashboard**
2. Wählen Sie Ihre App aus
3. Gehen Sie zu **App setup** → **App URL**
4. Fügen Sie die Redirect URI hinzu:
   - Development: `http://localhost:3000/api/shopify/oauth/callback`
   - Production: `https://ihre-domain.com/api/shopify/oauth/callback`

## Verwendung

### Option 1: OAuth Flow (Empfohlen mit Client ID/Secret)

1. Öffnen Sie einen Shop in der App
2. Klicken Sie auf das **Cloud-Upload Icon** oben rechts
3. Geben Sie die **Shop Domain** ein (z.B. `ihr-shop.myshopify.com`)
4. Klicken Sie auf **"OAuth Flow starten"**
5. Sie werden zu Shopify weitergeleitet zur Autorisierung
6. Nach der Autorisierung erhalten Sie automatisch einen Access Token
7. Der Token wird gespeichert und kann verwendet werden

### Option 2: Access Token direkt eingeben

Falls Sie bereits einen Access Token haben:
1. Geben Sie Shop Domain und Access Token direkt ein
2. Klicken Sie auf **"Verbindung testen"**

## Wie funktioniert OAuth?

1. **Authorization Request**: App generiert URL mit Client ID
2. **User Authorization**: Benutzer autorisiert die App in Shopify
3. **Redirect**: Shopify leitet zurück mit Authorization Code
4. **Token Exchange**: App tauscht Code gegen Access Token (mit Client Secret)
5. **API Access**: Access Token wird für API-Aufrufe verwendet

## Vorteile von OAuth

- ✅ Sicher: Client Secret bleibt auf dem Server
- ✅ Flexibel: Benutzer können die App autorisieren/entziehen
- ✅ Multi-Store: Unterstützt mehrere Shops
- ✅ Standard: Industriestandard für API-Authentifizierung

## Troubleshooting

### "OAuth nicht konfiguriert"
- Stellen Sie sicher, dass `SHOPIFY_CLIENT_ID` und `SHOPIFY_CLIENT_SECRET` in `.env.local` gesetzt sind
- Starten Sie den Server neu nach Änderungen an `.env.local`

### Redirect URI Mismatch
- Die Redirect URI in `.env.local` muss exakt mit der in Shopify konfigurierten übereinstimmen
- Prüfen Sie Groß-/Kleinschreibung und Trailing Slashes

### 401 Fehler nach OAuth
- Der Access Token sollte automatisch gespeichert werden
- Prüfen Sie, ob der Token korrekt übertragen wurde

## Alternative: Custom App im Admin (Einfacher)

Falls OAuth zu komplex ist, können Sie auch:
1. Eine **Custom App direkt im Shopify Admin** erstellen
2. Diese gibt Ihnen sofort einen Access Token
3. Kein OAuth-Flow nötig

Siehe: `SHOPIFY_TOKEN_GUIDE.md`


