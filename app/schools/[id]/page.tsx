'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Grid,
  Chip,
  Fab,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Snackbar,
  Alert,
  CircularProgress,
  Divider,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material'
import { supabase } from '@/lib/supabase'
import { Database } from '@/types/database'
import AddIcon from '@mui/icons-material/Add'
import StoreIcon from '@mui/icons-material/Store'
import SchoolIcon from '@mui/icons-material/School'
import ContactMailIcon from '@mui/icons-material/ContactMail'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import EmailIcon from '@mui/icons-material/Email'
import PhoneIcon from '@mui/icons-material/Phone'
import PersonIcon from '@mui/icons-material/Person'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import CalendarTodayIcon from '@mui/icons-material/CalendarToday'
import NoteIcon from '@mui/icons-material/Note'
import TaskIcon from '@mui/icons-material/Task'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import DownloadIcon from '@mui/icons-material/Download'
import SendIcon from '@mui/icons-material/Send'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import Timeline from '@mui/lab/Timeline'
import TimelineItem from '@mui/lab/TimelineItem'
import TimelineSeparator from '@mui/lab/TimelineSeparator'
import TimelineConnector from '@mui/lab/TimelineConnector'
import TimelineContent from '@mui/lab/TimelineContent'
import TimelineDot from '@mui/lab/TimelineDot'
import TimelineOppositeContent from '@mui/lab/TimelineOppositeContent'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'

type School = Database['public']['Tables']['schools']['Row']
type Shop = Database['public']['Tables']['shops']['Row']
type SchoolContact = Database['public']['Tables']['school_contacts']['Row']
type SchoolNote = Database['public']['Tables']['school_notes']['Row']
type Order = Database['public']['Tables']['orders']['Row']

// Hilfsfunktion: Prüft ob ein Shop wirklich "live" ist
// Ein Shop ist nur live, wenn status='live' UND shop_close_at nicht in der Vergangenheit liegt
function isShopReallyLive(shop: Shop): boolean {
  if (shop.status !== 'live') return false
  if (shop.shop_close_at) {
    const closeDate = new Date(shop.shop_close_at)
    const now = new Date()
    if (closeDate < now) return false
  }
  return true
}

// Funktion: Prüft und schließt Shops automatisch, deren shop_close_at in der Vergangenheit liegt
async function checkAndCloseExpiredShops(shops: Shop[]): Promise<void> {
  const now = new Date()
  const shopsToClose = shops.filter(
    (shop) => shop.status === 'live' && shop.shop_close_at && new Date(shop.shop_close_at) < now
  )

  if (shopsToClose.length > 0) {
    // Schließe alle abgelaufenen Shops
    await Promise.all(
      shopsToClose.map(async (shop) => {
        const { error } = await supabase
          .from('shops')
          .update({ status: 'closed' })
          .eq('id', shop.id)

        if (error) {
          console.error(`Error closing shop ${shop.id}:`, error)
        }
      })
    )
  }
}

interface OrderWithShop extends Order {
  shop_name?: string
  shop?: Shop | null
}

type OrderGroup = {
  shopOpenAt: string | null
  shopCloseAt: string | null
  shopName: string
  shopId: string
  shopSlug: string
  orders: OrderWithShop[]
}

