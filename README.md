# Schulshop Verwaltung

Eine moderne Verwaltungs-App für Schulshops mit Material Design und Supabase-Backend.

## Features

- 🏫 Schulen verwalten
- 🛍️ Shops pro Schule erstellen und verwalten
- 📦 Produkte mit Varianten verwalten
- 🛒 Bestellungen verwalten
- 👥 Rollenbasierte Zugriffskontrolle
- 📇 CRM: Ansprechpartner und Kontaktdaten verwalten

## Setup

### 1. Dependencies installieren

```bash
npm install
```

### 2. Supabase konfigurieren

1. Erstellen Sie ein Supabase-Projekt auf [supabase.com](https://supabase.com)
2. Kopieren Sie `.env.local.example` zu `.env.local`
3. Fügen Sie Ihre Supabase-URL und den Anon-Key ein:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Datenbank-Schema einrichten

Führen Sie die SQL-Scripts in Ihrem Supabase SQL Editor aus:

1. Hauptschema: `supabase/schema.sql`
2. CRM-Funktionalität: `supabase/school_contacts_with_primary.sql`

Siehe auch `CRM_SETUP.md` für detaillierte Anweisungen.

### 4. Entwicklungsserver starten

```bash
npm run dev
```

Die App läuft dann auf [http://localhost:3000](http://localhost:3000)

## Projektstruktur

```
schulshop/
├── app/                    # Next.js App Router Seiten
│   ├── page.tsx           # Startseite (Schulen-Übersicht)
│   ├── schools/           # Schulen-Verwaltung
│   ├── shops/             # Shops-Verwaltung
│   └── orders/            # Bestellungen
├── components/            # React-Komponenten
│   ├── AppBar.tsx         # Haupt-Navigationsleiste
│   └── ThemeProvider.tsx  # Material-UI Theme
├── lib/                   # Utilities
│   └── supabase.ts       # Supabase Client
├── types/                 # TypeScript Typen
│   └── database.ts       # Datenbank-Typen
└── supabase/             # Datenbank-Schema
    └── schema.sql        # SQL Schema
```

## Technologien

- **Next.js 14** - React Framework mit App Router
- **TypeScript** - Typsichere Entwicklung
- **Material-UI (MUI)** - Material Design Komponenten
- **Supabase** - Backend-as-a-Service (PostgreSQL, Auth, etc.)

## Shopify Integration

Die App unterstützt die Integration mit Shopify für den Export von Produkten:

- ✅ **OAuth-Flow** für sichere Authentifizierung
- ✅ **Produkterstellung** mit Bildern und Produktoptionen
- ✅ **Token-Verwaltung** in der Datenbank (`shopify_connections`)
- ⚠️ **Variantenerstellung**: Aktuell wird nur das Basisprodukt erstellt. Varianten müssen separat via `productVariantsBulkCreate` angelegt werden (in Arbeit)

Siehe `SHOPIFY_CREATE_PRODUCT_WITH_IMAGES.md` für Details zur Shopify-Integration.

## Nächste Schritte

- Authentifizierung implementieren
- **Shopify Variantenerstellung** via `productVariantsBulkCreate` implementieren
- Bestellungs-Details-Seite
- Rollenverwaltung
- Dashboard mit Statistiken

