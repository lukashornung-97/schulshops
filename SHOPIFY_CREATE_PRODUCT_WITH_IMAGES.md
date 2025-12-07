# Shopify Produkt mit Bildern und Farben erstellen

Diese Route erstellt ein Produkt in Shopify mit allen zugehörigen Bildern (Druckvorschauen) und Farbvarianten.

## Route

`POST /api/shopify/create-product-with-images`

## Verwendung

### Option 1: Mit Shopify-Verbindung in der Datenbank

Wenn Sie bereits eine Shopify-Verbindung für den Shop konfiguriert haben (über die UI oder direkt in der Datenbank), können Sie einfach die `productId` angeben:

```bash
curl -X POST http://localhost:3000/api/shopify/create-product-with-images \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "IHRE_PRODUKT_UUID"
  }'
```

### Option 2: Mit expliziten Credentials

Sie können auch `shopDomain` und `accessToken` direkt angeben:

```bash
curl -X POST http://localhost:3000/api/shopify/create-product-with-images \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "IHRE_PRODUKT_UUID",
    "shopDomain": "graduprint-test.myshopify.com",
    "accessToken": "shpat_..."
  }'
```

## Beispiel für graduprint-test.myshopify.com

```bash
curl -X POST http://localhost:3000/api/shopify/create-product-with-images \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "IHRE_PRODUKT_UUID",
    "shopDomain": "graduprint-test.myshopify.com",
    "accessToken": "IHR_SHOPIFY_ACCESS_TOKEN"
  }'
```

## Was die Route macht

1. **Lädt Produktdaten** aus der Datenbank
2. **Lädt Varianten** (Größen, Farben) des Produkts
3. **Lädt Produktbilder** nach Textilfarben organisiert
4. **Erstellt Produkt in Shopify** mit:
   - Produktname und Beschreibung
   - Varianten (Größen und/oder Farben)
   - Produktbilder (Druckvorschauen) für jede Farbe
5. **Speichert Mapping** zwischen lokalem Produkt und Shopify-Produkt

## Voraussetzungen

- Produkt muss in der Datenbank existieren
- Produktbilder müssen in der `product_images` Tabelle vorhanden sein
- Bilder müssen eine `image_url` haben (öffentlich zugängliche URL)
- Shopify-Verbindung muss konfiguriert sein ODER `shopDomain` und `accessToken` müssen angegeben werden

## Response

### Erfolg

```json
{
  "success": true,
  "product": {
    "id": "gid://shopify/Product/123456789",
    "title": "Produktname"
  },
  "message": "Produkt \"Produktname\" wurde erfolgreich zu Shopify exportiert"
}
```

### Fehler

```json
{
  "error": "Fehlermeldung",
  "userErrors": [
    {
      "field": ["field"],
      "message": "Detaillierte Fehlermeldung"
    }
  ]
}
```

## Bilder und Farben

Die Route organisiert Bilder nach Textilfarben (`textile_color_name` in der `product_images` Tabelle):

- **Jede Farbe** bekommt ihre eigenen Bilder
- **Bildtypen**: `front`, `back`, `side`
- **Nur Frontend-Bilder** werden verwendet (`image_url`), nicht Druckdateien (`print_file_url`)

## Varianten

⚠️ **Aktueller Status**: Die Route erstellt aktuell **nur das Basisprodukt** mit Produktoptionen (Größe, Farbe). Shopify legt automatisch eine Standard-Variante an.

**In Arbeit**: Variantenerstellung via `productVariantsBulkCreate` Mutation
- Die Shopify Admin GraphQL API unterstützt in `ProductInput` kein `variants` Feld mehr
- Varianten müssen separat nach der Produkterstellung angelegt werden
- Geplante Implementierung:
  - Nach erfolgreicher Produkterstellung
  - Alle Kombinationen aus Größen- und Farbvarianten erstellen
  - Preise korrekt zuordnen (base_price + additional_price)
  - SKUs setzen falls vorhanden

**Basis für Variantenerstellung**:
- **Größen-Varianten**: Varianten ohne `color_name`
- **Farb-Varianten**: Varianten mit `color_name`
- **Kombinationen**: Wenn beide vorhanden sind, werden alle Kombinationen erstellt

## Troubleshooting

### "Shopify-Verbindung nicht gefunden"
- Stellen Sie sicher, dass eine Verbindung in `shopify_connections` existiert
- Oder geben Sie `shopDomain` und `accessToken` direkt an

### "Produktbilder nicht gefunden"
- Stellen Sie sicher, dass Bilder in `product_images` vorhanden sind
- Bilder müssen eine `image_url` haben (öffentlich zugänglich)

### "Shopify API Error"
- Prüfen Sie, ob der Access Token gültig ist
- Prüfen Sie, ob der Token die Berechtigung `write_products` hat
- Prüfen Sie, ob die Shop Domain korrekt ist (Format: `shop-name.myshopify.com`)

