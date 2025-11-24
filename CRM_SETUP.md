# CRM Setup - Ansprechpartner und Kontaktdaten

## Problem: Tabelle fehlt

Wenn Sie den Fehler `Could not find the table 'public.school_contacts' in the schema cache` erhalten, müssen Sie die Tabelle in Ihrer Supabase-Datenbank erstellen.

## Lösung: SQL-Script ausführen

### Option 1: Über die Supabase Web-Konsole (Empfohlen)

1. Öffnen Sie Ihr Supabase Dashboard: https://app.supabase.com
2. Wählen Sie Ihr Projekt aus
3. Gehen Sie zu **SQL Editor** (im linken Menü)
4. Klicken Sie auf **New Query**
5. Kopieren Sie den Inhalt der Datei `supabase/school_contacts.sql`
6. Fügen Sie ihn in den SQL Editor ein
7. Klicken Sie auf **Run** (oder drücken Sie `Ctrl+Enter` / `Cmd+Enter`)

### Option 2: Über die Supabase CLI

```bash
# Falls Sie die Supabase CLI installiert haben
supabase db execute -f supabase/school_contacts.sql
```

### Option 3: Direktes SQL (falls Sie direkten Datenbankzugriff haben)

Führen Sie das SQL-Script direkt in Ihrer PostgreSQL-Datenbank aus.

## Was wird erstellt?

- **Tabelle**: `public.school_contacts` - Speichert Ansprechpartner und Kontaktdaten
- **Index**: Für schnelle Abfragen nach `school_id`
- **Trigger**: Aktualisiert automatisch das `updated_at` Feld
- **RLS Policies**: Row Level Security Policies für sicheren Zugriff

## Nach dem Ausführen

Nachdem Sie das Script ausgeführt haben, sollte die CRM-Funktionalität in der Schulansicht funktionieren:

1. Gehen Sie zu einer Schule: `/schools/[id]`
2. Klicken Sie auf den Tab **CRM**
3. Klicken Sie auf das **+** Icon, um einen neuen Kontakt hinzuzufügen

## Troubleshooting

### Fehler: "relation already exists"
- Die Tabelle existiert bereits. Das ist in Ordnung, das Script verwendet `IF NOT EXISTS` und sollte trotzdem funktionieren.

### Fehler: "permission denied"
- Stellen Sie sicher, dass Sie als Datenbank-Administrator eingeloggt sind oder die notwendigen Berechtigungen haben.

### RLS Policies anpassen
- Falls Sie andere Zugriffsrechte benötigen, können Sie die RLS Policies in `supabase/school_contacts.sql` anpassen.
- Standardmäßig erlauben die Policies allen authentifizierten Benutzern vollen Zugriff.

