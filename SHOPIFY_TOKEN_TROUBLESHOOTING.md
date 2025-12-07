# Shopify 401 Unauthorized Fehler beheben

Wenn Sie den Fehler `401 Unauthorized - Invalid API key or access token` erhalten, liegt das Problem meist am Access Token.

## Häufige Ursachen

### 1. Token wurde falsch kopiert

**Problem**: Beim Kopieren wurden Leerzeichen oder Zeilenumbrüche mitkopiert.

**Lösung**:
- Kopieren Sie den Token erneut aus Shopify
- Stellen Sie sicher, dass keine Leerzeichen am Anfang oder Ende sind
- Prüfen Sie, ob der Token komplett kopiert wurde (Shopify Tokens sind lang!)

### 2. Falscher Token-Typ

**Problem**: Sie verwenden einen Session Token (`shpss_`) statt Admin API Token (`shpat_`).

**Lösung**:
- Verwenden Sie einen **Admin API Access Token** (beginnt mit `shpat_`)
- Session Tokens funktionieren nicht für die Admin API

### 3. Token wurde nicht richtig installiert

**Problem**: Die App wurde nicht installiert oder der Token wurde nicht aktiviert.

**Lösung**:
1. Gehen Sie zu Shopify Admin → **Settings** → **Apps and sales channels**
2. Finden Sie Ihre App
3. Klicken Sie auf **Install app** (falls noch nicht installiert)
4. Gehen Sie zu **API credentials**
5. Erstellen Sie einen neuen **Admin API access token**
6. Kopieren Sie den Token **sofort** (er wird nur einmal angezeigt!)

### 4. Token hat nicht die richtigen Berechtigungen

**Problem**: Der Token hat nicht die erforderlichen Scopes.

**Lösung**:
1. Gehen Sie zu Ihrer App → **API credentials**
2. Prüfen Sie die **Admin API scopes**
3. Stellen Sie sicher, dass folgende Scopes aktiviert sind:
   - ✅ `write_products` (erforderlich)
   - ✅ `read_products` (empfohlen)

### 5. Token ist abgelaufen

**Problem**: Der Token wurde widerrufen oder ist abgelaufen.

**Lösung**:
- Erstellen Sie einen neuen Token in Shopify
- Speichern Sie den neuen Token in der App

## Schritt-für-Schritt: Neuen Token erstellen

### Für graduprint-test.myshopify.com

1. **Gehen Sie zu Shopify Admin**
   ```
   https://graduprint-test.myshopify.com/admin
   ```

2. **Öffnen Sie Apps**
   - Klicken Sie auf **Settings** (Einstellungen)
   - Klicken Sie auf **Apps and sales channels**

3. **Erstellen Sie eine App**
   - Klicken Sie auf **Develop apps** (Apps entwickeln)
   - Klicken Sie auf **Create an app**
   - Geben Sie einen Namen ein (z.B. "Schulshop Integration")
   - Klicken Sie auf **Create app**

4. **Konfigurieren Sie API-Berechtigungen**
   - Klicken Sie auf **Configure Admin API scopes**
   - Aktivieren Sie:
     - ✅ `write_products`
     - ✅ `read_products` (optional, aber empfohlen)
   - Klicken Sie auf **Save**

5. **Installieren Sie die App**
   - Gehen Sie zurück zur App-Übersicht
   - Klicken Sie auf **Install app**
   - Bestätigen Sie die Installation

6. **Erstellen Sie den Access Token**
   - Gehen Sie zum Tab **API credentials**
   - Scrollen Sie zu **Admin API access token**
   - Klicken Sie auf **Create Admin API access token**
   - Kopieren Sie den Token **sofort** (er wird nur einmal angezeigt!)
   - Der Token beginnt mit `shpat_` und ist sehr lang

7. **Speichern Sie den Token**
   - Kopieren Sie den Token komplett (ohne Leerzeichen)
   - Fügen Sie ihn in die App ein
   - Klicken Sie auf **"Verbindung testen"**

## Token validieren

### Token-Format prüfen

Ein gültiger Shopify Admin API Token:
- Beginnt mit `shpat_`
- Ist mindestens 32 Zeichen lang
- Enthält keine Leerzeichen
- Beispiel-Format: `shpat_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX` (X = alphanumerische Zeichen)

### Token testen

```bash
curl -X POST https://graduprint-test.myshopify.com/admin/api/2025-10/graphql.json \
  -H "Content-Type: application/json" \
  -H "X-Shopify-Access-Token: shpat_IHR_TOKEN" \
  -d '{
    "query": "{ shop { name } }"
  }'
```

Wenn erfolgreich, erhalten Sie:
```json
{
  "data": {
    "shop": {
      "name": "Ihr Shop Name"
    }
  }
}
```

Wenn fehlgeschlagen, erhalten Sie:
```json
{
  "errors": "[API] Invalid API key or access token"
}
```

## Debugging

### Prüfen Sie den gespeicherten Token

1. **In der Datenbank**:
   ```sql
   SELECT shop_domain, 
          LEFT(access_token, 15) as token_prefix,
          LENGTH(access_token) as token_length
   FROM shopify_connections
   WHERE shop_id = 'IHRE_SHOP_ID';
   ```

2. **In der Browser-Konsole**:
   ```javascript
   const saved = localStorage.getItem('shopify_credentials');
   console.log(JSON.parse(saved));
   ```

### Häufige Fehler beim Kopieren

- ❌ `shpat_ abc123...` (Leerzeichen nach `shpat_`)
- ❌ `shpat_abc123...\n` (Zeilenumbruch am Ende)
- ❌ `shpat_abc123` (Token zu kurz, unvollständig kopiert)
- ✅ `shpat_abc123def456...` (korrekt)

## Noch immer Probleme?

1. **Prüfen Sie die Shop Domain**
   - Format: `graduprint-test.myshopify.com`
   - Nicht: `https://graduprint-test.myshopify.com`
   - Nicht: `graduprint-test`

2. **Erstellen Sie einen komplett neuen Token**
   - Löschen Sie den alten Token in Shopify
   - Erstellen Sie einen neuen Token
   - Verwenden Sie den neuen Token

3. **Prüfen Sie die Shopify API Version**
   - Aktuell verwenden wir: `2025-10`
   - Stellen Sie sicher, dass Ihr Shop diese Version unterstützt

4. **Kontaktieren Sie Shopify Support**
   - Falls nichts hilft, kontaktieren Sie Shopify Support
   - Geben Sie die Shop Domain und den Fehler an

