import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentAdmin } from '@/lib/supabase-server'
import fs from 'fs'
import path from 'path'
const Papa = require('papaparse')

/**
 * POST /api/textile-catalog/import
 * Importiert Textilien aus der CSV-Datei
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) {
      return NextResponse.json(
        { error: 'Nicht autorisiert' },
        { status: 401 }
      )
    }

    // Pfad zur CSV-Datei
    const csvPath = path.join(process.cwd(), 'textildatenbank_rows.csv')
    
    if (!fs.existsSync(csvPath)) {
      return NextResponse.json(
        { error: 'CSV-Datei nicht gefunden. Bitte stellen Sie sicher, dass textildatenbank_rows.csv im Projekt-Root liegt.' },
        { status: 404 }
      )
    }

    const csvContent = fs.readFileSync(csvPath, 'utf-8')
    
    // Parse CSV mit papaparse
    const parseResult = Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
    })

    if (parseResult.errors.length > 0) {
      console.warn('CSV-Parsing Warnungen:', parseResult.errors)
    }

    const rows = parseResult.data
    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'Keine Daten in CSV gefunden' },
        { status: 400 }
      )
    }

    /**
     * Parst JSON-Array-String aus CSV
     */
    function parseJSONArray(str: string): string[] {
      if (!str || str.trim() === '') return []
      
      try {
        let cleaned = str.trim()
        if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || 
            (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
          cleaned = cleaned.slice(1, -1)
        }
        cleaned = cleaned.replace(/""/g, '"')
        const parsed = JSON.parse(cleaned)
        return Array.isArray(parsed) ? parsed : []
      } catch (e) {
        console.warn(`Fehler beim Parsen von JSON-Array: ${str.substring(0, 50)}...`)
        return []
      }
    }

    const textiles = []
    let skipped = 0

    // Verarbeite Datenzeilen
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as any
      
      const id = row.id?.trim()
      const produktname = row.produktname?.trim()
      const produktfarben = row.produktfarben?.trim()
      const produktgrößen = row.produktgrößen?.trim()
      const created_at = row.created_at?.trim()
      const herstellername = row.herstellername?.trim()

      if (!id || !produktname) {
        skipped++
        continue
      }

      const colors = parseJSONArray(produktfarben || '[]')
      const sizes = parseJSONArray(produktgrößen || '[]')

      textiles.push({
        id: id,
        name: produktname,
        brand: herstellername || null,
        article_number: null,
        base_price: 0,
        available_colors: colors,
        available_sizes: sizes,
        image_url: null,
        active: true,
        created_at: created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    }

    if (textiles.length === 0) {
      return NextResponse.json(
        { error: 'Keine gültigen Textilien zum Importieren gefunden' },
        { status: 400 }
      )
    }

    // Importiere in Datenbank
    let created = 0
    let updated = 0
    let errors = 0
    const errorMessages: string[] = []

    for (const textile of textiles) {
      try {
        // Prüfe ob bereits vorhanden
        const { data: existing } = await supabaseAdmin
          .from('textile_catalog')
          .select('id')
          .eq('id', textile.id)
          .maybeSingle()

        if (existing) {
          // Aktualisiere bestehenden Eintrag
          const { error } = await supabaseAdmin
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
            errors++
            errorMessages.push(`${textile.name}: ${error.message}`)
          } else {
            updated++
          }
        } else {
          // Erstelle neuen Eintrag
          const { error } = await supabaseAdmin
            .from('textile_catalog')
            .insert(textile)

          if (error) {
            errors++
            errorMessages.push(`${textile.name}: ${error.message}`)
          } else {
            created++
          }
        }
      } catch (error: any) {
        errors++
        errorMessages.push(`${textile.name}: ${error.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Import abgeschlossen: ${created} erstellt, ${updated} aktualisiert, ${skipped} übersprungen, ${errors} Fehler`,
      stats: {
        created,
        updated,
        skipped,
        errors,
        total: textiles.length,
      },
      errors: errors > 0 ? errorMessages : undefined,
    })
  } catch (error: any) {
    console.error('Error in POST /api/textile-catalog/import:', error)
    return NextResponse.json(
      { error: error.message || 'Unerwarteter Fehler beim Import' },
      { status: 500 }
    )
  }
}

