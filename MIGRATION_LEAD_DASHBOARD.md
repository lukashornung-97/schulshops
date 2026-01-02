# Migration: Lead Dashboard Tabellen erstellen

## Fehler beheben

Wenn Sie den Fehler erhalten:
```
ERROR: 42P01: relation "public.textile_catalog" does not exist
```

bedeutet das, dass die Tabellen für das Lead-Dashboard noch nicht erstellt wurden.

## Lösung: Migration in Supabase ausführen

### Schritt 1: Supabase Dashboard öffnen

1. Öffnen Sie Ihr Supabase Dashboard: https://app.supabase.com
2. Wählen Sie Ihr Projekt aus
3. Gehen Sie zu **SQL Editor** (im linken Menü)

### Schritt 2: Migration ausführen

1. Klicken Sie auf **New Query**
2. Öffnen Sie die Datei `supabase/migrations/lead_dashboard.sql` in Ihrem Editor
3. Kopieren Sie den **gesamten Inhalt** der Datei
4. Fügen Sie ihn in den SQL Editor ein
5. Klicken Sie auf **Run** (oder drücken Sie `Ctrl+Enter` / `Cmd+Enter`)

### Schritt 3: Update-Migration ausführen (optional)

Falls die Tabelle bereits existiert, aber `base_price` noch NOT NULL ist:

1. Erstellen Sie eine neue Query im SQL Editor
2. Öffnen Sie die Datei `supabase/migrations/update_textile_catalog_for_csv.sql`
3. Kopieren Sie den Inhalt und führen Sie ihn aus

## Was wird erstellt?

Die Migration erstellt folgende Tabellen:

1. **textile_catalog** - Katalog verfügbarer Textilien
2. **print_costs** - Druckkosten pro Position
3. **lead_configurations** - Konfigurationen für Lead-Schulen

Außerdem werden:
- Indizes für Performance erstellt
- RLS Policies für Sicherheit eingerichtet
- Trigger für automatische `updated_at` Updates erstellt

## Nach der Migration

Nach erfolgreicher Migration können Sie:

1. Textilien aus CSV importieren: `npm run import:textiles`
2. Die Admin-Seiten verwenden:
   - `/admin/textile-catalog` - Textilien verwalten
   - `/admin/print-costs` - Druckkosten verwalten
3. Das Lead-Dashboard für Schulen mit Status "lead" verwenden

## Troubleshooting

### "relation already exists"
- Die Tabelle existiert bereits. Das ist in Ordnung, die Migration verwendet `IF NOT EXISTS` und sollte trotzdem funktionieren.

### "permission denied"
- Stellen Sie sicher, dass Sie als Datenbank-Administrator eingeloggt sind oder die notwendigen Berechtigungen haben.

### "column base_price does not exist"
- Führen Sie die Update-Migration `update_textile_catalog_for_csv.sql` aus.



