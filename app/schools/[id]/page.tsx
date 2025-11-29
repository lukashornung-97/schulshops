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
import Timeline from '@mui/lab/Timeline'
import TimelineItem from '@mui/lab/TimelineItem'
import TimelineSeparator from '@mui/lab/TimelineSeparator'
import TimelineConnector from '@mui/lab/TimelineConnector'
import TimelineContent from '@mui/lab/TimelineContent'
import TimelineDot from '@mui/lab/TimelineDot'
import TimelineOppositeContent from '@mui/lab/TimelineOppositeContent'
import { format } from 'date-fns'
import { de } from 'date-fns/locale/de'

type School = Database['public']['Tables']['schools']['Row']
type Shop = Database['public']['Tables']['shops']['Row']
type SchoolContact = Database['public']['Tables']['school_contacts']['Row']
type SchoolNote = Database['public']['Tables']['school_notes']['Row']
type Order = Database['public']['Tables']['orders']['Row']

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

  async function handleStatusChange(newStatus: 'lead' | 'active' | 'existing') {
    if (!school || school.status === newStatus || updatingStatus) return

    setUpdatingStatus(true)
    try {
      const { error } = await supabase
        .from('schools')
        .update({ status: newStatus })
        .eq('id', school.id)

      if (error) throw error

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
        message: 'Fehler beim Aktualisieren des Status',
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
      // Prüfe ob ein Shop aktiv ist
      const hasActiveShop = shops.some((shop) => shop.status === 'live')

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
      
      setShops(data || [])
      
      // Aktualisiere Schulstatus basierend auf aktiven Shops
      if (data && data.length > 0) {
        const hasActiveShop = data.some((shop) => shop.status === 'live')
        if (hasActiveShop) {
          await updateSchoolStatusIfNeeded()
        }
        // Lade Bestellungen nachdem Shops geladen wurden
        await loadOrders(data)
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
    const closedShops = shops
      .filter((shop) => shop.status === 'closed' && shop.shop_close_at)
      .sort((a, b) => {
        const dateA = a.shop_close_at ? new Date(a.shop_close_at).getTime() : 0
        const dateB = b.shop_close_at ? new Date(b.shop_close_at).getTime() : 0
        return dateB - dateA
      })
    return closedShops[0] || null
  }

  async function handleExportLastShopAnalytics() {
    const lastShop = getLastClosedShop()
    if (!lastShop) {
      setSnackbar({
        open: true,
        message: 'Kein geschlossener Shop gefunden',
        severity: 'error',
      })
      return
    }

    // Öffne die Analytics-Seite in einem neuen Tab oder navigiere dorthin
    window.open(`/shops/${lastShop.id}/analytics`, '_blank')
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
                  startIcon={<DownloadIcon />}
                  onClick={handleExportLastShopAnalytics}
                  disabled={!getLastClosedShop()}
                >
                  Auswertung exportieren
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<SendIcon />}
                  onClick={() => handleSendNotification('shop_closed')}
                  disabled={sendingNotification !== null}
                >
                  {sendingNotification === 'shop_closed' ? <CircularProgress size={20} /> : 'Benachrichtigung Shop geschlossen'}
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

