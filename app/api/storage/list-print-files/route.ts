import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

interface StorageFile {
  name: string
  id: string
  updated_at: string
  created_at: string
  last_accessed_at: string
  metadata: any
}

interface PrintFileInfo {
  id: string
  name: string
  url: string
  path: string
  size?: number
  mimeType?: string
  createdAt: string
  folder: string
}

/**
 * GET /api/storage/list-print-files
 * Listet alle Druckdateien aus dem print-files Bucket
 * Optional: ?folder=lead-configs/{textileId} um nach Ordner zu filtern
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const folder = searchParams.get('folder') || ''
    const textileId = searchParams.get('textile_id')

    // Wenn textile_id angegeben, filtere auf diesen Pfad
    const searchFolder = textileId ? `lead-configs/${textileId}` : folder

    // Liste alle Dateien im print-files Bucket
    const { data: files, error } = await supabaseAdmin.storage
      .from('print-files')
      .list(searchFolder, {
        limit: 1000,
        sortBy: { column: 'created_at', order: 'desc' },
      })

    if (error) {
      console.error('Error listing print files:', error)
      return NextResponse.json(
        { error: 'Fehler beim Laden der Druckdateien' },
        { status: 500 }
      )
    }

    // Filtere Ordner aus und erstelle vollständige URLs
    const printFiles: PrintFileInfo[] = []
    
    for (const file of files || []) {
      // Überspringe Ordner (Placeholder-Dateien)
      if (file.name === '.emptyFolderPlaceholder' || !file.id) {
        continue
      }

      const filePath = searchFolder ? `${searchFolder}/${file.name}` : file.name
      
      // Erstelle öffentliche URL
      const { data: urlData } = supabaseAdmin.storage
        .from('print-files')
        .getPublicUrl(filePath)

      printFiles.push({
        id: file.id,
        name: file.name,
        url: urlData.publicUrl,
        path: filePath,
        size: file.metadata?.size,
        mimeType: file.metadata?.mimetype,
        createdAt: file.created_at,
        folder: folder,
      })
    }

    // Wenn textile_id angegeben, durchsuche rekursiv alle Positionen und Farben
    if (textileId) {
      const textilePath = `lead-configs/${textileId}`
      
      // Lade Positionen (front, back, side)
      for (const position of ['front', 'back', 'side']) {
        const positionPath = `${textilePath}/${position}`
        
        const { data: positionFiles } = await supabaseAdmin.storage
          .from('print-files')
          .list(positionPath, { limit: 100 })

        if (positionFiles) {
          // Für jeden Farb-Ordner
          for (const colorFolder of positionFiles) {
            if (colorFolder.name === '.emptyFolderPlaceholder') continue
            
            const colorPath = `${positionPath}/${colorFolder.name}`
            
            const { data: colorFiles } = await supabaseAdmin.storage
              .from('print-files')
              .list(colorPath, { limit: 100 })

            if (colorFiles) {
              for (const file of colorFiles) {
                if (file.name === '.emptyFolderPlaceholder' || !file.id) continue
                
                const filePath = `${colorPath}/${file.name}`
                const { data: urlData } = supabaseAdmin.storage
                  .from('print-files')
                  .getPublicUrl(filePath)

                printFiles.push({
                  id: file.id,
                  name: file.name,
                  url: urlData.publicUrl,
                  path: filePath,
                  size: file.metadata?.size,
                  mimeType: file.metadata?.mimetype,
                  createdAt: file.created_at,
                  folder: colorPath,
                })
              }
            }
          }
        }
      }
    } else if (!folder) {
      // Wenn kein Ordner angegeben und keine textile_id, durchsuche auch Unterordner (lead-configs)
      // Lade lead-configs Ordner
      const { data: leadConfigFolders, error: foldersError } = await supabaseAdmin.storage
        .from('print-files')
        .list('lead-configs', { limit: 100 })

      if (!foldersError && leadConfigFolders) {
        // Für jeden Textil-Ordner
        for (const textileFolder of leadConfigFolders) {
          if (textileFolder.name === '.emptyFolderPlaceholder') continue
          
          const textilePath = `lead-configs/${textileFolder.name}`
          
          // Lade Positionen (front, back, side)
          for (const position of ['front', 'back', 'side']) {
            const positionPath = `${textilePath}/${position}`
            
            const { data: positionFiles } = await supabaseAdmin.storage
              .from('print-files')
              .list(positionPath, { limit: 100 })

            if (positionFiles) {
              // Für jeden Farb-Ordner
              for (const colorFolder of positionFiles) {
                if (colorFolder.name === '.emptyFolderPlaceholder') continue
                
                const colorPath = `${positionPath}/${colorFolder.name}`
                
                const { data: colorFiles } = await supabaseAdmin.storage
                  .from('print-files')
                  .list(colorPath, { limit: 100 })

                if (colorFiles) {
                  for (const file of colorFiles) {
                    if (file.name === '.emptyFolderPlaceholder' || !file.id) continue
                    
                    const filePath = `${colorPath}/${file.name}`
                    const { data: urlData } = supabaseAdmin.storage
                      .from('print-files')
                      .getPublicUrl(filePath)

                    printFiles.push({
                      id: file.id,
                      name: file.name,
                      url: urlData.publicUrl,
                      path: filePath,
                      size: file.metadata?.size,
                      mimeType: file.metadata?.mimetype,
                      createdAt: file.created_at,
                      folder: colorPath,
                    })
                  }
                }
              }
            }
          }
        }
      }
    }

    return NextResponse.json({ 
      files: printFiles,
      count: printFiles.length,
    })
  } catch (error: any) {
    console.error('Error in GET /api/storage/list-print-files:', error)
    return NextResponse.json(
      { error: error.message || 'Unerwarteter Fehler' },
      { status: 500 }
    )
  }
}