export default function SchoolDetail() {
  const params = useParams()
  const router = useRouter()
  const [school, setSchool] = useState<School | null>(null)
  const [shops, setShops] = useState<Shop[]>([])
  const [contacts, setContacts] = useState<SchoolContact[]>([])
  const [notes, setNotes] = useState<SchoolNote[]>([])
  const [orders, setOrders] = useState<OrderWithShop[]>([])
  const [loading, setLoading] = useState(true)
  const [ordersViewMode, setOrdersViewMode] = useState<'all' | 'grouped'>('grouped')
  const [contactDialogOpen, setContactDialogOpen] = useState(false)
  const [editingContact, setEditingContact] = useState<SchoolContact | null>(null)
  const [savingContact, setSavingContact] = useState(false)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  })
  const [contactForm, setContactForm] = useState({
    first_name: '',
    last_name: '',
    title: '',
    role: '',
    email: '',
    phone: '',
    mobile: '',
    notes: '',
  })
  const [noteDialogOpen, setNoteDialogOpen] = useState(false)
  const [editingNote, setEditingNote] = useState<SchoolNote | null>(null)
  const [savingNote, setSavingNote] = useState(false)
  const [noteForm, setNoteForm] = useState({
    type: 'note' as 'note' | 'task',
    title: '',
    content: '',
    due_date: '',
    completed: false,
  })
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [sendingNotification, setSendingNotification] = useState<string | null>(null)
  const [exportingAnalytics, setExportingAnalytics] = useState(false)

  useEffect(() => {
    if (params.id) {
      loadSchool()
      loadShops()
      loadContacts()
      loadNotes()
    }
  }, [params.id])

  async function loadSchool() {
    try {
      const { data, error } = await supabase
        .from('schools')
        .select('*')
        .eq('id', params.id)
        .single()

      if (error) throw error
      setSchool(data)
    } catch (error) {
      console.error('Error loading school:', error)
    }
  }

  async function handleStatusChange(newStatus: 'lead' | 'active' | 'production' | 'existing') {
    console.log('handleStatusChange called with:', newStatus, 'current status:', school?.status)
    
    if (!school) {
      console.log('No school found')
      return
    }
    
    if (school.status === newStatus) {
      console.log('Status unchanged')
      return
    }
    
    if (updatingStatus) {
      console.log('Already updating')
      return
    }

    setUpdatingStatus(true)
    try {
      console.log('Updating status to:', newStatus)
      const { error } = await supabase
        .from('schools')
        .update({ status: newStatus })
        .eq('id', school.id)

      if (error) {
        console.error('Supabase error:', error)
        throw error
      }

      // Aktualisiere lokalen State
      setSchool({ ...school, status: newStatus })
      
      setSnackbar({
        open: true,
        message: 'Status erfolgreich aktualisiert',
        severity: 'success',
      })
    } catch (error) {
      console.error('Error updating school status:', error)
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : 'Fehler beim Aktualisieren des Status',
        severity: 'error',
      })
    } finally {
      setUpdatingStatus(false)
    }
  }

  function getStatusLabel(status: string): string {
    switch (status) {
      case 'lead':
        return 'Lead'
      case 'active':
        return 'Aktiv'
      case 'production':
        return 'Produktion'
      case 'existing':
        return 'Bestand'
      default:
        return status
    }
  }

  function getStatusColor(status: string): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' {
    switch (status) {
      case 'lead':
        return 'warning'
      case 'active':
        return 'success'
      case 'production':
        return 'secondary'
      case 'existing':
        return 'info'
      default:
        return 'default'
    }
  }

  async function updateSchoolStatusIfNeeded() {
    if (!school) return

    try {
      // Prüfe aktuellen Status der Schule
      const { data: schoolData, error: fetchError } = await supabase
        .from('schools')
        .select('status')
        .eq('id', school.id)
        .single()

      if (fetchError) {
        console.error('Error fetching school status:', fetchError)
        return
      }

      const currentStatus = schoolData?.status

      // Wenn der Status manuell auf 'production' oder 'existing' gesetzt wurde,
      // überschreibe ihn nicht automatisch
      if (currentStatus === 'production' || currentStatus === 'existing') {
        console.log('School status is manually set to', currentStatus, '- not auto-updating')
        return
      }

      // Prüfe ob ein Shop wirklich aktiv ist (Status 'live' UND nicht geschlossen)
      const hasActiveShop = shops.some((shop) => isShopReallyLive(shop))

      // Wenn ein Shop aktiv ist, setze Schule auf 'active'
      if (hasActiveShop && currentStatus !== 'active') {
        const { error: updateError } = await supabase
          .from('schools')
          .update({ status: 'active' })
          .eq('id', school.id)

        if (updateError) {
          console.error('Error updating school status:', updateError)
        } else {
          // Aktualisiere lokalen State
          setSchool({ ...school, status: 'active' })
        }
      }
    } catch (error) {
      console.error('Error in updateSchoolStatusIfNeeded:', error)
    }
  }

  async function loadShops() {
    try {
      const { data, error } = await supabase
        .from('shops')
        .select('*')
        .eq('school_id', params.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      
      console.log('Loaded shops:', data)
      data?.forEach((shop, index) => {
        console.log(`Shop ${index + 1}:`, shop.name)
        console.log(`  shop_open_at:`, shop.shop_open_at, 'Type:', typeof shop.shop_open_at)
        console.log(`  shop_close_at:`, shop.shop_close_at, 'Type:', typeof shop.shop_close_at)
      })
      
      // Prüfe und schließe abgelaufene Shops automatisch
      let finalShopsData = data || []
      if (finalShopsData.length > 0) {
        await checkAndCloseExpiredShops(finalShopsData)
        // Lade Shops erneut, um die aktualisierten Status zu erhalten
        const { data: updatedData } = await supabase
          .from('shops')
          .select('*')
          .eq('school_id', params.id)
          .order('created_at', { ascending: false })
        if (updatedData) {
          finalShopsData = updatedData
        }
      }
      
      setShops(finalShopsData)
      
      // Aktualisiere Schulstatus basierend auf aktiven Shops
      if (finalShopsData.length > 0) {
        const hasActiveShop = finalShopsData.some((shop) => isShopReallyLive(shop))
        if (hasActiveShop) {
          await updateSchoolStatusIfNeeded()
        }
        // Lade Bestellungen nachdem Shops geladen wurden
        await loadOrders(finalShopsData)
      } else {
        setOrders([])
      }
      
      setLoading(false)
    } catch (error) {
      console.error('Error loading shops:', error)
      setLoading(false)
    }
  }

  async function loadContacts() {
    try {
      const { data, error } = await supabase
        .from('school_contacts')
        .select('*')
        .eq('school_id', params.id)
        .order('last_name', { ascending: true })

      if (error) throw error
      setContacts(data || [])
    } catch (error) {
      console.error('Error loading contacts:', error)
    }
  }

  async function loadNotes() {
    try {
      const { data, error } = await supabase
        .from('school_notes')
        .select('*')
        .eq('school_id', params.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setNotes(data || [])
    } catch (error) {
      console.error('Error loading notes:', error)
    }
  }

  async function loadOrders(shopList?: Shop[]) {
    try {
      const shopsToUse = shopList || shops
      if (!shopsToUse || shopsToUse.length === 0) {
        setOrders([])
        return
      }

      // Lade alle Bestellungen für alle Shops dieser Schule
      const shopIds = shopsToUse.map(shop => shop.id)
      
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .in('shop_id', shopIds)
        .order('created_at', { ascending: false })

      if (ordersError) throw ordersError

      // Füge Shop-Daten zu den Bestellungen hinzu
      const ordersWithShop = (ordersData || []).map(order => {
        const shop = shopsToUse.find(s => s.id === order.shop_id)
        return {
          ...order,
          shop_name: shop?.name || 'Unbekannter Shop',
          shop: shop || null,
        }
      })

      setOrders(ordersWithShop)
    } catch (error) {
      console.error('Error loading orders:', error)
    }
  }

  function getOrderStatusColor(status: string) {
    switch (status) {
      case 'paid':
        return 'success'
      case 'cancelled':
        return 'error'
      case 'fulfilled':
        return 'info'
      default:
        return 'warning'
    }
  }

  function formatDateTime(dateString: string) {
    return format(new Date(dateString), 'dd.MM.yyyy HH:mm', { locale: de })
  }

  function formatDateTimeForDisplay(dateString: string | null): string {
    if (!dateString) return 'Nicht festgelegt'
    return format(new Date(dateString), 'dd.MM.yyyy HH:mm', { locale: de })
  }

  function groupOrdersBySlugAndOpeningTimes(): OrderGroup[] {
    const groups = new Map<string, OrderGroup>()
    const shopsBySlug = new Map<string, Shop>()

    // First pass: collect shops by slug and determine the representative shop for each slug
    // (prefer shops with opening times set)
    orders.forEach(order => {
      const shop = order.shop
      if (!shop || !shop.slug) {
        return
      }

      const slug = shop.slug
      const existingShop = shopsBySlug.get(slug)
      
      // Prefer shops with opening times set, or keep the first one
      if (!existingShop || 
          (!existingShop.shop_open_at && shop.shop_open_at) ||
          (!existingShop.shop_close_at && shop.shop_close_at)) {
        shopsBySlug.set(slug, shop)
      }
    })

    // Second pass: group orders by slug and filter by opening times
    orders.forEach(order => {
      const shop = order.shop
      if (!shop || !shop.slug) {
        // Orders without shop go into a special group
        const key = 'no-shop'
        if (!groups.has(key)) {
          groups.set(key, {
            shopOpenAt: null,
            shopCloseAt: null,
            shopName: 'Kein Shop zugeordnet',
            shopId: '',
            shopSlug: '',
            orders: [],
          })
        }
        groups.get(key)!.orders.push(order)
        return
      }

      const slug = shop.slug
      
      // Filter: only include orders from shops that have opening times set
      const hasOpeningTimes = shop.shop_open_at || shop.shop_close_at
      if (!hasOpeningTimes) {
        // Skip orders from shops without opening times
        return
      }
      
      if (!groups.has(slug)) {
        // Use the representative shop for this slug group
        const representativeShop = shopsBySlug.get(slug) || shop
        groups.set(slug, {
          shopOpenAt: representativeShop.shop_open_at,
          shopCloseAt: representativeShop.shop_close_at,
          shopName: representativeShop.name,
          shopId: representativeShop.id,
          shopSlug: slug,
          orders: [],
        })
      }
      groups.get(slug)!.orders.push(order)
    })

    // Sort groups by opening time (earliest first), then by slug
    return Array.from(groups.values()).sort((a, b) => {
      // First sort by opening time
      if (a.shopOpenAt && b.shopOpenAt) {
        const timeDiff = new Date(a.shopOpenAt).getTime() - new Date(b.shopOpenAt).getTime()
        if (timeDiff !== 0) return timeDiff
      } else if (a.shopOpenAt && !b.shopOpenAt) {
        return -1
      } else if (!a.shopOpenAt && b.shopOpenAt) {
        return 1
      }
      // If opening times are equal or both null, sort by slug
      return a.shopSlug.localeCompare(b.shopSlug)
    })
  }

  function getOpeningTimeStatus(group: OrderGroup): { label: string; color: 'success' | 'warning' | 'error' | 'info' } {
    if (!group.shopOpenAt && !group.shopCloseAt) {
      return { label: 'Keine Öffnungszeiten', color: 'info' }
    }

    const now = new Date()
    const openAt = group.shopOpenAt ? new Date(group.shopOpenAt) : null
    const closeAt = group.shopCloseAt ? new Date(group.shopCloseAt) : null

    if (openAt && now < openAt) {
      return { label: 'Noch nicht geöffnet', color: 'warning' }
    }

    if (closeAt && now > closeAt) {
      return { label: 'Geschlossen', color: 'error' }
    }

    if (openAt && closeAt && now >= openAt && now <= closeAt) {
      return { label: 'Aktuell geöffnet', color: 'success' }
    }

    return { label: 'Unbekannt', color: 'info' }
  }

  const orderGroups = groupOrdersBySlugAndOpeningTimes()

  function handleOpenContactDialog(contact?: SchoolContact) {
    if (contact) {
      setEditingContact(contact)
      setContactForm({
        first_name: contact.first_name,
        last_name: contact.last_name,
        title: contact.title || '',
        role: contact.role || '',
        email: contact.email || '',
        phone: contact.phone || '',
        mobile: contact.mobile || '',
        notes: contact.notes || '',
      })
    } else {
      setEditingContact(null)
      setContactForm({
        first_name: '',
        last_name: '',
        title: '',
        role: '',
        email: '',
        phone: '',
        mobile: '',
        notes: '',
      })
    }
    setContactDialogOpen(true)
  }

  function handleCloseContactDialog() {
    setContactDialogOpen(false)
    setEditingContact(null)
    setContactForm({
      first_name: '',
      last_name: '',
      title: '',
      role: '',
      email: '',
      phone: '',
      mobile: '',
      notes: '',
    })
  }

  async function handleSaveContact() {
    if (!contactForm.first_name.trim() || !contactForm.last_name.trim()) {
      setSnackbar({
        open: true,
        message: 'Bitte geben Sie Vor- und Nachname ein',
        severity: 'error',
      })
      return
    }

    setSavingContact(true)
    try {
      const contactData = {
        first_name: contactForm.first_name.trim(),
        last_name: contactForm.last_name.trim(),
        title: contactForm.title.trim() || null,
        role: contactForm.role || null,
        email: contactForm.email.trim() || null,
        phone: contactForm.phone.trim() || null,
        mobile: contactForm.mobile.trim() || null,
        notes: contactForm.notes.trim() || null,
      }

      if (editingContact) {
        const { data, error } = await supabase
          .from('school_contacts')
          .update(contactData)
          .eq('id', editingContact.id)
          .select()

        if (error) {
          console.error('Supabase update error:', error)
          throw new Error(error.message || 'Fehler beim Aktualisieren des Kontakts')
        }
        
        setSnackbar({
          open: true,
          message: 'Kontakt erfolgreich aktualisiert',
          severity: 'success',
        })
      } else {
        const { data, error } = await supabase
          .from('school_contacts')
          .insert([{ ...contactData, school_id: params.id as string }])
          .select()

        if (error) {
          console.error('Supabase insert error:', error)
          console.error('Error details:', JSON.stringify(error, null, 2))
          throw new Error(error.message || 'Fehler beim Erstellen des Kontakts')
        }
        
        setSnackbar({
          open: true,
          message: 'Kontakt erfolgreich hinzugefügt',
          severity: 'success',
        })
      }

      await loadContacts()
      handleCloseContactDialog()
    } catch (error: any) {
      console.error('Error saving contact:', error)
      const errorMessage = error?.message || 'Unbekannter Fehler beim Speichern des Kontakts'
      setSnackbar({
        open: true,
        message: errorMessage,
        severity: 'error',
      })
    } finally {
      setSavingContact(false)
    }
  }

  async function handleDeleteContact(contactId: string) {
    if (!confirm('Möchten Sie diesen Kontakt wirklich löschen?')) return

    try {
      const { error } = await supabase
        .from('school_contacts')
        .delete()
        .eq('id', contactId)

      if (error) {
        console.error('Supabase delete error:', error)
        throw new Error(error.message || 'Fehler beim Löschen des Kontakts')
      }
      
      await loadContacts()
      setSnackbar({
        open: true,
        message: 'Kontakt erfolgreich gelöscht',
        severity: 'success',
      })
    } catch (error: any) {
      console.error('Error deleting contact:', error)
      setSnackbar({
        open: true,
        message: error?.message || 'Fehler beim Löschen des Kontakts',
        severity: 'error',
      })
    }
  }

  const getShopStatusColor = (status: string) => {
    switch (status) {
      case 'live':
        return 'success'
      case 'closed':
        return 'default'
      default:
        return 'warning'
    }
  }

  function formatDateTime(dateString: string | null): string {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  function handleOpenNoteDialog(note?: SchoolNote) {
    if (note) {
      setEditingNote(note)
      setNoteForm({
        type: note.type,
        title: note.title,
        content: note.content || '',
        due_date: note.due_date ? convertISOToLocalDateTime(note.due_date) : '',
        completed: note.completed,
      })
    } else {
      setEditingNote(null)
      setNoteForm({
        type: 'note',
        title: '',
        content: '',
        due_date: '',
        completed: false,
      })
    }
    setNoteDialogOpen(true)
  }

  function handleCloseNoteDialog() {
    setNoteDialogOpen(false)
    setEditingNote(null)
    setNoteForm({
      type: 'note',
      title: '',
      content: '',
      due_date: '',
      completed: false,
    })
  }

  function convertISOToLocalDateTime(isoString: string | null): string {
    if (!isoString) return ''
    const date = new Date(isoString)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hours}:${minutes}`
  }

  function convertLocalDateTimeToISO(localDateTime: string): string | null {
    if (!localDateTime) return null
    return new Date(localDateTime).toISOString()
  }

  async function handleSaveNote() {
    if (!noteForm.title.trim()) {
      setSnackbar({
        open: true,
        message: 'Bitte geben Sie einen Titel ein',
        severity: 'error',
      })
      return
    }

    setSavingNote(true)
    try {
      const noteData = {
        type: noteForm.type,
        title: noteForm.title.trim(),
        content: noteForm.content.trim() || null,
        completed: noteForm.type === 'task' ? noteForm.completed : false,
        due_date: noteForm.type === 'task' && noteForm.due_date ? convertLocalDateTimeToISO(noteForm.due_date) : null,
      }

      if (editingNote) {
        const { error } = await supabase
          .from('school_notes')
          .update(noteData)
          .eq('id', editingNote.id)

        if (error) throw error

        setSnackbar({
          open: true,
          message: 'Eintrag erfolgreich aktualisiert',
          severity: 'success',
        })
      } else {
        const { error } = await supabase
          .from('school_notes')
          .insert([{ ...noteData, school_id: params.id as string }])

        if (error) throw error

        setSnackbar({
          open: true,
          message: 'Eintrag erfolgreich hinzugefügt',
          severity: 'success',
        })
      }

      await loadNotes()
      handleCloseNoteDialog()
    } catch (error: any) {
      console.error('Error saving note:', error)
      setSnackbar({
        open: true,
        message: error?.message || 'Fehler beim Speichern des Eintrags',
        severity: 'error',
      })
    } finally {
      setSavingNote(false)
    }
  }

  async function handleToggleTaskComplete(noteId: string, currentStatus: boolean) {
    try {
      const { error } = await supabase
        .from('school_notes')
        .update({ completed: !currentStatus })
        .eq('id', noteId)

      if (error) throw error

      await loadNotes()
    } catch (error: any) {
      console.error('Error toggling task status:', error)
      setSnackbar({
        open: true,
        message: error?.message || 'Fehler beim Aktualisieren der Aufgabe',
        severity: 'error',
      })
    }
  }

  async function handleDeleteNote(noteId: string) {
    if (!confirm('Möchten Sie diesen Eintrag wirklich löschen?')) return

    try {
      const { error } = await supabase
        .from('school_notes')
        .delete()
        .eq('id', noteId)

      if (error) throw error

      await loadNotes()
      setSnackbar({
        open: true,
        message: 'Eintrag erfolgreich gelöscht',
        severity: 'success',
      })
    } catch (error: any) {
      console.error('Error deleting note:', error)
      setSnackbar({
        open: true,
        message: error?.message || 'Fehler beim Löschen des Eintrags',
        severity: 'error',
      })
    }
  }

  function getLastClosedShop(): Shop | null {
    const now = new Date()
    
    // Finde Shops die entweder:
    // 1. Status 'closed' haben, ODER
    // 2. Ein shop_close_at Datum haben das bereits vergangen ist
    const closedShops = shops
      .filter((shop) => {
        // Shop mit Status 'closed'
        if (shop.status === 'closed' && shop.shop_close_at) {
          return true
        }
        // Shop mit shop_close_at in der Vergangenheit (auch wenn Status noch 'live')
        if (shop.shop_close_at) {
          const closeDate = new Date(shop.shop_close_at)
          if (closeDate < now) {
            return true
          }
        }
        return false
      })
      .sort((a, b) => {
        const dateA = a.shop_close_at ? new Date(a.shop_close_at).getTime() : 0
        const dateB = b.shop_close_at ? new Date(b.shop_close_at).getTime() : 0
        return dateB - dateA
      })
    
    console.log('All shops:', shops.map(s => ({ id: s.id, name: s.name, status: s.status, shop_close_at: s.shop_close_at })))
    console.log('Filtered closed shops:', closedShops.map(s => ({ id: s.id, name: s.name, status: s.status, shop_close_at: s.shop_close_at })))
    
    return closedShops[0] || null
  }

  async function handleExportLastShopAnalytics() {
    if (exportingAnalytics) {
      console.log('Already exporting, skipping...')
      return
    }
    
    console.log('handleExportLastShopAnalytics called')
    const lastShop = getLastClosedShop()
    console.log('Last closed shop:', lastShop)
    
    if (!lastShop) {
      console.log('No closed shop found')
      setSnackbar({
        open: true,
        message: 'Kein geschlossener Shop gefunden',
        severity: 'error',
      })
      return
    }

    console.log('Starting export for shop:', lastShop.id, lastShop.name)
    setExportingAnalytics(true)
    
    // Lade die Analytics-Daten und exportiere direkt
    try {
      // Lade Shop-Daten mit Öffnungszeiten
      const { data: shopData } = await supabase
        .from('shops')
        .select('shop_open_at, shop_close_at')
        .eq('id', lastShop.id)
        .single()

      if (!shopData) {
        setSnackbar({
          open: true,
          message: 'Shop-Daten nicht gefunden',
          severity: 'error',
        })
        return
      }

      // Lade alle Order Items für diesen Shop
      let ordersQuery = supabase
        .from('orders')
        .select('id, customer_name, customer_email, class_name, created_at')
        .eq('shop_id', lastShop.id)
        .in('status', ['pending', 'paid', 'fulfilled'])

      // Filtere nach Öffnungszeitraum
      if (shopData.shop_open_at) {
        ordersQuery = ordersQuery.gte('created_at', shopData.shop_open_at)
      }
      if (shopData.shop_close_at) {
        ordersQuery = ordersQuery.lte('created_at', shopData.shop_close_at)
      }

      const { data: ordersData } = await ordersQuery

      if (!ordersData || ordersData.length === 0) {
        setSnackbar({
          open: true,
          message: 'Keine Bestellungen im Öffnungszeitraum gefunden',
          severity: 'error',
        })
        return
      }

      const orderIds = ordersData.map(o => o.id)
      const { data: itemsData } = await supabase
        .from('order_items')
        .select('*')
        .in('order_id', orderIds)

      const productIds = Array.from(new Set(itemsData?.map(item => item.product_id) || []))
      const { data: productsData } = await supabase
        .from('products')
        .select('*')
        .in('id', productIds)

      const variantIds = itemsData
        ?.map(item => item.variant_id)
        .filter((id): id is string => id !== null) || []
      
      const { data: variantsData } = variantIds.length > 0
        ? await supabase
            .from('product_variants')
            .select('*')
            .in('id', variantIds)
        : { data: null }

      // Lade Produktbilder für Druckdateien und Bilder
      const { data: productImagesData } = await supabase
        .from('product_images')
        .select('product_id, textile_color_name, print_file_url, image_url, image_type')
        .in('product_id', productIds)

      // Erstelle Map: productId -> color -> print file filename
      const printFilesMap = new Map<string, Map<string, string>>()
      productImagesData?.forEach((img) => {
        if (!img.product_id || !img.textile_color_name || !img.print_file_url) return
        
        if (!printFilesMap.has(img.product_id)) {
          printFilesMap.set(img.product_id, new Map())
        }
        const colorMap = printFilesMap.get(img.product_id)!
        
        // Extrahiere Dateinamen aus URL
        const urlParts = img.print_file_url.split('/')
        const filename = urlParts[urlParts.length - 1] || ''
        colorMap.set(img.textile_color_name, filename)
      })

      const productsMap = new Map(productsData?.map(p => [p.id, p]) || [])
      const variantsMap = new Map(variantsData?.map(v => [v.id, v]) || [])
      const ordersMap = new Map(ordersData.map(o => [o.id, o]))

      // Erstelle Analytics-Daten (vereinfachte Version der Analytics-Logik)
      const analyticsMap = new Map<string, any>()
      
      itemsData?.forEach((item) => {
        const product = productsMap.get(item.product_id)
        const variant = item.variant_id ? variantsMap.get(item.variant_id) || null : null
        if (!product) return

        const productId = product.id
        if (!analyticsMap.has(productId)) {
          analyticsMap.set(productId, {
            product: product,
            totalQuantity: 0,
            bySize: new Map(),
            byColor: new Map(),
            bySizeAndColor: new Map(),
            orders: new Set(),
          })
        }

        const analytics = analyticsMap.get(productId)!
        analytics.totalQuantity += item.quantity
        analytics.orders.add(item.order_id)

        // Parse Größe und Farbe
        let size: string | null = null
        let color: string | null = null

        if (variant) {
          if (variant.name && variant.name.trim() && variant.color_name && variant.color_name.trim()) {
            size = variant.name
            color = variant.color_name
          } else if (variant.name && variant.name.includes('/')) {
            const parts = variant.name.split('/').map(s => s.trim())
            if (parts.length >= 2) {
              size = parts[0] || null
              color = parts[1] || null
            }
          } else if (variant.name && variant.name.trim() && !variant.color_name) {
            size = variant.name
          } else if (variant.color_name && variant.color_name.trim()) {
            color = variant.color_name
          }
        }

        if (size) {
          analytics.bySize.set(size, (analytics.bySize.get(size) || 0) + item.quantity)
        }
        if (color) {
          analytics.byColor.set(color, (analytics.byColor.get(color) || 0) + item.quantity)
        }
        if (size && color) {
          if (!analytics.bySizeAndColor.has(size)) {
            analytics.bySizeAndColor.set(size, new Map())
          }
          const colorMap = analytics.bySizeAndColor.get(size)!
          colorMap.set(color, (colorMap.get(color) || 0) + item.quantity)
        }
      })

      const analytics = Array.from(analyticsMap.values()).sort((a, b) =>
        a.product.name.localeCompare(b.product.name)
      )

      // Erstelle Fulfillment-Daten
      const fulfillmentItemsList: any[] = []
      itemsData?.forEach((item) => {
        const product = productsMap.get(item.product_id)
        const variant = item.variant_id ? variantsMap.get(item.variant_id) || null : null
        const order = ordersMap.get(item.order_id)

        if (!product || !order) return

        let size: string | null = null
        let color: string | null = null

        if (variant) {
          if (variant.name && variant.name.trim() && variant.color_name && variant.color_name.trim()) {
            size = variant.name
            color = variant.color_name
          } else if (variant.name && variant.name.includes('/')) {
            const parts = variant.name.split('/').map(s => s.trim())
            if (parts.length >= 2) {
              size = parts[0] || null
              color = parts[1] || null
            }
          } else if (variant.name && variant.name.trim() && !variant.color_name) {
            size = variant.name
          } else if (variant.color_name && variant.color_name.trim()) {
            color = variant.color_name
          }
        }

        for (let i = 0; i < item.quantity; i++) {
          fulfillmentItemsList.push({
            customer_name: order.customer_name,
            customer_email: order.customer_email || null,
            class_name: order.class_name || null,
            product_name: product.name,
            size: size,
            color: color,
            quantity: 1,
            order_id: item.order_id,
          })
        }
      })

      fulfillmentItemsList.sort((a, b) => {
        const nameCompare = a.customer_name.localeCompare(b.customer_name)
        if (nameCompare !== 0) return nameCompare
        const classA = a.class_name || ''
        const classB = b.class_name || ''
        return classA.localeCompare(classB)
      })

      // Importiere ExcelJS dynamisch
      const ExcelJS = (await import('exceljs')).default

      // Erstelle Workbook
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Auswertung')

      // Style-Definitionen (vereinfacht)
      const titleStyle = {
        font: { bold: true, size: 16, color: { argb: 'FF667EEA' } },
        alignment: { horizontal: 'left' as const, vertical: 'middle' as const },
      }

      const productHeaderStyle = {
        font: { bold: true, size: 13, color: { argb: 'FF333333' } },
        fill: {
          type: 'pattern' as const,
          pattern: 'solid' as const,
          fgColor: { argb: 'FFF0F0F0' },
        },
        border: {
          top: { style: 'medium' as const },
          bottom: { style: 'thin' as const },
          left: { style: 'thin' as const },
          right: { style: 'thin' as const },
        },
      }

      const tableHeaderStyle = {
        font: { bold: true, size: 11, color: { argb: 'FFFFFFFF' } },
        fill: {
          type: 'pattern' as const,
          pattern: 'solid' as const,
          fgColor: { argb: 'FF764BA2' },
        },
        alignment: { horizontal: 'center' as const, vertical: 'middle' as const },
        border: {
          top: { style: 'thin' as const },
          bottom: { style: 'thin' as const },
          left: { style: 'thin' as const },
          right: { style: 'thin' as const },
        },
      }

      const totalRowStyle = {
        font: { bold: true, size: 11 },
        fill: {
          type: 'pattern' as const,
          pattern: 'solid' as const,
          fgColor: { argb: 'FFE8E8E8' },
        },
        border: {
          top: { style: 'medium' as const },
          bottom: { style: 'thin' as const },
          left: { style: 'thin' as const },
          right: { style: 'thin' as const },
        },
      }

      const cellStyle = {
        border: {
          top: { style: 'thin' as const },
          bottom: { style: 'thin' as const },
          left: { style: 'thin' as const },
          right: { style: 'thin' as const },
        },
        alignment: { horizontal: 'center' as const, vertical: 'middle' as const },
      }

      let currentRow = 1

      // Header
      const titleRow = worksheet.addRow(['Shop Auswertungsübersicht'])
      titleRow.height = 25
      titleRow.getCell(1).style = titleStyle
      worksheet.mergeCells(currentRow, 1, currentRow, 5)
      currentRow++

      const dateRow = worksheet.addRow([`Erstellt am: ${new Date().toLocaleString('de-DE')}`])
      dateRow.getCell(1).style = {
        font: { italic: true, size: 10, color: { argb: 'FF666666' } },
      }
      worksheet.mergeCells(currentRow, 1, currentRow, 5)
      currentRow++

      worksheet.addRow([])
      currentRow++

      // Helper-Funktionen für Sortierung
      function sortSizes(sizes: string[]): string[] {
        const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'XXXXL']
        return sizes.sort((a, b) => {
          const aIndex = sizeOrder.findIndex(s => s.toUpperCase() === a.toUpperCase())
          const bIndex = sizeOrder.findIndex(s => s.toUpperCase() === b.toUpperCase())
          if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
          if (aIndex !== -1) return -1
          if (bIndex !== -1) return 1
          const aNum = parseInt(a)
          const bNum = parseInt(b)
          if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum
          return a.localeCompare(b)
        })
      }

      function getAllSizes(analytics: any): string[] {
        const sizes = new Set<string>()
        analytics.bySize.forEach((_: any, size: string) => sizes.add(size))
        analytics.bySizeAndColor.forEach((_: any, size: string) => sizes.add(size))
        return sortSizes(Array.from(sizes))
      }

      function getAllColors(analytics: any): string[] {
        const colors = new Set<string>()
        analytics.byColor.forEach((_: any, color: string) => colors.add(color))
        analytics.bySizeAndColor.forEach((colorMap: Map<string, number>) => {
          colorMap.forEach((_: any, color: string) => colors.add(color))
        })
        return Array.from(colors).sort()
      }

      // Produkte
      analytics.forEach((productAnalytics: any, productIndex: number) => {
        const productNameRow = worksheet.addRow([`Produkt: ${productAnalytics.product.name}`])
        productNameRow.height = 22
        productNameRow.getCell(1).style = productHeaderStyle
        worksheet.mergeCells(currentRow, 1, currentRow, 5)
        currentRow++

        const infoRow = worksheet.addRow([
          `Gesamtmenge: ${productAnalytics.totalQuantity} Stück`,
        ])
        infoRow.getCell(1).style = {
          font: { size: 10, color: { argb: 'FF666666' } },
        }
        worksheet.mergeCells(currentRow, 1, currentRow, 5)
        currentRow++

        worksheet.addRow([])
        currentRow++

        const sizes = getAllSizes(productAnalytics)
        const colors = getAllColors(productAnalytics)
        const hasSizeAndColor = sizes.length > 0 && colors.length > 0

        if (hasSizeAndColor) {
          const colorPrintFilesMap = printFilesMap.get(productAnalytics.product.id)
          const headerRow = worksheet.addRow(['Größe', ...colors, 'Gesamt'])
          headerRow.height = 20
          headerRow.eachCell((cell) => {
            cell.style = tableHeaderStyle
          })
          currentRow++
          
          // Zweite Header-Zeile mit Druckdatei-Dateinamen
          const printFileRowData = ['']
          colors.forEach((color) => {
            const printFileName = colorPrintFilesMap?.get(color) || ''
            printFileRowData.push(printFileName)
          })
          printFileRowData.push('')
          const printFileHeaderRow = worksheet.addRow(printFileRowData)
          printFileHeaderRow.height = 18
          printFileHeaderRow.eachCell((cell, colNumber) => {
            cell.style = {
              font: { bold: true, size: 9, italic: true, color: { argb: 'FFFFFFFF' } },
              fill: {
                type: 'pattern' as const,
                pattern: 'solid' as const,
                fgColor: { argb: 'FF764BA2' },
              },
              alignment: { horizontal: 'center' as const, vertical: 'middle' as const },
              border: {
                top: { style: 'thin' as const },
                bottom: { style: 'thin' as const },
                left: { style: 'thin' as const },
                right: { style: 'thin' as const },
              },
            }
            if (colNumber === 1) {
              cell.value = 'Druckdatei'
            }
          })
          currentRow++

          sizes.forEach((size) => {
            const colorMap = productAnalytics.bySizeAndColor.get(size) || new Map()
            const sizeTotal = productAnalytics.bySize.get(size) || 0
            const rowData = [size]

            colors.forEach((color) => {
              const quantity = colorMap.get(color) || 0
              rowData.push(quantity > 0 ? quantity : '')
            })

            rowData.push(sizeTotal)
            const dataRow = worksheet.addRow(rowData)
            dataRow.height = 18
            dataRow.eachCell((cell, colNumber) => {
              cell.style = cellStyle
              if (colNumber === 1) {
                cell.style.alignment = { horizontal: 'left', vertical: 'middle' }
              } else if (typeof cell.value === 'number') {
                cell.style.alignment = { horizontal: 'right', vertical: 'middle' }
              }
            })
            currentRow++
          })

          const totalRowData = ['Gesamt']
          colors.forEach((color) => {
            const colorTotal = productAnalytics.byColor.get(color) || 0
            totalRowData.push(colorTotal > 0 ? colorTotal : '')
          })
          totalRowData.push(productAnalytics.totalQuantity)

          const totalRow = worksheet.addRow(totalRowData)
          totalRow.height = 20
          totalRow.eachCell((cell, colNumber) => {
            cell.style = totalRowStyle
            if (colNumber === 1) {
              cell.style.alignment = { horizontal: 'left', vertical: 'middle' }
            } else if (typeof cell.value === 'number') {
              cell.style.alignment = { horizontal: 'right', vertical: 'middle' }
            }
          })
          currentRow++
        } else if (sizes.length > 0) {
          const headerRow = worksheet.addRow(['Größe', 'Menge'])
          headerRow.height = 20
          headerRow.eachCell((cell) => {
            cell.style = tableHeaderStyle
          })
          currentRow++

          sizes.forEach((size) => {
            const dataRow = worksheet.addRow([size, productAnalytics.bySize.get(size) || 0])
            dataRow.height = 18
            dataRow.eachCell((cell, colNumber) => {
              cell.style = cellStyle
              if (colNumber === 1) {
                cell.style.alignment = { horizontal: 'left', vertical: 'middle' }
              } else {
                cell.style.alignment = { horizontal: 'right', vertical: 'middle' }
              }
            })
            currentRow++
          })

          const totalRow = worksheet.addRow(['Gesamt', productAnalytics.totalQuantity])
          totalRow.height = 20
          totalRow.eachCell((cell, colNumber) => {
            cell.style = totalRowStyle
            if (colNumber === 1) {
              cell.style.alignment = { horizontal: 'left', vertical: 'middle' }
            } else {
              cell.style.alignment = { horizontal: 'right', vertical: 'middle' }
            }
          })
          currentRow++
        } else if (colors.length > 0) {
          const headerRow = worksheet.addRow(['Farbe', 'Menge', 'Druckdatei'])
          headerRow.height = 20
          headerRow.eachCell((cell) => {
            cell.style = tableHeaderStyle
          })
          currentRow++

          colors.forEach((color) => {
            // Hole Druckdatei-Dateinamen für diese Farbe
            const colorPrintFilesMap = printFilesMap.get(productAnalytics.product.id)
            const printFileName = colorPrintFilesMap?.get(color) || ''
            
            const dataRow = worksheet.addRow([color, productAnalytics.byColor.get(color) || 0, printFileName])
            dataRow.height = 18
            dataRow.eachCell((cell, colNumber) => {
              cell.style = cellStyle
              if (colNumber === 1) {
                cell.style.alignment = { horizontal: 'left', vertical: 'middle' }
              } else {
                cell.style.alignment = { horizontal: 'right', vertical: 'middle' }
              }
            })
            currentRow++
          })

          const totalRow = worksheet.addRow(['Gesamt', productAnalytics.totalQuantity])
          totalRow.height = 20
          totalRow.eachCell((cell, colNumber) => {
            cell.style = totalRowStyle
            if (colNumber === 1) {
              cell.style.alignment = { horizontal: 'left', vertical: 'middle' }
            } else {
              cell.style.alignment = { horizontal: 'right', vertical: 'middle' }
            }
          })
          currentRow++
        } else {
          const infoRow = worksheet.addRow(['Keine Varianten-Informationen verfügbar'])
          infoRow.getCell(1).style = {
            font: { italic: true, size: 10, color: { argb: 'FF999999' } },
            alignment: { horizontal: 'left', vertical: 'middle' },
          }
          worksheet.mergeCells(currentRow, 1, currentRow, 5)
          currentRow++
        }

        if (productIndex < analytics.length - 1) {
          worksheet.addRow([])
          currentRow++
          worksheet.addRow([])
          currentRow++
        }
      })

      worksheet.columns.forEach((column, index) => {
        if (index === 0) {
          column.width = 20
        } else {
          column.width = 12
        }
      })

      // Auswertung nach Druckdateien (rechts im Worksheet)
      const printFileStartColumn = 7 // Spalte G
      let printFileRow = 1

      // Sammle Daten nach Druckdateien
      const printFileAnalytics = new Map<string, Array<{
        productName: string
        color: string
        quantity: number
      }>>()

      analytics.forEach((productAnalytics: any) => {
        const colors = getAllColors(productAnalytics)
        const colorPrintFilesMap = printFilesMap.get(productAnalytics.product.id)
        
        colors.forEach((color) => {
          const printFileName = colorPrintFilesMap?.get(color) || ''
          if (!printFileName) return // Überspringe Farben ohne Druckdatei
          
          const quantity = productAnalytics.byColor.get(color) || 0
          if (quantity === 0) return // Überspringe Farben ohne Menge
          
          if (!printFileAnalytics.has(printFileName)) {
            printFileAnalytics.set(printFileName, [])
          }
          
          printFileAnalytics.get(printFileName)!.push({
            productName: productAnalytics.product.name,
            color: color,
            quantity: quantity
          })
        })
      })

      // Sortiere Druckdateien alphabetisch
      const sortedPrintFiles = Array.from(printFileAnalytics.entries()).sort((a, b) => 
        a[0].localeCompare(b[0])
      )

      // Header für Druckdatei-Auswertung
      const printFileTitleRow = worksheet.getRow(printFileRow)
      printFileTitleRow.getCell(printFileStartColumn).value = 'Auswertung nach Druckdateien'
      printFileTitleRow.getCell(printFileStartColumn).style = titleStyle
      worksheet.mergeCells(printFileRow, printFileStartColumn, printFileRow, printFileStartColumn + 3)
      printFileRow++

      const printFileDateRow = worksheet.getRow(printFileRow)
      printFileDateRow.getCell(printFileStartColumn).value = `Erstellt am: ${new Date().toLocaleString('de-DE')}`
      printFileDateRow.getCell(printFileStartColumn).style = {
        font: { italic: true, size: 10, color: { argb: 'FF666666' } },
      }
      worksheet.mergeCells(printFileRow, printFileStartColumn, printFileRow, printFileStartColumn + 3)
      printFileRow++

      printFileRow++ // Leerzeile

      // Header für Tabelle
      const printFileHeaderRow = worksheet.getRow(printFileRow)
      printFileHeaderRow.getCell(printFileStartColumn).value = 'Druckdatei'
      printFileHeaderRow.getCell(printFileStartColumn + 1).value = 'Produkt'
      printFileHeaderRow.getCell(printFileStartColumn + 2).value = 'Farbe'
      printFileHeaderRow.getCell(printFileStartColumn + 3).value = 'Menge'
      printFileHeaderRow.height = 20
      for (let col = printFileStartColumn; col <= printFileStartColumn + 3; col++) {
        const cell = printFileHeaderRow.getCell(col)
        cell.style = tableHeaderStyle
      }
      printFileRow++

      // Daten für jede Druckdatei
      sortedPrintFiles.forEach(([printFileName, items]) => {
        // Sortiere Items nach Produktname und dann nach Farbe
        items.sort((a, b) => {
          const productCompare = a.productName.localeCompare(b.productName)
          if (productCompare !== 0) return productCompare
          return a.color.localeCompare(b.color)
        })

        let printFileTotal = 0

        items.forEach((item, index) => {
          const dataRow = worksheet.getRow(printFileRow)
          
          // Druckdatei-Name nur in der ersten Zeile
          if (index === 0) {
            dataRow.getCell(printFileStartColumn).value = printFileName
            dataRow.getCell(printFileStartColumn).style = {
              ...productHeaderStyle,
              alignment: { horizontal: 'left' as const, vertical: 'middle' as const },
            }
          }
          
          dataRow.getCell(printFileStartColumn + 1).value = item.productName
          dataRow.getCell(printFileStartColumn + 2).value = item.color
          dataRow.getCell(printFileStartColumn + 3).value = item.quantity
          
          dataRow.height = 18
          
          // Style für alle Zellen
          for (let col = printFileStartColumn; col <= printFileStartColumn + 3; col++) {
            const cell = dataRow.getCell(col)
            if (col === printFileStartColumn && index === 0) {
              // Bereits oben gesetzt
            } else {
              cell.style = cellStyle
              if (col === printFileStartColumn + 1 || col === printFileStartColumn + 2) {
                cell.style.alignment = { horizontal: 'left', vertical: 'middle' }
              } else if (col === printFileStartColumn + 3) {
                cell.style.alignment = { horizontal: 'right', vertical: 'middle' }
              }
            }
          }
          
          printFileTotal += item.quantity
          printFileRow++
        })

        // Gesamtzeile für diese Druckdatei
        const totalRow = worksheet.getRow(printFileRow)
        totalRow.getCell(printFileStartColumn).value = 'Gesamt'
        totalRow.getCell(printFileStartColumn + 3).value = printFileTotal
        totalRow.height = 20
        
        for (let col = printFileStartColumn; col <= printFileStartColumn + 3; col++) {
          const cell = totalRow.getCell(col)
          cell.style = totalRowStyle
          if (col === printFileStartColumn) {
            cell.style.alignment = { horizontal: 'left', vertical: 'middle' }
          } else if (col === printFileStartColumn + 3) {
            cell.style.alignment = { horizontal: 'right', vertical: 'middle' }
          } else {
            cell.style.fill = {
              type: 'pattern' as const,
              pattern: 'solid' as const,
              fgColor: { argb: 'FFE8E8E8' },
            }
          }
        }
        
        printFileRow++
        printFileRow++ // Leerzeile zwischen Druckdateien
      })

      // Setze Spaltenbreiten für Druckdatei-Auswertung
      worksheet.getColumn(printFileStartColumn).width = 30 // Druckdatei
      worksheet.getColumn(printFileStartColumn + 1).width = 20 // Produkt
      worksheet.getColumn(printFileStartColumn + 2).width = 15 // Farbe
      worksheet.getColumn(printFileStartColumn + 3).width = 12 // Menge

      // Fulfillment Worksheet
      const fulfillmentWorksheet = workbook.addWorksheet('Fulfillment')
      let fulfillmentRow = 1

      const fulfillmentTitleRow = fulfillmentWorksheet.addRow(['Fulfillment - Zuordnung Person zu Produkten'])
      fulfillmentTitleRow.height = 25
      fulfillmentTitleRow.getCell(1).style = titleStyle
      fulfillmentWorksheet.mergeCells(fulfillmentRow, 1, fulfillmentRow, 5)
      fulfillmentRow++

      const fulfillmentDateRow = fulfillmentWorksheet.addRow([`Erstellt am: ${new Date().toLocaleString('de-DE')}`])
      fulfillmentDateRow.getCell(1).style = {
        font: { italic: true, size: 10, color: { argb: 'FF666666' } },
      }
      fulfillmentWorksheet.mergeCells(fulfillmentRow, 1, fulfillmentRow, 5)
      fulfillmentRow++

      fulfillmentWorksheet.addRow([])
      fulfillmentRow++

      const fulfillmentHeaderRow = fulfillmentWorksheet.addRow([
        'Name',
        'Klasse',
        'Produkt',
        'Größe',
        'Farbe',
      ])
      fulfillmentHeaderRow.height = 20
      fulfillmentHeaderRow.eachCell((cell) => {
        cell.style = tableHeaderStyle
      })
      fulfillmentRow++

      const groupedByCustomer = new Map<string, any[]>()
      fulfillmentItemsList.forEach((item) => {
        const key = `${item.customer_name}|${item.class_name || ''}`
        if (!groupedByCustomer.has(key)) {
          groupedByCustomer.set(key, [])
        }
        groupedByCustomer.get(key)!.push(item)
      })

      groupedByCustomer.forEach((items) => {
        const firstItem = items[0]
        const customerName = firstItem.customer_name
        const className = firstItem.class_name || ''

        const personHeaderRow = fulfillmentWorksheet.addRow([
          customerName,
          className,
          '',
          '',
          '',
        ])
        personHeaderRow.height = 22
        personHeaderRow.eachCell((cell, colNumber) => {
          if (colNumber <= 2) {
            cell.style = productHeaderStyle
          } else {
            cell.style = {
              fill: {
                type: 'pattern' as const,
                pattern: 'solid' as const,
                fgColor: { argb: 'FFF0F0F0' },
              },
              border: {
                top: { style: 'thin' as const },
                bottom: { style: 'thin' as const },
                left: { style: 'thin' as const },
                right: { style: 'thin' as const },
              },
            }
          }
        })
        fulfillmentRow++

        items.forEach((item) => {
          const productRow = fulfillmentWorksheet.addRow([
            '',
            '',
            item.product_name,
            item.size || '-',
            item.color || '-',
          ])
          productRow.height = 18
          productRow.eachCell((cell, colNumber) => {
            cell.style = cellStyle
            if (colNumber <= 2) {
              cell.style.fill = {
                type: 'pattern' as const,
                pattern: 'solid' as const,
                fgColor: { argb: 'FFF9F9F9' },
              }
            } else if (colNumber === 3) {
              cell.style.alignment = { horizontal: 'left', vertical: 'middle' }
            } else {
              cell.style.alignment = { horizontal: 'center', vertical: 'middle' }
            }
          })
          fulfillmentRow++
        })

        fulfillmentWorksheet.addRow([])
        fulfillmentRow++
      })

      fulfillmentWorksheet.columns = [
        { width: 25 },
        { width: 12 },
        { width: 25 },
        { width: 10 },
        { width: 15 },
      ]

      // Validierung
      const totalFromAnalytics = analytics.reduce((sum: number, productAnalytics: any) => sum + productAnalytics.totalQuantity, 0)
      const totalFromFulfillment = fulfillmentItemsList.length

      fulfillmentRow++
      fulfillmentWorksheet.addRow([])
      fulfillmentRow++

      const validationRow = fulfillmentWorksheet.addRow([
        'VALIDIERUNG',
        '',
        '',
        '',
        '',
      ])
      validationRow.height = 20
      validationRow.getCell(1).style = {
        font: { bold: true, size: 11, color: { argb: 'FFFFFFFF' } },
        fill: {
          type: 'pattern' as const,
          pattern: 'solid' as const,
          fgColor: { argb: totalFromAnalytics === totalFromFulfillment ? 'FF10B981' : 'FFEF4444' },
        },
        alignment: { horizontal: 'left', vertical: 'middle' },
        border: {
          top: { style: 'medium' as const },
          bottom: { style: 'thin' as const },
          left: { style: 'thin' as const },
          right: { style: 'thin' as const },
        },
      }
      fulfillmentWorksheet.mergeCells(fulfillmentRow, 1, fulfillmentRow, 5)
      fulfillmentRow++

      const validationDetailsRow = fulfillmentWorksheet.addRow([
        `Gesamtmenge Blatt 1 (Auswertung): ${totalFromAnalytics} Stück`,
        '',
        '',
        '',
        '',
      ])
      validationDetailsRow.getCell(1).style = {
        font: { size: 10 },
        alignment: { horizontal: 'left', vertical: 'middle' },
      }
      fulfillmentWorksheet.mergeCells(fulfillmentRow, 1, fulfillmentRow, 5)
      fulfillmentRow++

      const validationDetailsRow2 = fulfillmentWorksheet.addRow([
        `Gesamtmenge Blatt 2 (Fulfillment): ${totalFromFulfillment} Stück`,
        '',
        '',
        '',
        '',
      ])
      validationDetailsRow2.getCell(1).style = {
        font: { size: 10 },
        alignment: { horizontal: 'left', vertical: 'middle' },
      }
      fulfillmentWorksheet.mergeCells(fulfillmentRow, 1, fulfillmentRow, 5)
      fulfillmentRow++

      const validationStatusRow = fulfillmentWorksheet.addRow([
        totalFromAnalytics === totalFromFulfillment
          ? `✓ Übereinstimmung: Beide Blätter enthalten ${totalFromAnalytics} Artikel`
          : `⚠ FEHLER: Differenz von ${Math.abs(totalFromAnalytics - totalFromFulfillment)} Artikel!`,
        '',
        '',
        '',
        '',
      ])
      validationStatusRow.getCell(1).style = {
        font: { 
          bold: true, 
          size: 11, 
          color: { argb: totalFromAnalytics === totalFromFulfillment ? 'FF10B981' : 'FFEF4444' } 
        },
        alignment: { horizontal: 'left', vertical: 'middle' },
      }
      fulfillmentWorksheet.mergeCells(fulfillmentRow, 1, fulfillmentRow, 5)
      fulfillmentRow++

      // Importiere JSZip dynamisch
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()
      const shopSlug = lastShop?.slug || 'shop'

      // Füge Excel-Datei zur ZIP hinzu
      const excelBuffer = await workbook.xlsx.writeBuffer()
      const excelFileName = `shop-auswertung-${lastShop.id}-${new Date().toISOString().split('T')[0]}.xlsx`
      zip.file(excelFileName, excelBuffer)

      // Sammle alle eindeutigen Druckdateien und Produktbilder
      const zipPrintFilesSet = new Set<string>()
      const zipImageFilesSet = new Set<string>()
      const zipPrintFilesMap = new Map<string, { url: string; filename: string }>()
      const zipImageFilesMap = new Map<string, { url: string; filename: string; productId: string }>()

      // Normalisiere Produktnamen für Ordnerstruktur
      const normalizeForFolder = (value: string | null | undefined, fallback = 'produkt'): string => {
        return (value || fallback)
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '_')
          .replace(/_+/g, '_')
          .replace(/^_|_$/g, '') || fallback
      }

      const productNamesMap = new Map<string, string>()
      productsData?.forEach((product) => {
        productNamesMap.set(product.id, normalizeForFolder(product.name))
      })

      productImagesData?.forEach((img) => {
        if (img.print_file_url) {
          const urlParts = img.print_file_url.split('/')
          const filename = urlParts[urlParts.length - 1] || ''
          const key = `${img.product_id}_${img.textile_color_name}_${img.image_type}_print`
          if (!zipPrintFilesSet.has(key)) {
            zipPrintFilesSet.add(key)
            zipPrintFilesMap.set(key, { url: img.print_file_url, filename })
          }
        }
        if (img.image_url) {
          const urlParts = img.image_url.split('/')
          const filename = urlParts[urlParts.length - 1] || ''
          const key = `${img.product_id}_${img.textile_color_name}_${img.image_type}_image`
          if (!zipImageFilesSet.has(key)) {
            zipImageFilesSet.add(key)
            zipImageFilesMap.set(key, { url: img.image_url, filename, productId: img.product_id })
          }
        }
      })

      // Lade Druckdateien herunter und füge sie zur ZIP hinzu
      for (const [key, fileInfo] of zipPrintFilesMap.entries()) {
        try {
          // Parse Storage URL
          const urlObj = new URL(fileInfo.url)
          const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/(public|sign)\/([^\/]+)\/(.+)/)
          
          if (pathMatch) {
            const bucket = pathMatch[2]
            const path = decodeURIComponent(pathMatch[3])
            
            const { data, error } = await supabase.storage
              .from(bucket)
              .download(path)

            if (!error && data) {
              const arrayBuffer = await data.arrayBuffer()
              zip.file(`druckdateien/${fileInfo.filename}`, arrayBuffer)
            }
          }
        } catch (error) {
          console.error(`Fehler beim Herunterladen der Druckdatei ${fileInfo.filename}:`, error)
        }
      }

      // Lade Produktbilder herunter und füge sie zur ZIP hinzu (nach Produkten sortiert)
      for (const [key, fileInfo] of zipImageFilesMap.entries()) {
        try {
          // Parse Storage URL
          const urlObj = new URL(fileInfo.url)
          const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/(public|sign)\/([^\/]+)\/(.+)/)
          
          if (pathMatch) {
            const bucket = pathMatch[2]
            const path = decodeURIComponent(pathMatch[3])
            
            const { data, error } = await supabase.storage
              .from(bucket)
              .download(path)

            if (!error && data) {
              const arrayBuffer = await data.arrayBuffer()
              // Organisiere nach Produktnamen
              const productFolderName = productNamesMap.get(fileInfo.productId) || 'unbekannt'
              zip.file(`produktbilder/${productFolderName}/${fileInfo.filename}`, arrayBuffer)
            }
          }
        } catch (error) {
          console.error(`Fehler beim Herunterladen des Produktbildes ${fileInfo.filename}:`, error)
        }
      }

      // Erstelle ZIP-Datei
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const dateStr = new Date().toISOString().split('T')[0]
      const zipFileName = `shop_${shopSlug}_${dateStr}.zip`
      
      const url = window.URL.createObjectURL(zipBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = zipFileName
      link.click()
      window.URL.revokeObjectURL(url)

      setSnackbar({
        open: true,
        message: 'Auswertung erfolgreich exportiert',
        severity: 'success',
      })
    } catch (error: any) {
      console.error('Error exporting analytics:', error)
      setSnackbar({
        open: true,
        message: error?.message || 'Fehler beim Exportieren der Auswertung',
        severity: 'error',
      })
    } finally {
      setExportingAnalytics(false)
    }
  }

  async function handleSendNotification(type: 'shop_closed' | 'shipping') {
    if (!school) return

    setSendingNotification(type)
    try {
      // TODO: Implementiere Email-Versand
      // Hier würde die Email-Logik eingefügt werden
      await new Promise(resolve => setTimeout(resolve, 1000)) // Simuliere API-Call

      setSnackbar({
        open: true,
        message: type === 'shop_closed' 
          ? 'Benachrichtigung "Shop geschlossen" wurde gesendet'
          : 'Benachrichtigung "Versand" wurde gesendet',
        severity: 'success',
      })
    } catch (error: any) {
      console.error('Error sending notification:', error)
      setSnackbar({
        open: true,
        message: error?.message || 'Fehler beim Senden der Benachrichtigung',
        severity: 'error',
      })
    } finally {
      setSendingNotification(null)
    }
  }

  function getShopTimeStatus(shop: Shop): { status: 'open' | 'closed' | 'upcoming' | 'none'; message?: string } {
    const now = new Date()
    const openAt = shop.shop_open_at ? new Date(shop.shop_open_at) : null
    const closeAt = shop.shop_close_at ? new Date(shop.shop_close_at) : null

    if (!openAt && !closeAt) {
      return { status: 'none' }
    }

    if (openAt && now < openAt) {
      return { status: 'upcoming', message: 'Öffnet bald' }
    }

    if (closeAt && now > closeAt) {
      return { status: 'closed', message: 'Geschlossen' }
    }

    if (openAt && closeAt && now >= openAt && now <= closeAt) {
      return { status: 'open', message: 'Geöffnet' }
    }

    return { status: 'none' }
  }

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="h6" color="text.secondary">Lade Schule...</Typography>
      </Box>
    )
  }

  if (!school) {
    return (
      <Box sx={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="h6" color="text.secondary">Schule nicht gefunden</Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ minHeight: '100vh', background: '#f8fafc' }}>
      <Container maxWidth="xl" sx={{ py: 6 }}>
        <Box sx={{ mb: 5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: 3,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <SchoolIcon sx={{ fontSize: 32, color: 'white' }} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography 
                variant="h3" 
                component="h1"
                sx={{ 
                  fontWeight: 700,
                  mb: 0.5,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                {school.name}
              </Typography>
              {school.short_code && (
                <Typography 
                  variant="body1" 
                  sx={{ 
                    color: 'text.secondary',
                    fontWeight: 500,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  {school.short_code}
                </Typography>
              )}
              {school.city && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  📍 {school.city}, {school.country}
                </Typography>
              )}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <TextField
                select
                label="Status"
                value={school.status}
                onChange={(e) => handleStatusChange(e.target.value as 'lead' | 'active' | 'production' | 'existing')}
                disabled={updatingStatus}
                size="small"
                sx={{
                  minWidth: 150,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                  },
                }}
              >
                <MenuItem value="lead">Lead</MenuItem>
                <MenuItem value="active">Aktiv</MenuItem>
                <MenuItem value="production">Produktion</MenuItem>
                <MenuItem value="existing">Bestand</MenuItem>
              </TextField>
              {updatingStatus && <CircularProgress size={20} />}
            </Box>
          </Box>
        </Box>

        {/* Produktion-Aktionen */}
        {school.status === 'production' && (
          <Card sx={{ mb: 3, background: 'linear-gradient(135deg, #667eea15 0%, #764ba215 100%)', border: '1px solid', borderColor: 'primary.main' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Produktion-Aktionen
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  startIcon={exportingAnalytics ? <CircularProgress size={20} /> : <DownloadIcon />}
                  onClick={handleExportLastShopAnalytics}
                  disabled={exportingAnalytics}
                >
                  {exportingAnalytics ? 'Exportiere...' : 'Auswertung exportieren'}
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<SendIcon />}
                  onClick={() => handleSendNotification('shop_closed')}
                  disabled={sendingNotification !== null}
                >
                  {sendingNotification === 'shop_closed' ? <CircularProgress size={20} /> : 'Benachrichtigung Produktion'}
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<LocalShippingIcon />}
                  onClick={() => handleSendNotification('shipping')}
                  disabled={sendingNotification !== null}
                >
                  {sendingNotification === 'shipping' ? <CircularProgress size={20} /> : 'Benachrichtigung Versand'}
                </Button>
                <Button
                  variant="contained"
                  color="success"
                  onClick={() => handleStatusChange('existing')}
                  disabled={updatingStatus}
                >
                  Zu Bestand verschieben
                </Button>
              </Box>
            </CardContent>
          </Card>
        )}

      <Grid container spacing={3}>
        {/* Shops Spalte */}
        <Grid item xs={12} lg={6}>
          <Card sx={{ background: 'white', height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: 2,
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <StoreIcon sx={{ color: 'white', fontSize: 20 }} />
                  </Box>
                  <Typography variant="h5" component="h2" sx={{ fontWeight: 600 }}>
                    Shops
                  </Typography>
                </Box>
                <Fab
                  color="primary"
                  size="small"
                  aria-label="add shop"
                  onClick={() => router.push(`/schools/${school.id}/shops/new`)}
                >
                  <AddIcon />
                </Fab>
              </Box>

              {shops.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 6 }}>
                  <Box
                    sx={{
                      width: 64,
                      height: 64,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #667eea20 0%, #764ba220 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mx: 'auto',
                      mb: 2,
                    }}
                  >
                    <StoreIcon sx={{ fontSize: 32, color: 'text.secondary' }} />
                  </Box>
                  <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 600, mb: 1 }}>
                    Noch keine Shops vorhanden
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => router.push(`/schools/${school.id}/shops/new`)}
                    sx={{ mt: 2 }}
                  >
                    Ersten Shop erstellen
                  </Button>
                </Box>
              ) : (
                <TableContainer sx={{ borderRadius: 2, border: '1px solid rgba(0, 0, 0, 0.05)' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ background: '#f8fafc' }}>
                        <TableCell sx={{ fontWeight: 600, py: 2 }}>Name</TableCell>
                        <TableCell sx={{ fontWeight: 600, py: 2 }}>Status</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600, py: 2 }}>Aktionen</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {shops.map((shop) => (
                        <TableRow
                          key={shop.id}
                          sx={{ 
                            cursor: 'pointer',
                            '&:hover': {
                              background: '#f8fafc',
                            },
                            transition: 'background 0.2s ease-in-out',
                          }}
                          onClick={() => router.push(`/shops/${shop.id}`)}
                          hover
                        >
                          <TableCell>
                            <Typography variant="body2" fontWeight="medium">
                              {shop.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {shop.slug}
                            </Typography>
                            {(shop.shop_open_at || shop.shop_close_at) && (
                              <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                {(() => {
                                  const timeStatus = getShopTimeStatus(shop)
                                  if (timeStatus.status !== 'none' && timeStatus.message) {
                                    return (
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                                        <AccessTimeIcon 
                                          sx={{ 
                                            fontSize: 14, 
                                            color: timeStatus.status === 'open' 
                                              ? 'success.main' 
                                              : timeStatus.status === 'closed' 
                                              ? 'error.main' 
                                              : 'warning.main' 
                                          }} 
                                        />
                                        <Typography 
                                          variant="caption" 
                                          sx={{ 
                                            color: timeStatus.status === 'open' 
                                              ? 'success.main' 
                                              : timeStatus.status === 'closed' 
                                              ? 'error.main' 
                                              : 'warning.main',
                                            fontWeight: 'medium'
                                          }}
                                        >
                                          {timeStatus.message}
                                        </Typography>
                                      </Box>
                                    )
                                  }
                                  return null
                                })()}
                                {shop.shop_open_at && (
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <CalendarTodayIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                                    <Typography variant="caption" color="text.secondary">
                                      Öffnung: {formatDateTime(shop.shop_open_at)}
                                    </Typography>
                                  </Box>
                                )}
                                {shop.shop_close_at && (
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <CalendarTodayIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                                    <Typography variant="caption" color="text.secondary">
                                      Schließung: {formatDateTime(shop.shop_close_at)}
                                    </Typography>
                                  </Box>
                                )}
                              </Box>
                            )}
                          </TableCell>
                          <TableCell sx={{ py: 2 }}>
                            <Chip
                              label={shop.status}
                              color={getShopStatusColor(shop.status) as any}
                              size="small"
                              sx={{ 
                                fontWeight: 500,
                                background: shop.status === 'live'
                                  ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                                  : shop.status === 'closed'
                                  ? 'linear-gradient(135deg, #64748b 0%, #475569 100%)'
                                  : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                                color: 'white',
                              }}
                            />
                          </TableCell>
                          <TableCell align="right" sx={{ py: 2 }}>
                            <Button
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation()
                                router.push(`/shops/${shop.id}`)
                              }}
                              sx={{
                                textTransform: 'none',
                                fontWeight: 500,
                                borderRadius: 2,
                              }}
                            >
                              Öffnen
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* CRM Spalte */}
        <Grid item xs={12} lg={6}>
          <Card sx={{ background: 'white', height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: 2,
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <ContactMailIcon sx={{ color: 'white', fontSize: 20 }} />
                  </Box>
                  <Typography variant="h5" component="h2" sx={{ fontWeight: 600 }}>
                    Ansprechpartner & Kontaktdaten
                  </Typography>
                </Box>
                <Fab
                  color="primary"
                  size="small"
                  aria-label="add contact"
                  onClick={() => handleOpenContactDialog()}
                >
                  <AddIcon />
                </Fab>
              </Box>

              {contacts.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 6 }}>
                  <Box
                    sx={{
                      width: 64,
                      height: 64,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #667eea20 0%, #764ba220 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mx: 'auto',
                      mb: 2,
                    }}
                  >
                    <ContactMailIcon sx={{ fontSize: 32, color: 'text.secondary' }} />
                  </Box>
                  <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 600, mb: 1 }}>
                    Noch keine Kontakte vorhanden
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => handleOpenContactDialog()}
                    sx={{ mt: 2 }}
                  >
                    Ersten Kontakt hinzufügen
                  </Button>
                </Box>
              ) : (
                <Box sx={{ maxHeight: '600px', overflowY: 'auto' }}>
                  <Grid container spacing={2}>
                    {contacts.map((contact) => (
                      <Grid item xs={12} key={contact.id}>
                        <Card 
                          variant="outlined"
                          sx={{
                            background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                            border: '1px solid rgba(0, 0, 0, 0.05)',
                          }}
                        >
                          <CardContent sx={{ p: 2.5 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                                <PersonIcon color="primary" />
                                <Box sx={{ flex: 1 }}>
                                  <Typography variant="subtitle1" fontWeight="medium">
                                    {contact.first_name} {contact.last_name}
                                  </Typography>
                                  {contact.title && (
                                    <Typography variant="body2" color="text.secondary">
                                      {contact.title}
                                    </Typography>
                                  )}
                                  {contact.role && (
                                    <Chip label={contact.role} size="small" sx={{ mt: 0.5 }} />
                                  )}
                                </Box>
                              </Box>
                              <Box>
                                <IconButton
                                  size="small"
                                  onClick={() => handleOpenContactDialog(contact)}
                                  sx={{ mr: 0.5 }}
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  onClick={() => handleDeleteContact(contact.id)}
                                  color="error"
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Box>
                            </Box>

                            <Box sx={{ mt: 2 }}>
                              {contact.email && (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                  <EmailIcon fontSize="small" color="action" />
                                  <Typography variant="body2">
                                    <a href={`mailto:${contact.email}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                                      {contact.email}
                                    </a>
                                  </Typography>
                                </Box>
                              )}
                              {contact.phone && (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                  <PhoneIcon fontSize="small" color="action" />
                                  <Typography variant="body2">
                                    <a href={`tel:${contact.phone}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                                      {contact.phone}
                                    </a>
                                  </Typography>
                                </Box>
                              )}
                              {contact.mobile && (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                  <PhoneIcon fontSize="small" color="action" />
                                  <Typography variant="body2">
                                    <a href={`tel:${contact.mobile}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                                      Mobil: {contact.mobile}
                                    </a>
                                  </Typography>
                                </Box>
                              )}
                              {contact.notes && (
                                <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                                  <Typography variant="body2" color="text.secondary">
                                    {contact.notes}
                                  </Typography>
                                </Box>
                              )}
                            </Box>
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Dialog open={contactDialogOpen} onClose={handleCloseContactDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingContact ? 'Kontakt bearbeiten' : 'Neuen Kontakt hinzufügen'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Vorname"
                value={contactForm.first_name}
                onChange={(e) => setContactForm({ ...contactForm, first_name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Nachname"
                value={contactForm.last_name}
                onChange={(e) => setContactForm({ ...contactForm, last_name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Titel"
                value={contactForm.title}
                onChange={(e) => setContactForm({ ...contactForm, title: e.target.value })}
                placeholder="z.B. Schulleiter, Sekretärin"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Rolle"
                value={contactForm.role}
                onChange={(e) => setContactForm({ ...contactForm, role: e.target.value })}
                select
                SelectProps={{ native: false }}
              >
                <MenuItem value="">Keine</MenuItem>
                <MenuItem value="Schulleitung">Schulleitung</MenuItem>
                <MenuItem value="Verwaltung">Verwaltung</MenuItem>
                <MenuItem value="IT">IT</MenuItem>
                <MenuItem value="Finanzen">Finanzen</MenuItem>
                <MenuItem value="Sonstiges">Sonstiges</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="E-Mail"
                type="email"
                value={contactForm.email}
                onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Telefon"
                value={contactForm.phone}
                onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Mobil"
                value={contactForm.mobile}
                onChange={(e) => setContactForm({ ...contactForm, mobile: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notizen"
                value={contactForm.notes}
                onChange={(e) => setContactForm({ ...contactForm, notes: e.target.value })}
                multiline
                rows={3}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseContactDialog} disabled={savingContact}>
            Abbrechen
          </Button>
          <Button
            onClick={handleSaveContact}
            variant="contained"
            disabled={!contactForm.first_name.trim() || !contactForm.last_name.trim() || savingContact}
            startIcon={savingContact ? <CircularProgress size={20} /> : null}
          >
            {savingContact ? 'Speichere...' : 'Speichern'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Notes/Tasks Timeline */}
      <Box sx={{ mt: 4 }}>
        <Card sx={{ background: 'white' }}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 2,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <NoteIcon sx={{ color: 'white', fontSize: 20 }} />
                </Box>
                <Typography variant="h5" component="h2" sx={{ fontWeight: 600 }}>
                  Timeline: Tasks & Notizen
                </Typography>
              </Box>
              <Fab
                color="primary"
                size="small"
                aria-label="add note"
                onClick={() => handleOpenNoteDialog()}
              >
                <AddIcon />
              </Fab>
            </Box>

            {notes.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <Box
                  sx={{
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #667eea20 0%, #764ba220 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mx: 'auto',
                    mb: 2,
                  }}
                >
                  <NoteIcon sx={{ fontSize: 32, color: 'text.secondary' }} />
                </Box>
                <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 600, mb: 1 }}>
                  Noch keine Einträge vorhanden
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => handleOpenNoteDialog()}
                  sx={{ mt: 2 }}
                >
                  Ersten Eintrag hinzufügen
                </Button>
              </Box>
            ) : (
              <Timeline>
                {notes.map((note, index) => (
                  <TimelineItem key={note.id}>
                    <TimelineOppositeContent sx={{ flex: 0.2 }}>
                      <Typography variant="caption" color="text.secondary">
                        {formatDateTime(note.created_at)}
                      </Typography>
                    </TimelineOppositeContent>
                    <TimelineSeparator>
                      <TimelineDot
                        color={note.type === 'task' ? (note.completed ? 'success' : 'primary') : 'grey'}
                        variant={note.type === 'task' && note.completed ? 'filled' : 'outlined'}
                      >
                        {note.type === 'task' ? (
                          note.completed ? (
                            <CheckCircleIcon />
                          ) : (
                            <TaskIcon />
                          )
                        ) : (
                          <NoteIcon />
                        )}
                      </TimelineDot>
                      {index < notes.length - 1 && <TimelineConnector />}
                    </TimelineSeparator>
                    <TimelineContent>
                      <Card 
                        variant="outlined" 
                        sx={{ 
                          mb: 2,
                          background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                          border: '1px solid rgba(0, 0, 0, 0.05)',
                        }}
                      >
                        <CardContent sx={{ p: 2.5 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                              {note.type === 'task' && (
                                <IconButton
                                  size="small"
                                  onClick={() => handleToggleTaskComplete(note.id, note.completed)}
                                  color={note.completed ? 'success' : 'default'}
                                >
                                  {note.completed ? <CheckCircleIcon /> : <RadioButtonUncheckedIcon />}
                                </IconButton>
                              )}
                              <Box sx={{ flex: 1 }}>
                                <Typography
                                  variant="subtitle1"
                                  fontWeight="medium"
                                  sx={{
                                    textDecoration: note.type === 'task' && note.completed ? 'line-through' : 'none',
                                    opacity: note.type === 'task' && note.completed ? 0.6 : 1,
                                  }}
                                >
                                  {note.title}
                                </Typography>
                                <Chip
                                  label={note.type === 'task' ? 'Aufgabe' : 'Notiz'}
                                  size="small"
                                  color={note.type === 'task' ? 'primary' : 'default'}
                                  sx={{ mt: 0.5 }}
                                />
                              </Box>
                            </Box>
                            <Box>
                              <IconButton
                                size="small"
                                onClick={() => handleOpenNoteDialog(note)}
                                sx={{ mr: 0.5 }}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={() => handleDeleteNote(note.id)}
                                color="error"
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          </Box>
                          {note.content && (
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                              {note.content}
                            </Typography>
                          )}
                          {note.type === 'task' && note.due_date && (
                            <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <CalendarTodayIcon fontSize="small" color="action" />
                              <Typography variant="caption" color="text.secondary">
                                Fällig: {formatDateTime(note.due_date)}
                              </Typography>
                            </Box>
                          )}
                        </CardContent>
                      </Card>
                    </TimelineContent>
                  </TimelineItem>
                ))}
              </Timeline>
            )}
          </CardContent>
        </Card>
      </Box>

      {/* Orders Section */}
      <Box sx={{ mt: 4 }}>
        <Card sx={{ background: 'white' }}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 2,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ShoppingCartIcon sx={{ color: 'white', fontSize: 20 }} />
                </Box>
                <Typography variant="h5" component="h2" sx={{ fontWeight: 600 }}>
                  Bestellungen
                </Typography>
                {orders.length > 0 && (
                  <Chip 
                    label={orders.length} 
                    size="small" 
                    sx={{ 
                      ml: 1,
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      fontWeight: 600,
                    }} 
                  />
                )}
              </Box>
            </Box>

            {orders.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <Box
                  sx={{
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #667eea20 0%, #764ba220 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mx: 'auto',
                    mb: 2,
                  }}
                >
                  <ShoppingCartIcon sx={{ fontSize: 32, color: 'text.secondary' }} />
                </Box>
                <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 600, mb: 1 }}>
                  Noch keine Bestellungen vorhanden
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Bestellungen werden hier angezeigt, sobald sie für die Shops dieser Schule erstellt werden.
                </Typography>
              </Box>
            ) : (
              <>
                <Box sx={{ mb: 3 }}>
                  <Tabs 
                    value={ordersViewMode} 
                    onChange={(_, newValue) => setOrdersViewMode(newValue)}
                    sx={{
                      borderBottom: 1,
                      borderColor: 'divider',
                      '& .MuiTab-root': {
                        textTransform: 'none',
                        fontWeight: 500,
                      },
                    }}
                  >
                    <Tab label="Nach Öffnungszeiten gruppiert" value="grouped" />
                    <Tab label="Alle Bestellungen" value="all" />
                  </Tabs>
                </Box>

                {ordersViewMode === 'grouped' ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {orderGroups.map((group, index) => {
                      const status = getOpeningTimeStatus(group)
                      const totalAmount = group.orders.reduce((sum, order) => sum + order.total_amount, 0)
                      
                      return (
                        <Accordion 
                          key={`${group.shopSlug}-${index}`}
                          defaultExpanded={index === 0}
                          sx={{
                            '&:before': { display: 'none' },
                            boxShadow: 2,
                            borderRadius: 2,
                            overflow: 'hidden',
                          }}
                        >
                          <AccordionSummary
                            expandIcon={<ExpandMoreIcon />}
                            sx={{
                              background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                              px: 2,
                              py: 1.5,
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                              <Box
                                sx={{
                                  width: 40,
                                  height: 40,
                                  borderRadius: 2,
                                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                }}
                              >
                                <StoreIcon sx={{ color: 'white', fontSize: 20 }} />
                              </Box>
                              <Box sx={{ flexGrow: 1 }}>
                                <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                                  {group.shopName}
                                </Typography>
                                {group.shopSlug && (
                                  <Typography 
                                    variant="caption" 
                                    sx={{ 
                                      color: 'text.secondary',
                                      fontWeight: 500,
                                      textTransform: 'uppercase',
                                      letterSpacing: '0.05em',
                                      mb: 0.5,
                                      display: 'block',
                                    }}
                                  >
                                    {group.shopSlug}
                                  </Typography>
                                )}
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <AccessTimeIcon fontSize="small" color="action" />
                                    <Typography variant="body2" color="text.secondary">
                                      {formatDateTimeForDisplay(group.shopOpenAt)} - {formatDateTimeForDisplay(group.shopCloseAt)}
                                    </Typography>
                                  </Box>
                                  <Chip
                                    label={status.label}
                                    color={status.color}
                                    size="small"
                                    sx={{ fontWeight: 500 }}
                                  />
                                </Box>
                              </Box>
                              <Box sx={{ textAlign: 'right', mr: 2 }}>
                                <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main' }}>
                                  {group.orders.length} {group.orders.length === 1 ? 'Bestellung' : 'Bestellungen'}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  {totalAmount.toFixed(2)} € gesamt
                                </Typography>
                              </Box>
                            </Box>
                          </AccordionSummary>
                          <AccordionDetails sx={{ p: 0 }}>
                            <TableContainer>
                              <Table>
                                <TableHead>
                                  <TableRow sx={{ background: '#f8fafc' }}>
                                    <TableCell sx={{ fontWeight: 600, py: 2 }}>Order-ID</TableCell>
                                    <TableCell sx={{ fontWeight: 600, py: 2 }}>Datum</TableCell>
                                    <TableCell sx={{ fontWeight: 600, py: 2 }}>Kunde</TableCell>
                                    <TableCell sx={{ fontWeight: 600, py: 2 }}>E-Mail</TableCell>
                                    <TableCell sx={{ fontWeight: 600, py: 2 }}>Klasse</TableCell>
                                    <TableCell sx={{ fontWeight: 600, py: 2 }}>Status</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 600, py: 2 }}>Betrag</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {group.orders.map((order) => (
                                    <TableRow
                                      key={order.id}
                                      sx={{
                                        '&:hover': {
                                          background: '#f8fafc',
                                        },
                                        transition: 'background 0.2s ease-in-out',
                                      }}
                                    >
                                      <TableCell sx={{ py: 2 }}>
                                        <Typography 
                                          variant="body2" 
                                          sx={{ 
                                            fontWeight: 500,
                                            fontFamily: 'monospace',
                                            fontSize: '0.75rem',
                                            color: 'text.secondary',
                                          }}
                                        >
                                          {order.id.substring(0, 8)}...
                                        </Typography>
                                      </TableCell>
                                      <TableCell sx={{ py: 2 }}>
                                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                          {formatDateTime(order.created_at)}
                                        </Typography>
                                      </TableCell>
                                      <TableCell sx={{ py: 2 }}>
                                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                          {order.customer_name}
                                        </Typography>
                                      </TableCell>
                                      <TableCell sx={{ py: 2 }}>
                                        <Typography variant="body2" color="text.secondary">
                                          {order.customer_email || '-'}
                                        </Typography>
                                      </TableCell>
                                      <TableCell sx={{ py: 2 }}>
                                        {order.class_name || '-'}
                                      </TableCell>
                                      <TableCell sx={{ py: 2 }}>
                                        <Chip
                                          label={order.status}
                                          color={getOrderStatusColor(order.status) as any}
                                          size="small"
                                          sx={{ 
                                            fontWeight: 500,
                                            background: order.status === 'paid'
                                              ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                                              : order.status === 'cancelled'
                                              ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                                              : order.status === 'fulfilled'
                                              ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)'
                                              : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                                            color: 'white',
                                          }}
                                        />
                                      </TableCell>
                                      <TableCell align="right" sx={{ py: 2 }}>
                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                          {order.total_amount.toFixed(2)} €
                                        </Typography>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </TableContainer>
                          </AccordionDetails>
                        </Accordion>
                      )
                    })}
                  </Box>
                ) : (
                  <TableContainer sx={{ borderRadius: 2, border: '1px solid rgba(0, 0, 0, 0.05)' }}>
                    <Table>
                      <TableHead>
                        <TableRow sx={{ background: '#f8fafc' }}>
                          <TableCell sx={{ fontWeight: 600, py: 2 }}>Order-ID</TableCell>
                          <TableCell sx={{ fontWeight: 600, py: 2 }}>Datum</TableCell>
                          <TableCell sx={{ fontWeight: 600, py: 2 }}>Kunde</TableCell>
                          <TableCell sx={{ fontWeight: 600, py: 2 }}>E-Mail</TableCell>
                          <TableCell sx={{ fontWeight: 600, py: 2 }}>Klasse</TableCell>
                          <TableCell sx={{ fontWeight: 600, py: 2 }}>Shop</TableCell>
                          <TableCell sx={{ fontWeight: 600, py: 2 }}>Status</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600, py: 2 }}>Betrag</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {orders.map((order) => (
                          <TableRow
                            key={order.id}
                            sx={{
                              '&:hover': {
                                background: '#f8fafc',
                              },
                              transition: 'background 0.2s ease-in-out',
                            }}
                          >
                            <TableCell sx={{ py: 2 }}>
                              <Typography 
                                variant="body2" 
                                sx={{ 
                                  fontWeight: 500,
                                  fontFamily: 'monospace',
                                  fontSize: '0.75rem',
                                  color: 'text.secondary',
                                }}
                              >
                                {order.id.substring(0, 8)}...
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ py: 2 }}>
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                {formatDateTime(order.created_at)}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ py: 2 }}>
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                {order.customer_name}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ py: 2 }}>
                              <Typography variant="body2" color="text.secondary">
                                {order.customer_email || '-'}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ py: 2 }}>
                              {order.class_name || '-'}
                            </TableCell>
                            <TableCell sx={{ py: 2 }}>
                              <Typography variant="body2" color="text.secondary">
                                {order.shop_name || '-'}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ py: 2 }}>
                              <Chip
                                label={order.status}
                                color={getOrderStatusColor(order.status) as any}
                                size="small"
                                sx={{ 
                                  fontWeight: 500,
                                  background: order.status === 'paid'
                                    ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                                    : order.status === 'cancelled'
                                    ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                                    : order.status === 'fulfilled'
                                    ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)'
                                    : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                                  color: 'white',
                                }}
                              />
                            </TableCell>
                            <TableCell align="right" sx={{ py: 2 }}>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {order.total_amount.toFixed(2)} €
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </Box>

      {/* Note/Task Dialog */}
      <Dialog open={noteDialogOpen} onClose={handleCloseNoteDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingNote ? (editingNote.type === 'task' ? 'Aufgabe bearbeiten' : 'Notiz bearbeiten') : 'Neuen Eintrag hinzufügen'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                select
                label="Typ"
                value={noteForm.type}
                onChange={(e) => setNoteForm({ ...noteForm, type: e.target.value as 'note' | 'task' })}
              >
                <MenuItem value="note">Notiz</MenuItem>
                <MenuItem value="task">Aufgabe</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Titel"
                value={noteForm.title}
                onChange={(e) => setNoteForm({ ...noteForm, title: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Inhalt"
                value={noteForm.content}
                onChange={(e) => setNoteForm({ ...noteForm, content: e.target.value })}
                multiline
                rows={4}
              />
            </Grid>
            {noteForm.type === 'task' && (
              <>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    type="datetime-local"
                    label="Fälligkeitsdatum"
                    value={noteForm.due_date}
                    onChange={(e) => setNoteForm({ ...noteForm, due_date: e.target.value })}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                {editingNote && (
                  <Grid item xs={12} sm={6}>
                    <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                      <Button
                        variant={noteForm.completed ? 'contained' : 'outlined'}
                        color={noteForm.completed ? 'success' : 'default'}
                        startIcon={noteForm.completed ? <CheckCircleIcon /> : <RadioButtonUncheckedIcon />}
                        onClick={() => setNoteForm({ ...noteForm, completed: !noteForm.completed })}
                        fullWidth
                      >
                        {noteForm.completed ? 'Erledigt' : 'Offen'}
                      </Button>
                    </Box>
                  </Grid>
                )}
              </>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseNoteDialog} disabled={savingNote}>
            Abbrechen
          </Button>
          <Button
            onClick={handleSaveNote}
            variant="contained"
            disabled={!noteForm.title.trim() || savingNote}
            startIcon={savingNote ? <CircularProgress size={20} /> : null}
          >
            {savingNote ? 'Speichere...' : 'Speichern'}
          </Button>
        </DialogActions>
      </Dialog>
      </Container>
    </Box>
  )
}

