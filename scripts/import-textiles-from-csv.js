/**
 * Import-Script für Textilien aus CSV
 * Lädt die CSV-Datei und importiert die Daten in die textile_catalog Tabelle
 */

require('dotenv').config({ path: '.env.local' })
const fs = require('fs')
const path = require('path')
const Papa = require('papaparse')
const { createClient } = require('@supabase/supabase-js')

// Supabase-Konfiguration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Fehler: NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY müssen gesetzt sein')
  console.error('Bitte erstelle eine .env.local Datei mit diesen Werten')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

/**
 * Parst JSON-Array-String aus CSV
 */
function parseJSONArray(str) {
  if (!str || str.trim() === '') return []
  
  try {
    // Entferne führende/nachfolgende Anführungszeichen falls vorhanden
    let cleaned = str.trim()
    if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || 
        (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
      cleaned = cleaned.slice(1, -1)
    }
    
    // Ersetze doppelte Anführungszeichen innerhalb des Strings
    cleaned = cleaned.replace(/""/g, '"')
    
    const parsed = JSON.parse(cleaned)
    return Array.isArray(parsed) ? parsed : []
  } catch (e) {
    console.warn(`Fehler beim Parsen von JSON-Array: ${str.substring(0, 50)}...`, e.message)
    return []
  }
}

async function importTextiles() {
  const csvPath = path.join(__dirname, '..', 'textildatenbank_rows.csv')
  
  if (!fs.existsSync(csvPath)) {
    console.error(`CSV-Datei nicht gefunden: ${csvPath}`)
    process.exit(1)
  }

  const csvContent = fs.readFileSync(csvPath, 'utf-8')
  
  // Parse CSV mit papaparse
  const parseResult = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  })

  if (parseResult.errors.length > 0) {
    console.warn('Warnungen beim CSV-Parsing:')
    parseResult.errors.forEach(err => console.warn(`  Zeile ${err.row}: ${err.message}`))
  }

  const rows = parseResult.data
  console.log(`Gefunden: ${rows.length} Zeilen in CSV\n`)

  const textiles = []
  let skipped = 0
  let errors = 0

  // Verarbeite Datenzeilen
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    
    try {
      const id = row.id?.trim()
      const produktname = row.produktname?.trim()
      const produktfarben = row.produktfarben?.trim()
      const produktgrößen = row.produktgrößen?.trim()
      const created_at = row.created_at?.trim()
      const herstellername = row.herstellername?.trim()

      if (!id || !produktname) {
        console.warn(`Zeile ${i + 2}: Fehlende ID oder Produktname, überspringe...`)
        skipped++
        continue
      }

      const colors = parseJSONArray(produktfarben || '[]')
      const sizes = parseJSONArray(produktgrößen || '[]')

      textiles.push({
        id: id,
        name: produktname,
        brand: herstellername || null,
        article_number: null, // Nicht in CSV vorhanden
        base_price: 0, // Muss später manuell gesetzt werden
        available_colors: colors,
        available_sizes: sizes,
        image_url: null, // Nicht in CSV vorhanden
        active: true,
        created_at: created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    } catch (error) {
      console.error(`Fehler beim Verarbeiten von Zeile ${i + 2}:`, error.message)
      errors++
    }
  }

  console.log(`\nVerarbeitet: ${textiles.length} Textilien`)
  console.log(`Übersprungen: ${skipped}`)
  console.log(`Fehler: ${errors}\n`)

  if (textiles.length === 0) {
    console.error('Keine Textilien zum Importieren gefunden')
    process.exit(1)
  }

  // Importiere in Datenbank
  console.log('Importiere Textilien in Datenbank...\n')

  for (const textile of textiles) {
    try {
      // Prüfe ob bereits vorhanden
      const { data: existing } = await supabase
        .from('textile_catalog')
        .select('id')
        .eq('id', textile.id)
        .single()

      if (existing) {
        // Aktualisiere bestehenden Eintrag
        const { error } = await supabase
          .from('textile_catalog')
          .update({
            name: textile.name,
            brand: textile.brand,
            available_colors: textile.available_colors,
            available_sizes: textile.available_sizes,
            updated_at: textile.updated_at,
          })
          .eq('id', textile.id)

        if (error) {
          console.error(`Fehler beim Aktualisieren von ${textile.name}:`, error.message)
        } else {
          console.log(`✓ Aktualisiert: ${textile.name}`)
        }
      } else {
        // Erstelle neuen Eintrag
        const { error } = await supabase
          .from('textile_catalog')
          .insert(textile)

        if (error) {
          console.error(`Fehler beim Erstellen von ${textile.name}:`, error.message)
        } else {
          console.log(`✓ Erstellt: ${textile.name}`)
        }
      }
    } catch (error) {
      console.error(`Fehler bei ${textile.name}:`, error.message)
    }
  }

  console.log('\n✓ Import abgeschlossen!')
}

// Führe Import aus
importTextiles()
  .then(() => {
    console.log('\nImport erfolgreich abgeschlossen')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\nFehler beim Import:', error)
    process.exit(1)
  })

