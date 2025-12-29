/**
 * Prüft ob die textile_catalog Tabelle existiert und ob Daten vorhanden sind
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Fehler: Umgebungsvariablen nicht gesetzt')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkTable() {
  try {
    console.log('Prüfe textile_catalog Tabelle...\n')
    
    // Versuche Daten abzurufen
    const { data, error } = await supabase
      .from('textile_catalog')
      .select('id, name, brand')
      .limit(5)

    if (error) {
      if (error.code === '42P01') {
        console.error('❌ FEHLER: Die Tabelle "textile_catalog" existiert nicht!')
        console.error('\nBitte führen Sie zuerst die Migration aus:')
        console.error('1. Öffnen Sie Supabase Dashboard > SQL Editor')
        console.error('2. Führen Sie die Datei supabase/migrations/lead_dashboard.sql aus')
        process.exit(1)
      } else {
        console.error('❌ Fehler beim Abrufen der Daten:', error.message)
        console.error('Code:', error.code)
        process.exit(1)
      }
    }

    console.log(`✓ Tabelle existiert`)
    console.log(`✓ Gefundene Einträge: ${data.length}`)
    
    if (data.length > 0) {
      console.log('\nErste Einträge:')
      data.forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.name} (${item.brand || 'keine Marke'})`)
      })
    } else {
      console.log('\n⚠️  Keine Daten vorhanden. Führen Sie den Import aus:')
      console.log('   npm run import:textiles')
    }
    
    // Zähle alle Einträge
    const { count } = await supabase
      .from('textile_catalog')
      .select('*', { count: 'exact', head: true })
    
    console.log(`\nGesamtanzahl Textilien: ${count || 0}`)
    
  } catch (error) {
    console.error('❌ Unerwarteter Fehler:', error.message)
    process.exit(1)
  }
}

checkTable()


