'use client'

import {
  Box,
  Typography,
  Divider,
  Paper,
} from '@mui/material'
import { Database } from '@/types/database'
import PrintConfigEditor from './PrintConfigEditor'
import PreviewUploader from './PreviewUploader'

type LeadConfig = Database['public']['Tables']['lead_configurations']['Row']

interface PrintDataEditorProps {
  schoolId: string
  config: LeadConfig | null
  onSave: (updates: Partial<LeadConfig>) => Promise<LeadConfig>
  onNext: () => void
  onBack: () => void
}

export default function PrintDataEditor({ schoolId, config, onSave, onNext, onBack }: PrintDataEditorProps) {
  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Legen Sie die Druckfelder fest und definieren Sie die Druckdateien für die Produktion.
      </Typography>

      {/* Druckpositionen konfigurieren */}
      <Paper elevation={0} sx={{ p: 1.5, mb: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
          Druckfelder festlegen
        </Typography>
        <PrintConfigEditor
          schoolId={schoolId}
          config={config}
          onSave={onSave}
          onNext={onNext}
          onBack={onBack}
        />
      </Paper>

      <Divider sx={{ my: 1.5 }} />

      {/* Druckdateien festlegen */}
      <Paper elevation={0} sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
          Druckdateien festlegen
        </Typography>
        <PreviewUploader
          schoolId={schoolId}
          config={config}
          onSave={onSave}
          onNext={onNext}
          onBack={onBack}
          mode="print-files"
        />
      </Paper>
    </Box>
  )
}

