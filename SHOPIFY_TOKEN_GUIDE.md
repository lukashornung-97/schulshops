# Shopify Admin API Token erstellen - Schritt für Schritt

## Problem: 401 Unauthorized

Wenn Sie einen 401 Fehler erhalten, liegt das meist daran, dass Sie keinen gültigen Admin API Access Token haben.

## Lösung: Admin API Access Token erstellen

### Schritt 1: Custom App erstellen

1. Gehen Sie zu Ihrem **Shopify Admin**
2. Navigieren Sie zu **Settings** → **Apps and sales channels**
3. Klicken Sie auf **Develop apps** (oben rechts)
4. Klicken Sie auf **Create an app**
5. Geben Sie einen App-Namen ein (z.B. "Schulshop Integration")
6. Klicken Sie auf **Create app**

### Schritt 2: API Credentials konfigurieren

1. In der App-Übersicht klicken Sie auf **API credentials**
2. Scrollen Sie zu **Admin API access token**
3. Klicken Sie auf **Configure admin API scopes**

### Schritt 3: Berechtigungen aktivieren

Aktivieren Sie mindestens folgende Scopes:
- ✅ **read_products** - Produkte lesen
- ✅ **write_products** - Produkte erstellen/bearbeiten

Optional können Sie auch weitere Berechtigungen aktivieren, je nach Bedarf.

### Schritt 4: App installieren

1. Klicken Sie auf **Install app** (oben rechts)
2. Bestätigen Sie die Installation
3. **Wichtig**: Nach der Installation wird der Access Token angezeigt

### Schritt 5: Access Token kopieren

1. Der Token wird nach der Installation angezeigt
2. **Kopieren Sie den Token** - er beginnt mit `shpat_`
3. **Wichtig**: Speichern Sie den Token sicher, er wird nur einmal angezeigt!

## Token in der App verwenden

1. Öffnen Sie einen Shop in der Schulshop-App
2. Klicken Sie auf das **Cloud-Upload Icon** oben rechts
3. Geben Sie ein:
   - **Shop Domain**: `ihr-shop-name.myshopify.com` (Ihre Shopify-Domain)
   - **Access Token**: `shpat_...` (Der kopierte Token)
4. Klicken Sie auf **Verbindung testen**
5. Bei erfolgreichem Test werden die Credentials gespeichert

## Wichtige Hinweise

### Token-Format
- ✅ **Richtig**: `shpat_abc123def456...` (Admin API Token)
- ❌ **Falsch**: `shpss_...` (Session Token - funktioniert nicht für Admin API)

### Shop Domain Format
- ✅ **Richtig**: `mein-shop.myshopify.com`
- ❌ **Falsch**: `d164f6d8409d09a0c8e84659edd49104` (Shop-ID, nicht Domain)

### Berechtigungen
- Der Token benötigt mindestens `read_products` Scope
- Für Produkterstellung benötigen Sie `write_products` Scope
- Ohne diese Berechtigungen erhalten Sie 401 oder 403 Fehler

## Token rotieren/erneuern

Falls Sie einen neuen Token benötigen:
1. Gehen Sie zu **Settings** → **Apps and sales channels**
2. Finden Sie Ihre Custom App
3. Klicken Sie auf **Uninstall**
4. Erstellen Sie die App neu (siehe Schritt 1-5)

**Achtung**: Beim Neuerstellen erhalten Sie einen neuen Token. Der alte Token funktioniert dann nicht mehr.

## Troubleshooting

### 401 Unauthorized
- ✅ Token beginnt mit `shpat_`?
- ✅ Shop Domain im richtigen Format?
- ✅ Token nicht abgelaufen?
- ✅ App installiert?

### 403 Forbidden
- ✅ Scopes aktiviert (`read_products`, `write_products`)?
- ✅ Benutzer hat Berechtigung zum Erstellen von Apps?

### Domain-Fehler
- ✅ Format: `shop-name.myshopify.com`
- ✅ Kein `https://` davor
- ✅ Kein `/` am Ende

## Weitere Hilfe

- [Shopify Custom Apps Dokumentation](https://help.shopify.com/en/manual/apps/custom-apps)
- [Shopify Admin API Dokumentation](https://shopify.dev/docs/api/admin-graphql)

