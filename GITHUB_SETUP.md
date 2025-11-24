# GitHub Repository Setup

Das Projekt ist bereits lokal als Git-Repository initialisiert. Folgen Sie diesen Schritten, um es auf GitHub hochzuladen:

## Schritt 1: GitHub Repository erstellen

1. Gehen Sie zu [GitHub.com](https://github.com) und loggen Sie sich ein
2. Klicken Sie auf das **+** Icon oben rechts → **New repository**
3. Geben Sie einen Repository-Namen ein (z.B. `schulshop`)
4. Wählen Sie **Private** oder **Public** (empfohlen: Private für sensible Daten)
5. **WICHTIG**: Lassen Sie alle Checkboxen leer (kein README, keine .gitignore, keine License)
6. Klicken Sie auf **Create repository**

## Schritt 2: Repository mit GitHub verbinden

Nachdem Sie das Repository erstellt haben, zeigt GitHub Ihnen die Befehle an. Führen Sie diese aus:

```bash
# Ersetzen Sie YOUR_USERNAME und REPO_NAME mit Ihren Werten
git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git
git branch -M main
git push -u origin main
```

## Alternative: Mit SSH

Falls Sie SSH-Keys bei GitHub eingerichtet haben:

```bash
git remote add origin git@github.com:YOUR_USERNAME/REPO_NAME.git
git branch -M main
git push -u origin main
```

## Schritt 3: Verifizierung

Nach dem Push sollten Sie alle Dateien auf GitHub sehen können.

## Nächste Schritte

- Fügen Sie eine `.github/workflows` Datei für CI/CD hinzu (optional)
- Erstellen Sie Issues für geplante Features
- Fügen Sie Collaborators hinzu (falls nötig)

## Wichtige Hinweise

⚠️ **Sicherheit**: Stellen Sie sicher, dass keine sensiblen Daten (API-Keys, Passwörter) im Repository sind. Diese sollten in `.env.local` gespeichert werden, welche bereits in `.gitignore` enthalten ist.

✅ Die folgenden Dateien werden **NICHT** hochgeladen (dank .gitignore):
- `.env*` Dateien
- `node_modules/`
- `.next/`
- `schulshop-beta/` (separates Repository)

