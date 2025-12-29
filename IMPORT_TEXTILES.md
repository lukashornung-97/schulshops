# Textilien aus CSV importieren

Dieses Dokument beschreibt, wie Sie Textilien aus der Probepaketdatenbank-CSV in das System importieren.

## Voraussetzungen

1. Die CSV-Datei `textildatenbank_rows.csv` muss im Projekt-Root liegen
2. Die Umgebungsvariablen müssen in `.env.local` gesetzt sein:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

## CSV-Struktur

Die CSV-Datei sollte folgende Spalten haben:
- `id`: UUID des Textils
- `produktname`: Name des Produkts
- `produktfarben`: JSON-Array mit verfügbaren Farben (z.B. `["Black", "White", "Navy"]`)
- `produktgrößen`: JSON-Array mit verfügbaren Größen (z.B. `["S", "M", "L", "XL"]`)
- `created_at`: Zeitstempel
- `herstellername`: Name des Herstellers/Marke

## Import durchführen

### Option 1: npm Script (empfohlen)

```bash
npm run import:textiles
```

### Option 2: Direkt mit Node.js

```bash
node scripts/import-textiles-from-csv.js
```

## Was passiert beim Import?

1. Die CSV-Datei wird eingelesen und geparst
2. Für jedes Textil wird geprüft, ob es bereits in der Datenbank existiert:
   - **Existiert bereits**: Der Eintrag wird aktualisiert (Name, Marke, Farben, Größen)
   - **Existiert nicht**: Ein neuer Eintrag wird erstellt
3. Die `base_price` wird auf 0 gesetzt (muss später manuell in der Admin-Verwaltung gesetzt werden)
4. Alle Textilien werden als `active = true` markiert

## Nach dem Import

Nach dem erfolgreichen Import sollten Sie:

1. Die Admin-Seite `/admin/textile-catalog` öffnen
2. Die importierten Textilien überprüfen
3. Die `base_price` für jedes Textil manuell setzen (falls bekannt)

## Fehlerbehebung

### "CSV-Datei nicht gefunden"
- Stellen Sie sicher, dass `textildatenbank_rows.csv` im Projekt-Root liegt

### "NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY müssen gesetzt sein"
- Erstellen Sie eine `.env.local` Datei mit diesen Werten
- Die `SUPABASE_SERVICE_ROLE_KEY` finden Sie in Ihrem Supabase Dashboard unter Settings > API

### "Fehler beim Parsen von JSON-Array"
- Überprüfen Sie die Formatierung der JSON-Arrays in der CSV
- Sie sollten im Format `["Wert1", "Wert2"]` vorliegen

## Datenbank-Migration

Falls die Datenbank-Struktur noch nicht angepasst wurde, führen Sie die Migration aus:

```sql
-- In Supabase SQL Editor ausführen:
ALTER TABLE public.textile_catalog 
  ALTER COLUMN base_price SET DEFAULT 0,
  ALTER COLUMN base_price DROP NOT NULL;
```

Oder führen Sie die Migration-Datei aus:
```bash
# In Supabase Dashboard > SQL Editor
# Datei: supabase/migrations/update_textile_catalog_for_csv.sql
```


