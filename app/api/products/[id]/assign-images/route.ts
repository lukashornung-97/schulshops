import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

/**
 * API Route zum Zuordnen von Bildern zu Textilfarben
 * POST /api/products/[id]/assign-images
 * 
 * Body: JSON mit:
 * - image_id: UUID des Bildes aus product_images
 * - textile_colors: Array von Textilfarben-Namen (z.B. ["Schwarz", "Weiß"])
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { image_id, textile_colors } = body

    if (!image_id) {
      return NextResponse.json(
        { error: 'image_id fehlt' },
        { status: 400 }
      )
    }

    if (!textile_colors || !Array.isArray(textile_colors) || textile_colors.length === 0) {
      return NextResponse.json(
        { error: 'textile_colors muss ein Array mit mindestens einem Element sein' },
        { status: 400 }
      )
    }

    // Prüfe ob Bild existiert und zum Produkt gehört
    const { data: imageEntry, error: imageError } = await supabase
      .from('product_images')
      .select('*')
      .eq('id', image_id)
      .eq('product_id', params.id)
      .single()

    if (imageError || !imageEntry) {
      return NextResponse.json(
        { error: 'Bild nicht gefunden' },
        { status: 404 }
      )
    }

    // Für jede Textilfarbe einen Eintrag erstellen oder aktualisieren
    const results = []
    for (const color of textile_colors) {
      // Prüfe ob bereits ein Eintrag existiert
      const { data: existing } = await supabase
        .from('product_images')
        .select('id')
        .eq('product_id', params.id)
        .eq('textile_color_name', color)
        .eq('image_type', imageEntry.image_type)
        .single()

      if (existing) {
        // Update bestehenden Eintrag
        const updateData: any = {}
        if (imageEntry.image_url) {
          updateData.image_url = imageEntry.image_url
        }
        if (imageEntry.print_file_url) {
          updateData.print_file_url = imageEntry.print_file_url
        }

        const { error: updateError } = await supabase
          .from('product_images')
          .update(updateData)
          .eq('id', existing.id)

        if (updateError) {
          results.push({ color, success: false, error: updateError.message })
        } else {
          results.push({ color, success: true })
        }
      } else {
        // Erstelle neuen Eintrag für diese Farbe
        const newEntry: any = {
          product_id: params.id,
          textile_color_name: color,
          image_type: imageEntry.image_type,
        }

        if (imageEntry.image_url) {
          newEntry.image_url = imageEntry.image_url
        }
        if (imageEntry.print_file_url) {
          newEntry.print_file_url = imageEntry.print_file_url
        }

        // Finde Varianten-ID falls vorhanden
        const { data: variant } = await supabase
          .from('product_variants')
          .select('id')
          .eq('product_id', params.id)
          .eq('color_name', color)
          .single()

        if (variant) {
          newEntry.textile_color_id = variant.id
        }

        const { error: insertError } = await supabase
          .from('product_images')
          .insert([newEntry])

        if (insertError) {
          results.push({ color, success: false, error: insertError.message })
        } else {
          results.push({ color, success: true })
        }
      }
    }

    // Lösche das ursprüngliche Bild ohne Textilfarbe (falls vorhanden)
    if (!imageEntry.textile_color_name) {
      await supabase
        .from('product_images')
        .delete()
        .eq('id', image_id)
    }

    return NextResponse.json({
      success: true,
      results,
    })
  } catch (error: any) {
    console.error('Error assigning images:', error)
    return NextResponse.json(
      { error: error.message || 'Fehler beim Zuordnen der Bilder' },
      { status: 500 }
    )
  }
}

