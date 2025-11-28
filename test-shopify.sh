#!/bin/bash

# Shopify Verbindung Test Script
# Verwendung: ./test-shopify.sh SHOP_DOMAIN ACCESS_TOKEN

SHOP_DOMAIN=${1:-"ihr-shop.myshopify.com"}
ACCESS_TOKEN=${2:-""}

if [ -z "$ACCESS_TOKEN" ]; then
  echo "❌ Fehler: Access Token fehlt"
  echo ""
  echo "Verwendung:"
  echo "  ./test-shopify.sh SHOP_DOMAIN ACCESS_TOKEN"
  echo ""
  echo "Beispiel:"
  echo "  ./test-shopify.sh mein-shop.myshopify.com shpat_abc123..."
  exit 1
fi

echo "🔍 Teste Shopify Verbindung..."
echo "Shop Domain: $SHOP_DOMAIN"
echo "Token beginnt mit: ${ACCESS_TOKEN:0:10}..."
echo ""

response=$(curl -s -X POST http://localhost:3000/api/shopify/test-connection \
  -H "Content-Type: application/json" \
  -d "{
    \"shopDomain\": \"$SHOP_DOMAIN\",
    \"accessToken\": \"$ACCESS_TOKEN\"
  }")

echo "Response:"
echo "$response" | jq '.' 2>/dev/null || echo "$response"

success=$(echo "$response" | grep -o '"success":true' || echo "")

if [ -n "$success" ]; then
  echo ""
  echo "✅ Verbindung erfolgreich!"
  shop_name=$(echo "$response" | grep -o '"name":"[^"]*"' | cut -d'"' -f4)
  if [ -n "$shop_name" ]; then
    echo "Shop Name: $shop_name"
  fi
else
  echo ""
  echo "❌ Verbindung fehlgeschlagen"
  echo ""
  echo "Mögliche Ursachen:"
  echo "1. Access Token ist falsch oder abgelaufen"
  echo "2. Token beginnt nicht mit 'shpat_' (Admin API Token)"
  echo "3. Shop Domain ist falsch formatiert"
  echo "4. Token hat nicht die Berechtigung 'write_products'"
fi


