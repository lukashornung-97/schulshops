# Redirect URI Fehler beheben

## Problem
```
Oauth error invalid_request: The redirect_uri is not whitelisted
```

## Lösung

Die Redirect URI muss in der Shopify App-Konfiguration hinterlegt sein.

### Option 1: Via Shopify Partner Dashboard (Empfohlen)

1. Gehen Sie zu https://partners.shopify.com
2. Wählen Sie Ihre App aus (Client ID: `4c1c59dff71bd75e8ac4c443f3dc9639`)
3. Gehen Sie zu **App setup** → **App URL**
4. Fügen Sie die Redirect URI hinzu:
   ```
   http://localhost:3000/api/shopify/oauth/callback
   ```
5. Für Produktion auch hinzufügen:
   ```
   https://ihre-domain.com/api/shopify/oauth/callback
   ```
6. **Speichern**

### Option 2: Via Shopify CLI (schulshop-beta App)

Wenn Sie die `schulshop-beta` App verwenden:

1. Gehen Sie ins Verzeichnis:
   ```bash
   cd schulshop-beta
   ```

2. Öffnen Sie `shopify.app.toml` und fügen Sie die Redirect URI hinzu:
   ```toml
   [auth]
   redirect_urls = [
     "https://example.com/api/auth",
     "http://localhost:3000/api/shopify/oauth/callback"
   ]
   ```

3. Deployen Sie die Änderungen:
   ```bash
   shopify app deploy
   ```

### Option 3: Redirect URI in .env.local setzen

Falls Sie eine andere Redirect URI verwenden möchten:

1. Fügen Sie zu `.env.local` hinzu:
   ```env
   SHOPIFY_REDIRECT_URI=http://localhost:3000/api/shopify/oauth/callback
   ```

2. Stellen Sie sicher, dass diese URI auch in Shopify Partner Dashboard hinterlegt ist

## Aktuelle Redirect URI

Die App verwendet standardmäßig:
```
http://localhost:3000/api/shopify/oauth/callback
```

Diese muss **exakt** in der Shopify App-Konfiguration hinterlegt sein (inklusive `http://` und ohne trailing slash).

## Testen

Nach dem Hinzufügen der Redirect URI:

1. Warten Sie 1-2 Minuten (Shopify braucht Zeit zum Aktualisieren)
2. Versuchen Sie den OAuth Flow erneut
3. Der Fehler sollte verschwunden sein

