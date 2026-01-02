import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentAdmin } from '@/lib/supabase-server'

/**
 * POST /api/textile-catalog/fetch-from-lshop
 * Lädt Produktbild und Beschreibung von l-shop-team.de basierend auf article_code
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

    const body = await request.json()
    const { textile_id, article_code } = body

    if (!textile_id) {
      return NextResponse.json(
        { error: 'textile_id ist erforderlich' },
        { status: 400 }
      )
    }

    if (!article_code) {
      return NextResponse.json(
        { error: 'article_code ist erforderlich' },
        { status: 400 }
      )
    }

    // Lade Textil-Daten
    const { data: textile, error: textileError } = await supabaseAdmin
      .from('textile_catalog')
      .select('*')
      .eq('id', textile_id)
      .single()

    if (textileError || !textile) {
      return NextResponse.json(
        { error: 'Textil nicht gefunden' },
        { status: 404 }
      )
    }

    // Versuche, Daten von l-shop-team.de zu laden
    let imageUrl: string | null = null
    let description: string | null = null

    try {
      // Verschiedene URL-Patterns versuchen
      const possibleUrls = [
        `https://www.l-shop-team.de/${article_code}`,
        `https://www.l-shop-team.de/produkt/${article_code}`,
        `https://www.l-shop-team.de/suche?q=${encodeURIComponent(article_code)}`,
      ]

      for (const url of possibleUrls) {
        try {
          const response = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
          })

          if (response.ok) {
            const html = await response.text()

            // Versuche, Open Graph oder Meta-Tags zu extrahieren
            // Bild: og:image oder meta property="og:image"
            const ogImageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i)
            if (ogImageMatch && ogImageMatch[1]) {
              imageUrl = ogImageMatch[1]
            } else {
              // Alternativ: img tags mit Produktbild suchen
              const imgMatch = html.match(/<img[^>]+src=["']([^"']*product[^"']*\.(jpg|jpeg|png|webp))[^"']*["']/i)
              if (imgMatch && imgMatch[1]) {
                imageUrl = imgMatch[1].startsWith('http') 
                  ? imgMatch[1] 
                  : `https://www.l-shop-team.de${imgMatch[1]}`
              }
            }

            // Beschreibung: og:description oder meta description
            const ogDescMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i)
            if (ogDescMatch && ogDescMatch[1]) {
              description = ogDescMatch[1]
            } else {
              const metaDescMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i)
              if (metaDescMatch && metaDescMatch[1]) {
                description = metaDescMatch[1]
              } else {
                // Versuche, Text aus einem Produktbeschreibungs-Bereich zu extrahieren
                const descSectionMatch = html.match(/<div[^>]*class=["'][^"']*description[^"']*["'][^>]*>([\s\S]{0,500})<\/div>/i)
                if (descSectionMatch && descSectionMatch[1]) {
                  // HTML-Tags entfernen
                  description = descSectionMatch[1]
                    .replace(/<[^>]+>/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim()
                    .substring(0, 500)
                }
              }
            }

            // Wenn wir Daten gefunden haben, breche ab
            if (imageUrl || description) {
              break
            }
          }
        } catch (fetchError) {
          console.error(`Error fetching ${url}:`, fetchError)
          // Weiter mit nächster URL
          continue
        }
      }
    } catch (error) {
      console.error('Error scraping l-shop-team.de:', error)
      // Fortfahren, auch wenn Scraping fehlschlägt
    }

    // Aktualisiere Textil mit gefundenen Daten
    const updateData: any = {}
    if (imageUrl && !textile.image_url) {
      updateData.image_url = imageUrl
    }
    if (description) {
      updateData.description = description
    }

    if (Object.keys(updateData).length > 0) {
      const { data: updatedTextile, error: updateError } = await supabaseAdmin
        .from('textile_catalog')
        .update(updateData)
        .eq('id', textile_id)
        .select()
        .single()

      if (updateError) {
        console.error('Error updating textile:', updateError)
        return NextResponse.json(
          { error: 'Fehler beim Aktualisieren des Textils' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        textile: updatedTextile,
        fetched: {
          image_url: imageUrl,
          description: description,
        },
      })
    }

    return NextResponse.json({
      success: false,
      message: 'Keine Daten von l-shop-team.de gefunden',
      textile: textile,
    })
  } catch (error: any) {
    console.error('Error in POST /api/textile-catalog/fetch-from-lshop:', error)
    return NextResponse.json(
      { error: error.message || 'Unerwarteter Fehler' },
      { status: 500 }
    )
  }
}


