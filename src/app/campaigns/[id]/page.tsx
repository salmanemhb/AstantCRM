'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Target,
  Users,
  Mail,
  Trash2,
  Loader2,
  Plus,
  CheckCircle,
  AlertCircle,
  Zap,
  X,
  Sparkles,
  Copy,
  Save,
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
  Send,
  Download
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { generateDraft } from '@/lib/api'
import type { Contact, ContactCampaign, Email, EmailJsonBody, ContactList } from '@/lib/types'
import { formatDate, getToneLabel } from '@/lib/utils'
import GmailEmailComposer from '@/components/gmail-email-composer'
import SentEmailRow from '@/components/sent-email-row'
import ContactFilters, { applyFilters, type ActiveFilter } from '@/components/contact-filters'
import BulkOperationsPanel, { BatchGenerationModal } from '@/components/bulk-operations-panel'
import { getSignatureText, getMemberById } from '@/lib/signatures'
import RichTextEditor from '@/components/rich-text-editor'
// Note: template-utils is used by gmail-email-composer for updateSenderInBody

interface LocalCampaign {
  id: string
  name: string
  prompt?: string
  objective?: string
  tone?: string
  template_subject?: string | null
  template_body?: string | null
  global_context?: string
  cta?: string
  fallback_strategy?: string | null
  created_at: string
  sender_id?: string
}

interface ExtendedContactCampaign extends ContactCampaign {
  contact?: Contact
  emails?: Email[]
}

// Saved format template - stores the FORMAT (structure) of an email
// When applied, AI reformats other emails' content to match this structure
// The actual personalized content of each email is preserved
interface SavedFormat {
  // The template email's body (as an example of the desired format)
  templateBody: EmailJsonBody
  // HTML structure for format analysis
  templateHtml: string
  // Metadata
  bannerEnabled: boolean
  savedFromEmail: string
  savedFromContactName: string
  savedAt: string
}

// Pagination - show 50 emails at a time for performance
const EMAILS_PER_PAGE = 50

export default function CampaignDetailPage() {
  const params = useParams()
  const router = useRouter()
  const campaignId = params.id as string

  const [campaign, setCampaign] = useState<LocalCampaign | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [contactCampaigns, setContactCampaigns] = useState<ExtendedContactCampaign[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showAddContacts, setShowAddContacts] = useState(false)
  const [selectedContacts, setSelectedContacts] = useState<string[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatingProgress, setGeneratingProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [showBatchGeneration, setShowBatchGeneration] = useState(false)
  const [bulkStats, setBulkStats] = useState<any>(null)

  // Filter state for Add VCs modal
  const [modalSelectedListIds, setModalSelectedListIds] = useState<string[]>([])
  const [modalActiveFilters, setModalActiveFilters] = useState<ActiveFilter[]>([])
  const [contactLists, setContactLists] = useState<{ id: string; name: string; filter_columns?: Record<string, string[]> }[]>([])
  const [expandedSheets, setExpandedSheets] = useState<Set<string>>(new Set())
  const [modalSearchQuery, setModalSearchQuery] = useState('')

  // Filter state for main campaign view (batch generation)
  const [mainActiveFilters, setMainActiveFilters] = useState<ActiveFilter[]>([])
  const [mainSelectedListIds, setMainSelectedListIds] = useState<string[]>([])
  const [mainSearchQuery, setMainSearchQuery] = useState('')
  
  // Batch add mode - add contacts without generating drafts immediately
  const [batchAddMode, setBatchAddMode] = useState(false)
  const [isAddingContacts, setIsAddingContacts] = useState(false)
  const [isSendingAll, setIsSendingAll] = useState(false)
  
  // Select X contacts feature
  const [selectCount, setSelectCount] = useState<string>('')
  const [isRegeneratingFilters, setIsRegeneratingFilters] = useState(false)
  
  // Pagination for email list performance
  const [displayLimit, setDisplayLimit] = useState(EMAILS_PER_PAGE)

  // Saved format state - stores the FORMAT/STRUCTURE to apply to other emails
  const [savedFormat, setSavedFormat] = useState<SavedFormat | null>(() => {
    // Load from localStorage on mount (client-side only)
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`campaign-format-${campaignId}`)
        if (stored) {
          return JSON.parse(stored)
        }
      } catch {
        // localStorage may not be available in private browsing
        return null
      }
    }
    return null
  })
  const [isApplyingFormat, setIsApplyingFormat] = useState(false)

  // Edit template modal state
  const [showEditTemplate, setShowEditTemplate] = useState(false)
  const [editSubject, setEditSubject] = useState('')
  const [editBody, setEditBody] = useState('')
  const [isSavingTemplate, setIsSavingTemplate] = useState(false)
  
  // Open edit template modal with current values
  const openEditTemplate = () => {
    setEditSubject(campaign?.template_subject || '')
    setEditBody(campaign?.template_body || '')
    setShowEditTemplate(true)
  }
  
  // Save template changes to database
  const handleSaveTemplate = async () => {
    if (!editSubject.trim() || !editBody.trim()) {
      setError('Subject and body are required')
      return
    }
    
    setIsSavingTemplate(true)
    try {
      const { error: updateError } = await supabase
        .from('campaigns')
        .update({
          template_subject: editSubject,
          template_body: editBody,
        })
        .eq('id', campaignId)
      
      if (updateError) throw updateError
      
      // Update local state
      setCampaign(prev => prev ? {
        ...prev,
        template_subject: editSubject,
        template_body: editBody,
      } : null)
      
      setShowEditTemplate(false)
      setSuccessMessage('Template saved! New drafts will use this template.')
      setTimeout(() => setSuccessMessage(null), 4000)
    } catch (err: any) {
      setError(`Failed to save template: ${err.message}`)
    } finally {
      setIsSavingTemplate(false)
    }
  }

  // Persist savedFormat to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (savedFormat) {
        localStorage.setItem(`campaign-format-${campaignId}`, JSON.stringify(savedFormat))
      } else {
        localStorage.removeItem(`campaign-format-${campaignId}`)
      }
    }
  }, [savedFormat, campaignId])

  const supabase = createClient()

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true)
      try {
        const { data: campaignData, error: campaignError } = await supabase
          .from('campaigns')
          .select('*')
          .eq('id', campaignId)
          .single()

        if (campaignError || !campaignData) {
          try {
            const stored = JSON.parse(localStorage.getItem('local_campaigns') || '[]')
            const localCampaign = stored.find((c: any) => c.id === campaignId)
            setCampaign(localCampaign || null)
          } catch {
            setCampaign(null)
          }
        } else {
          setCampaign(campaignData as LocalCampaign)
        }

        const { data: contactsData } = await supabase
          .from('contacts')
          .select('*')
          .order('last_name', { ascending: true })
        setContacts(contactsData || [])

        // Fetch contact lists with filter columns for Add VCs filtering
        const { data: listsData } = await supabase
          .from('contact_lists')
          .select('id, name, filter_columns')
          .order('created_at', { ascending: false })
        setContactLists(listsData || [])

        const { data: ccData, error: ccError } = await supabase
          .from('contact_campaigns')
          .select(`*, contact:contacts (*), emails:emails (*)`)
          .eq('campaign_id', campaignId)
          .order('updated_at', { ascending: true })

        // Handle query error by showing empty state rather than crashing
        if (ccError) {
          console.error('[CAMPAIGN-PAGE] Failed to fetch contact_campaigns:', ccError)
        }

        setContactCampaigns(ccData || [])

        // Fetch bulk stats
        if (ccData && ccData.length > 0) {
          try {
            const statsResponse = await fetch(`/api/bulk-operations?campaign_id=${campaignId}`)
            const statsData = await statsResponse.json()
            if (!statsData.error) {
              setBulkStats(statsData.stats)
            }
          } catch (err) {
            console.log('Could not fetch bulk stats')
          }
        }
      } catch (err) {
        console.error('Failed to fetch campaign:', err)
      } finally {
        setIsLoading(false)
      }
    }
    if (campaignId) fetchData()
  }, [campaignId])

  const handleDeleteCampaign = async () => {
    if (!confirm('Delete this campaign and all drafts?')) return
    setIsDeleting(true)

    // Check if this is a demo campaign
    const isDemoCampaign = campaignId.startsWith('demo-')

    try {
      if (!isDemoCampaign) {
        // First delete all emails associated with this campaign's contact_campaigns
        const ccIds = contactCampaigns.map(cc => cc.id)
        if (ccIds.length > 0) {
          // Get all email IDs for these contact_campaigns
          const { data: emails } = await supabase.from('emails').select('id').in('contact_campaign_id', ccIds)

          if (emails && emails.length > 0) {
            const emailIds = emails.map(e => e.id)
            // Delete engagement_events first (foreign key constraint)
            await supabase.from('engagement_events').delete().in('email_id', emailIds)
          }

          // Get unified_thread_ids to clean up orphaned threads
          const threadIds = contactCampaigns.map(cc => cc.unified_thread_id).filter(Boolean)

          // Now delete emails and contact_campaigns
          await supabase.from('emails').delete().in('contact_campaign_id', ccIds)
          await supabase.from('contact_campaigns').delete().eq('campaign_id', campaignId)

          // Delete orphaned unified_threads
          if (threadIds.length > 0) {
            await supabase.from('unified_threads').delete().in('id', threadIds)
          }
        }

        // Now delete the campaign from database
        await supabase.from('campaigns').delete().eq('id', campaignId)
      }

      // Always clean up localStorage (including saved format)
      try {
        const stored = JSON.parse(localStorage.getItem('local_campaigns') || '[]')
        localStorage.setItem('local_campaigns', JSON.stringify(stored.filter((c: any) => c.id !== campaignId)))
      } catch {
        localStorage.removeItem('local_campaigns')
      }
      localStorage.removeItem(`campaign-format-${campaignId}`)
      router.push('/campaigns')
    } catch (err) {
      setError('Failed to delete campaign')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDeleteContact = async (contactCampaignId: string, contactName: string) => {
    // Check if this is a demo contact campaign
    const isDemoContact = contactCampaignId.startsWith('demo-')

    try {
      if (!isDemoContact) {
        // Get the contact_campaign to find its unified_thread_id
        const { data: cc, error: ccError } = await supabase
          .from('contact_campaigns')
          .select('unified_thread_id')
          .eq('id', contactCampaignId)
          .single()

        if (ccError) throw new Error(`Failed to fetch contact_campaign: ${ccError.message}`)

        // Get email IDs first to delete engagement_events
        const { data: emails, error: emailsError } = await supabase.from('emails').select('id').eq('contact_campaign_id', contactCampaignId)
        if (emailsError) throw new Error(`Failed to fetch emails: ${emailsError.message}`)

        if (emails && emails.length > 0) {
          const emailIds = emails.map(e => e.id)
          const { error: eventsError } = await supabase.from('engagement_events').delete().in('email_id', emailIds)
          if (eventsError) console.warn('Failed to delete engagement_events:', eventsError)
        }

        const { error: deleteEmailsError } = await supabase.from('emails').delete().eq('contact_campaign_id', contactCampaignId)
        if (deleteEmailsError) throw new Error(`Failed to delete emails: ${deleteEmailsError.message}`)

        const { error: deleteCcError } = await supabase.from('contact_campaigns').delete().eq('id', contactCampaignId)
        if (deleteCcError) throw new Error(`Failed to delete contact_campaign: ${deleteCcError.message}`)

        // Delete orphaned unified_thread
        if (cc?.unified_thread_id) {
          const { error: threadError } = await supabase.from('unified_threads').delete().eq('id', cc.unified_thread_id)
          if (threadError) console.warn('Failed to delete unified_thread:', threadError)
        }
      }
      // Update local state only after successful database operations
      setContactCampaigns(prev => prev.filter(cc => cc.id !== contactCampaignId))
      setSuccessMessage(`${contactName} removed from campaign`)
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err: any) {
      console.error('Delete contact error:', err)
      setError(err.message || 'Failed to remove contact from campaign')
    }
  }

  const handleAddContacts = async () => {
    console.log('[handleAddContacts] Starting...', { selectedContacts, campaignId })
    if (selectedContacts.length === 0) {
      console.log('[handleAddContacts] No contacts selected, returning')
      return
    }
    setIsGenerating(true)
    setGeneratingProgress(0)
    setError(null)
    try {
      // Re-fetch existing contact_campaigns from database to avoid stale data
      console.log('[handleAddContacts] Fetching existing contact_campaigns...')
      const { data: existingCCs, error: fetchError } = await supabase
        .from('contact_campaigns')
        .select('contact_id')
        .eq('campaign_id', campaignId)

      if (fetchError) {
        console.error('[handleAddContacts] Error fetching existing CCs:', fetchError)
      }
      console.log('[handleAddContacts] Existing CCs:', existingCCs)

      const existingContactIds = existingCCs?.map(cc => cc.contact_id) || []
      const newContacts = selectedContacts.filter(id => !existingContactIds.includes(id))
      console.log('[handleAddContacts] New contacts to add:', newContacts)

      if (newContacts.length === 0) {
        console.log('[handleAddContacts] All selected contacts already in campaign')
        setSuccessMessage('All selected contacts are already in this campaign')
        setTimeout(() => setSuccessMessage(null), 3000)
        setIsGenerating(false)
        return
      }

      for (let i = 0; i < newContacts.length; i++) {
        const contactId = newContacts[i]
        const contact = contacts.find(c => c.id === contactId)
        console.log(`[handleAddContacts] Processing contact ${i + 1}/${newContacts.length}:`, contactId, contact?.email)

        console.log('[handleAddContacts] Creating unified_thread...')
        const { data: thread, error: threadError } = await supabase
          .from('unified_threads')
          .insert({ firm_name: contact?.firm || 'Unknown Firm', status: 'active' })
          .select()
          .single()
        if (threadError) {
          console.error('[handleAddContacts] Thread creation error:', threadError)
          throw threadError
        }
        console.log('[handleAddContacts] Thread created:', thread.id)

        // Insert contact_campaign and wait for confirmation before generating draft
        console.log('[handleAddContacts] Creating contact_campaign...')
        const { data: newCC, error: ccError } = await supabase
          .from('contact_campaigns')
          .insert({
            contact_id: contactId,
            campaign_id: campaignId,
            unified_thread_id: thread.id,
            stage: 'drafted',
            confidence_score: 'yellow',
          })
          .select()
          .single()

        if (ccError) {
          console.error('[handleAddContacts] CC creation error:', ccError)
          throw ccError
        }
        if (!newCC) {
          console.error('[handleAddContacts] CC not created')
          throw new Error('Failed to create contact_campaign record')
        }
        console.log('[handleAddContacts] CC created:', newCC.id)

        // Small delay to ensure Supabase has committed the record
        await new Promise(resolve => setTimeout(resolve, 100))

        console.log('[handleAddContacts] Generating draft...')
        // Get sender_id from campaign global_context or campaign.sender_id
        let campaignSenderId = campaign?.sender_id || 'jean-francois'
        if (campaign?.global_context) {
          try {
            const ctx = typeof campaign.global_context === 'string' 
              ? JSON.parse(campaign.global_context) 
              : campaign.global_context
            if (ctx.sender_id) campaignSenderId = ctx.sender_id
          } catch {}
        }
        await generateDraft({
          contact_id: contactId,
          campaign_id: campaignId,
          signature: 'Best regards,\nAstant Global Management',
          config: { sender_id: campaignSenderId },
        })
        console.log('[handleAddContacts] Draft generated for contact:', contactId)
        setGeneratingProgress(((i + 1) / newContacts.length) * 100)
      }

      const { data: updatedCc } = await supabase
        .from('contact_campaigns')
        .select(`*, contact:contacts (*), emails:emails (*)`)
        .eq('campaign_id', campaignId)
        .order('updated_at', { ascending: true })
      setContactCampaigns(updatedCc || [])
      setShowAddContacts(false)
      setSelectedContacts([])
      
      // Refresh bulk stats to show updated approval counts
      await refreshBulkStats()

      setSuccessMessage(`Generated ${newContacts.length} draft${newContacts.length > 1 ? 's' : ''}!`)
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to generate drafts')
    } finally {
      setIsGenerating(false)
    }
  }

  // Add contacts to campaign WITHOUT generating drafts (for batch generation later)
  const handleAddContactsOnly = async () => {
    if (selectedContacts.length === 0) return
    
    setIsAddingContacts(true)
    setError(null)
    
    try {
      // Re-fetch existing contact_campaigns to avoid stale data
      const { data: existingCCs } = await supabase
        .from('contact_campaigns')
        .select('contact_id')
        .eq('campaign_id', campaignId)

      const existingContactIds = existingCCs?.map(cc => cc.contact_id) || []
      const newContacts = selectedContacts.filter(id => !existingContactIds.includes(id))

      if (newContacts.length === 0) {
        setSuccessMessage('All selected contacts are already in this campaign')
        setTimeout(() => setSuccessMessage(null), 3000)
        setIsAddingContacts(false)
        return
      }

      // Add contacts in batches for better performance
      const batchSize = 50
      let added = 0
      
      for (let i = 0; i < newContacts.length; i += batchSize) {
        const batch = newContacts.slice(i, i + batchSize)
        
        // Create unified threads and contact_campaigns in parallel
        const insertPromises = batch.map(async (contactId) => {
          const contact = contacts.find(c => c.id === contactId)
          
          const { data: thread } = await supabase
            .from('unified_threads')
            .insert({ firm_name: contact?.firm || 'Unknown Firm', status: 'active' })
            .select()
            .single()
          
          if (!thread) return null
          
          const { data: cc } = await supabase
            .from('contact_campaigns')
            .insert({
              contact_id: contactId,
              campaign_id: campaignId,
              unified_thread_id: thread.id,
              stage: 'drafted', // Will show as "No draft generated yet"
              confidence_score: 'yellow',
            })
            .select()
            .single()
          
          return cc
        })
        
        const results = await Promise.all(insertPromises)
        added += results.filter(Boolean).length
        
        setGeneratingProgress(Math.round(((i + batch.length) / newContacts.length) * 100))
      }

      // Refresh data
      const { data: updatedCc } = await supabase
        .from('contact_campaigns')
        .select(`*, contact:contacts (*), emails:emails (*)`)
        .eq('campaign_id', campaignId)
        .order('updated_at', { ascending: true })
      setContactCampaigns(updatedCc || [])
      
      setShowAddContacts(false)
      setSelectedContacts([])
      setBatchAddMode(false)
      setGeneratingProgress(0)
      
      // Refresh bulk stats to show updated counts
      await refreshBulkStats()

      setSuccessMessage(`Added ${added} contacts! Use "Generate Drafts" button to batch generate emails.`)
      setTimeout(() => setSuccessMessage(null), 5000)
    } catch (err: any) {
      setError(err.message || 'Failed to add contacts')
    } finally {
      setIsAddingContacts(false)
    }
  }

  const handleApproveEmail = async (email: Email) => {
    console.log('[handleApproveEmail] Starting...', { emailId: email.id, contactCampaignId: email.contact_campaign_id })
    setError(null) // Clear any previous errors
    try {
      const approvedAt = new Date().toISOString()
      console.log('[handleApproveEmail] Updating email with approved=true, approved_at=', approvedAt)
      const { error: emailError, data: emailData } = await supabase.from('emails').update({ approved: true, approved_at: approvedAt }).eq('id', email.id).select()
      if (emailError) {
        console.error('[handleApproveEmail] Email update error:', emailError)
        throw emailError
      }
      console.log('[handleApproveEmail] Email updated:', emailData)

      console.log('[handleApproveEmail] Updating contact_campaign stage to approved')
      const { error: ccError, data: ccData } = await supabase.from('contact_campaigns').update({ stage: 'approved' }).eq('id', email.contact_campaign_id).select()
      if (ccError) {
        console.error('[handleApproveEmail] CC update error:', ccError)
        throw ccError
      }
      console.log('[handleApproveEmail] CC updated:', ccData)

      setContactCampaigns(prev => prev.map(cc => cc.id === email.contact_campaign_id
        ? { ...cc, stage: 'approved', emails: cc.emails?.map(e => e.id === email.id ? { ...e, approved: true } : e) }
        : cc))
      setSuccessMessage('Email approved!')
      setTimeout(() => setSuccessMessage(null), 2000)
    } catch (err: any) {
      setError(err.message || 'Failed to approve email')
    }
  }

  const handleUnapproveEmail = async (email: Email) => {
    console.log('[handleUnapproveEmail] Starting...', { emailId: email.id, contactCampaignId: email.contact_campaign_id })
    setError(null)
    try {
      console.log('[handleUnapproveEmail] Updating email with approved=false, approved_at=null')
      const { error: emailError } = await supabase.from('emails').update({ approved: false, approved_at: null }).eq('id', email.id)
      if (emailError) {
        console.error('[handleUnapproveEmail] Email update error:', emailError)
        throw emailError
      }

      console.log('[handleUnapproveEmail] Updating contact_campaign stage to drafted')
      const { error: ccError } = await supabase.from('contact_campaigns').update({ stage: 'drafted' }).eq('id', email.contact_campaign_id)
      if (ccError) {
        console.error('[handleUnapproveEmail] CC update error:', ccError)
        throw ccError
      }

      setContactCampaigns(prev => prev.map(cc => cc.id === email.contact_campaign_id
        ? { ...cc, stage: 'drafted', emails: cc.emails?.map(e => e.id === email.id ? { ...e, approved: false } : e) }
        : cc))
      setSuccessMessage('Email unlocked for editing')
      setTimeout(() => setSuccessMessage(null), 2000)
    } catch (err: any) {
      setError(err.message || 'Failed to unlock email')
    }
  }

  const handleSaveEmail = async (emailId: string, updates: Partial<Email>) => {
    setError(null) // Clear any previous errors
    
    console.log('[handleSaveEmail] ========== SAVING TO DATABASE ==========')
    console.log('[handleSaveEmail] emailId:', emailId)
    console.log('[handleSaveEmail] updates.current_body?.greeting:', JSON.stringify(updates.current_body?.greeting?.substring(0, 100)))
    console.log('[handleSaveEmail] updates.current_body?.context_p1 (first 200):', JSON.stringify(updates.current_body?.context_p1?.substring(0, 200)))
    
    // Check for duplication bug
    const greetingNormSave = updates.current_body?.greeting?.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
    const contextNormSave = updates.current_body?.context_p1?.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
    if (greetingNormSave && contextNormSave && contextNormSave.startsWith(greetingNormSave)) {
      console.log('[handleSaveEmail] !!! BUG: Saving email with greeting duplicated in context_p1 !!!')
    }
    
    try {
      const { error: saveError } = await supabase.from('emails').update(updates).eq('id', emailId)
      if (saveError) throw saveError

      // If the sender was changed (signatureMemberId in current_body), also update contact_campaign.sender_id
      // This ensures the email is sent FROM the correct person
      if (updates.current_body?.signatureMemberId) {
        const newSenderId = updates.current_body.signatureMemberId
        // Find the contact_campaign for this email
        const cc = contactCampaigns.find(c => c.emails?.some(e => e.id === emailId))
        if (cc) {
          console.log('[handleSaveEmail] Updating sender_id on contact_campaign:', cc.id, '->', newSenderId)
          const { error: ccError } = await supabase
            .from('contact_campaigns')
            .update({ sender_id: newSenderId })
            .eq('id', cc.id)
          if (ccError) {
            console.error('[handleSaveEmail] Failed to update sender_id:', ccError)
          }
        }
      }

      setContactCampaigns(prev => prev.map(cc => ({
        ...cc,
        // Also update sender_id in local state if changed
        sender_id: updates.current_body?.signatureMemberId && cc.emails?.some(e => e.id === emailId)
          ? updates.current_body.signatureMemberId
          : cc.sender_id,
        emails: cc.emails?.map(e => e.id === emailId ? { ...e, ...updates } : e)
      })))
      setSuccessMessage('Email saved!')
      setTimeout(() => setSuccessMessage(null), 2000)
    } catch (err: any) {
      setError(err.message || 'Failed to save email')
    }
  }

  const handleSendEmail = async (email: Email, cc: ExtendedContactCampaign) => {
    console.log('[handleSendEmail] Starting...', { emailId: email.id, contactEmail: cc.contact?.email })
    try {
      // Use the send-email API endpoint
      console.log('[handleSendEmail] Calling /api/send-email...')
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email_id: email.id }),
      })
      console.log('[handleSendEmail] Response status:', response.status)

      const result = await response.json()
      console.log('[handleSendEmail] Result:', result)

      if (!result.success) {
        console.error('[handleSendEmail] API returned failure:', result.error)
        throw new Error(result.error || 'Failed to send email')
      }

      console.log('[handleSendEmail] Email sent successfully, updating local state')
      // Update local state
      setContactCampaigns(prev => prev.map(item => item.id === email.contact_campaign_id
        ? { ...item, stage: 'sent', emails: item.emails?.map(e => e.id === email.id ? { ...e, approved: true, sent_at: result.sent_at } : e) }
        : item))
      setSuccessMessage(`Email sent to ${cc.contact?.first_name}!`)
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err: any) {
      console.error('[handleSendEmail] Error:', err)
      setError(err.message || 'Failed to send email')
    }
  }

  const handleRegenerateDraft = async (contactId: string, senderId?: string) => {
    console.log('[handleRegenerateDraft] Starting...', { contactId, senderId, campaignId })
    setError(null)
    try {
      // Delete existing emails for this contact in this campaign first
      const cc = contactCampaigns.find(c => c.contact_id === contactId)
      console.log('[handleRegenerateDraft] Found existing CC:', cc?.id, 'with', cc?.emails?.length, 'emails')
      if (cc?.emails) {
        console.log('[handleRegenerateDraft] Deleting existing emails...')
        for (const email of cc.emails) {
          const { error } = await supabase.from('emails').delete().eq('id', email.id)
          if (error) console.error('[handleRegenerateDraft] Error deleting email:', email.id, error)
        }
      }

      console.log('[handleRegenerateDraft] Calling generateDraft...')
      await generateDraft({
        contact_id: contactId,
        campaign_id: campaignId,
        signature: 'Best regards,\nAstant Global Management',
        config: senderId ? { sender_id: senderId } : undefined
      })
      console.log('[handleRegenerateDraft] Draft generated, refreshing CCs...')
      const { data: updatedCc, error: fetchError } = await supabase.from('contact_campaigns').select(`*, contact:contacts (*), emails:emails (*)`).eq('campaign_id', campaignId).order('updated_at', { ascending: true })
      if (fetchError) console.error('[handleRegenerateDraft] Error fetching updated CCs:', fetchError)
      console.log('[handleRegenerateDraft] Updated CCs:', updatedCc?.length)
      setContactCampaigns(updatedCc || [])
      setSuccessMessage('Draft regenerated!')
      setTimeout(() => setSuccessMessage(null), 2000)
    } catch (err: any) {
      console.error('[handleRegenerateDraft] Error:', err)
      setError(err.message || 'Failed to regenerate draft')
    }
  }

  const toggleContact = (contactId: string) => setSelectedContacts(prev => prev.includes(contactId) ? prev.filter(id => id !== contactId) : [...prev, contactId])
  const selectAllContacts = () => setSelectedContacts(filteredAvailableContacts.map(c => c.id))
  const unselectAllContacts = () => setSelectedContacts([])
  const availableContacts = contacts.filter(c => !contactCampaigns.some(cc => cc.contact_id === c.id))
  
  // Select first X contacts from filtered list
  const selectXContacts = (count: number) => {
    const toSelect = filteredAvailableContacts.slice(0, count).map(c => c.id)
    setSelectedContacts(toSelect)
  }
  
  // Regenerate filter columns for a contact list
  const regenerateFilters = async (listId: string) => {
    setIsRegeneratingFilters(true)
    try {
      const response = await fetch('/api/regenerate-filters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ list_id: listId }),
      })
      const result = await response.json()
      if (result.success) {
        // Refresh contact lists
        const { data: listsData } = await supabase
          .from('contact_lists')
          .select('id, name, filter_columns')
          .order('created_at', { ascending: false })
        setContactLists(listsData || [])
        setSuccessMessage(`Filters regenerated! Found ${Object.keys(result.filter_columns).length} filterable columns.`)
        setTimeout(() => setSuccessMessage(null), 4000)
      } else {
        setError(result.error || 'Failed to regenerate filters')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to regenerate filters')
    } finally {
      setIsRegeneratingFilters(false)
    }
  }

  // Contacts in campaign that don't have emails yet (need draft generation)
  const contactsNeedingDrafts = contactCampaigns.filter(cc => !cc.emails || cc.emails.length === 0)
  
  // Get the actual contact objects for filtering
  const contactsInCampaignNeedingDrafts = contactsNeedingDrafts
    .map(cc => cc.contact)
    .filter((c): c is Contact => c !== undefined)

  // Apply main filters to contacts needing drafts
  const filteredContactsNeedingDrafts = applyFilters(
    contactsInCampaignNeedingDrafts,
    mainActiveFilters,
    mainSelectedListIds,
    (c) => c.contact_list_id || null
  ).filter(c => 
    !mainSearchQuery || 
    `${c.first_name} ${c.last_name} ${c.email} ${c.firm || ''} ${c.role || ''}`
      .toLowerCase()
      .includes(mainSearchQuery.toLowerCase())
  )

  const contactIdsNeedingDrafts = filteredContactsNeedingDrafts.map(c => c.id)

  // Apply modal filters to available contacts
  const filteredAvailableContacts = applyFilters(
    availableContacts,
    modalActiveFilters,
    modalSelectedListIds,
    (c) => c.contact_list_id || null
  )

  // Refresh bulk stats
  const refreshBulkStats = async () => {
    try {
      const statsResponse = await fetch(`/api/bulk-operations?campaign_id=${campaignId}`)
      const statsData = await statsResponse.json()
      if (!statsData.error) {
        setBulkStats(statsData.stats)
      }
      // Also refresh contact campaigns
      const { data: updatedCc } = await supabase
        .from('contact_campaigns')
        .select(`*, contact:contacts (*), emails:emails (*)`)
        .eq('campaign_id', campaignId)
        .order('updated_at', { ascending: true })
      setContactCampaigns(updatedCc || [])
    } catch (err) {
      console.error('Failed to refresh stats:', err)
    }
  }

  if (isLoading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><Loader2 className="h-8 w-8 text-gray-400 animate-spin" /></div>
  if (!campaign) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="text-center"><AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" /><h2 className="text-lg font-semibold text-gray-900 mb-2">Campaign not found</h2><Link href="/campaigns" className="text-brand-600 hover:text-brand-700">Back to campaigns</Link></div></div>

  const stats = { total: contactCampaigns.length, drafted: contactCampaigns.filter(cc => cc.stage === 'drafted').length, approved: contactCampaigns.filter(cc => cc.stage === 'approved').length, sent: contactCampaigns.filter(cc => cc.stage === 'sent').length }

  // Download sent emails as CSV
  const downloadSentEmailsCSV = () => {
    const sentEmails = contactCampaigns.filter(cc => cc.stage === 'sent')
    if (sentEmails.length === 0) {
      setError('No sent emails to download')
      return
    }

    // Collect all unique raw_data keys from contacts
    const allRawDataKeys = new Set<string>()
    sentEmails.forEach(cc => {
      if (cc.contact?.raw_data) {
        Object.keys(cc.contact.raw_data).forEach(key => allRawDataKeys.add(key))
      }
    })
    const rawDataColumns = Array.from(allRawDataKeys).sort()

    // CSV headers
    const headers = [
      'Status',
      'First Name',
      'Last Name',
      'Email',
      'Firm',
      'Role',
      'Geography',
      'Investment Focus',
      'Email Subject',
      'Sent At',
      ...rawDataColumns
    ]

    // Helper to escape CSV values
    const escapeCSV = (value: any): string => {
      if (value === null || value === undefined) return ''
      const str = String(value)
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    // Build CSV rows
    const rows = sentEmails.map(cc => {
      const contact = cc.contact
      const email = cc.emails?.[0]
      const sentDate = email?.sent_at ? new Date(email.sent_at).toLocaleString() : ''
      
      const baseData = [
        'SENT',
        contact?.first_name || '',
        contact?.last_name || '',
        contact?.email || '',
        contact?.firm || '',
        contact?.role || '',
        contact?.geography || '',
        contact?.investment_focus || '',
        email?.subject || '',
        sentDate
      ]

      // Add raw_data columns in order
      const rawDataValues = rawDataColumns.map(key => 
        contact?.raw_data?.[key] ?? ''
      )

      return [...baseData, ...rawDataValues].map(escapeCSV).join(',')
    })

    // Combine headers and rows
    const csvContent = [headers.map(escapeCSV).join(','), ...rows].join('\n')

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${campaign.name.replace(/[^a-zA-Z0-9]/g, '_')}_sent_emails_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    setSuccessMessage(`Downloaded ${sentEmails.length} sent emails as CSV`)
    setTimeout(() => setSuccessMessage(null), 3000)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/campaigns" className="text-gray-400 hover:text-gray-600"><ArrowLeft className="h-5 w-5" /></Link>
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-brand-500 to-brand-600 rounded-xl flex items-center justify-center shadow-sm"><Target className="h-6 w-6 text-white" /></div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">{campaign.name}</h1>
                  <div className="flex items-center space-x-2 mt-0.5">
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">{campaign.tone ? getToneLabel(campaign.tone) : 'Professional'}</span>
                    <span className="text-sm text-gray-500">{contactCampaigns.length} contact{contactCampaigns.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button 
                onClick={openEditTemplate}
                className="flex items-center space-x-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                title="Edit the campaign template - only affects new drafts, not existing ones"
              >
                <Save className="h-4 w-4" />
                <span>Edit Template</span>
              </button>
              {contactIdsNeedingDrafts.length > 0 && (
                <button
                  onClick={() => setShowBatchGeneration(true)}
                  className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>
                    Generate {Math.min(100, contactIdsNeedingDrafts.length)} Drafts
                    {(mainActiveFilters.length > 0 || mainSelectedListIds.length > 0 || mainSearchQuery) && ' (Filtered)'}
                  </span>
                  {contactIdsNeedingDrafts.length > 100 && (
                    <span className="text-purple-200 text-xs">({contactIdsNeedingDrafts.length} pending)</span>
                  )}
                </button>
              )}
              <button onClick={() => setShowAddContacts(true)} className="flex items-center space-x-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"><Plus className="h-4 w-4" /><span>Add VCs</span></button>
              <button onClick={handleDeleteCampaign} disabled={isDeleting} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50" title="Delete Campaign"><Trash2 className="h-5 w-5" /></button>
            </div>
          </div>
        </div>
      </header>

      {successMessage && <div className="bg-green-50 border-b border-green-100 px-4 py-3"><div className="max-w-6xl mx-auto flex items-center space-x-2"><CheckCircle className="h-4 w-4 text-green-600" /><p className="text-sm text-green-700">{successMessage}</p></div></div>}
      {error && <div className="bg-red-50 border-b border-red-100 px-4 py-3"><div className="max-w-6xl mx-auto flex items-center justify-between"><p className="text-sm text-red-700">{error}</p><button onClick={() => setError(null)} className="text-red-500 hover:text-red-700"><X className="h-4 w-4" /></button></div></div>}

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Filters for Batch Generation - Only show when there are contacts needing drafts */}
        {contactsNeedingDrafts.length > 0 && (
          <div className="mb-6 bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Sparkles className="h-5 w-5 text-purple-600" />
                <h3 className="font-medium text-gray-900">Filter Contacts for Batch Generation</h3>
                <span className="text-sm text-gray-500">
                  ({contactIdsNeedingDrafts.length} of {contactsNeedingDrafts.length} contacts match filters)
                </span>
              </div>
              {(mainActiveFilters.length > 0 || mainSelectedListIds.length > 0 || mainSearchQuery) && (
                <button
                  onClick={() => {
                    setMainActiveFilters([])
                    setMainSelectedListIds([])
                    setMainSearchQuery('')
                  }}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Clear filters
                </button>
              )}
            </div>
            
            {/* Search */}
            <div className="mb-3">
              <input
                type="text"
                placeholder="Search by name, firm, email..."
                value={mainSearchQuery}
                onChange={(e) => setMainSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            
            <ContactFilters
              contactLists={contactLists}
              selectedListIds={mainSelectedListIds}
              onListSelectionChange={setMainSelectedListIds}
              activeFilters={mainActiveFilters}
              onFiltersChange={setMainActiveFilters}
              totalCount={contactsNeedingDrafts.length}
              filteredCount={mainActiveFilters.length > 0 || mainSelectedListIds.length > 0 || mainSearchQuery ? contactIdsNeedingDrafts.length : undefined}
            />
          </div>
        )}

        {/* Bulk Operations Panel - Only show when there are contacts */}
        {bulkStats && contactCampaigns.length > 0 && (
          <div className="mb-6">
            <BulkOperationsPanel
              campaignId={campaignId}
              stats={bulkStats}
              onRefresh={refreshBulkStats}
            />
          </div>
        )}

        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4"><p className="text-3xl font-bold text-gray-900">{stats.total}</p><p className="text-sm text-gray-500">Total VCs</p></div>
          <div className="bg-white rounded-xl border border-gray-200 p-4"><p className="text-3xl font-bold text-yellow-600">{stats.drafted}</p><p className="text-sm text-gray-500">Drafts Ready</p></div>
          <div className="bg-white rounded-xl border border-gray-200 p-4"><p className="text-3xl font-bold text-blue-600">{stats.approved}</p><p className="text-sm text-gray-500">Approved</p></div>
          <div className="bg-white rounded-xl border border-gray-200 p-4"><p className="text-3xl font-bold text-green-600">{stats.sent}</p><p className="text-sm text-gray-500">Sent</p></div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Email Drafts</h2>
              {stats.sent > 0 && (
                <button
                  onClick={downloadSentEmailsCSV}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg text-sm font-medium transition-colors border border-green-200"
                >
                  <Download className="h-4 w-4" />
                  <span>Download Sent ({stats.sent})</span>
                </button>
              )}
            </div>

            {/* Format Sync Controls */}
            {contactCampaigns.length >= 1 && (
              <div className="flex items-center space-x-3">
                {savedFormat && (
                  <button
                    onClick={async () => {
                      setIsApplyingFormat(true)
                      console.log('[ApplyFormat] Syncing format to all emails...')

                      try {
                        // Use the sync-format API to apply structural changes
                        const response = await fetch('/api/sync-format', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            campaignId,
                            sourceEmailId: savedFormat.savedFromEmail,
                            sourceBody: savedFormat.templateBody,
                          })
                        })

                        const result = await response.json()

                        if (result.success) {
                          console.log('[ApplyFormat] Synced', result.updated, 'emails')

                          // Refresh data from database
                          const { data: refreshedCCs } = await supabase
                            .from('contact_campaigns')
                            .select(`
                              *,
                              contact:contacts(*),
                              emails(*)
                            `)
                            .eq('campaign_id', campaignId)
                            .order('created_at', { ascending: false })

                          if (refreshedCCs) {
                            setContactCampaigns(refreshedCCs.map(cc => ({
                              ...cc,
                              emails: cc.emails || []
                            })))
                          }

                          setSuccessMessage(`Applied format to ${result.updated} emails! Structure synced, content preserved.`)
                          setTimeout(() => setSuccessMessage(null), 4000)
                        } else {
                          throw new Error(result.error || 'Failed to sync format')
                        }
                      } catch (err: any) {
                        console.error('[ApplyFormat] Error:', err)
                        setError(err.message || 'Failed to apply format')
                      } finally {
                        setIsApplyingFormat(false)
                      }
                    }}
                    disabled={isApplyingFormat}
                    className="flex items-center space-x-2 px-3 py-1.5 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors disabled:opacity-50"
                    title="Apply the copied format (banner, signature) to all other emails"
                  >
                    {isApplyingFormat ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Applying...</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        <span>Apply to All ({contactCampaigns.length - 1})</span>
                      </>
                    )}
                  </button>
                )}
                {savedFormat && (
                  <button
                    onClick={() => setSavedFormat(null)}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Saved Format Info Banner */}
          {savedFormat && (
            <div className="px-6 py-3 bg-brand-50 border-b border-brand-100 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Save className="h-4 w-4 text-brand-600" />
                <p className="text-sm text-brand-700">
                  <strong>Format Saved:</strong> Structure from {savedFormat.savedFromContactName}'s email.
                  Clicking "Apply" will sync line breaks and spacing to all emails (content stays unique).
                </p>
              </div>
            </div>
          )}

          {contactCampaigns.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4"><Mail className="h-8 w-8 text-gray-400" /></div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No drafts yet</h3>
              <p className="text-gray-500 mb-6">Add VCs to generate personalized email drafts</p>
              <button onClick={() => setShowAddContacts(true)} className="inline-flex items-center space-x-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700"><Plus className="h-4 w-4" /><span>Add VCs</span></button>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {/* Sort: drafts first, then sent emails */}
              {(() => {
                const sortedContacts = [...contactCampaigns].sort((a, b) => {
                  const aIsSent = a.stage === 'sent'
                  const bIsSent = b.stage === 'sent'
                  if (aIsSent && !bIsSent) return 1
                  if (!aIsSent && bIsSent) return -1
                  return 0
                })
                
                // Apply display limit for pagination
                const visibleContacts = sortedContacts.slice(0, displayLimit)
                const hasMore = sortedContacts.length > displayLimit
                
                return (
                  <>
                    {visibleContacts.map((cc) => {
                      const email = cc.emails?.[0]
                      if (!email) {
                        // Show placeholder for contacts without generated emails
                        return (
                          <div key={cc.id} className="bg-gray-50 rounded-lg border border-gray-200 p-4 flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                                <span className="text-gray-500 font-semibold text-sm">
                                  {cc.contact?.first_name?.[0] || '?'}{cc.contact?.last_name?.[0] || ''}
                                </span>
                              </div>
                              <div>
                                <p className="font-medium text-gray-700">{cc.contact?.first_name} {cc.contact?.last_name}</p>
                                <p className="text-sm text-gray-500">No draft generated yet</p>
                              </div>
                            </div>
                            <button
                              onClick={() => handleRegenerateDraft(cc.contact_id)}
                              className="px-3 py-1.5 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700"
                            >
                              Generate Draft
                            </button>
                          </div>
                        )
                      }
                      
                      const isSent = cc.stage === 'sent'
                      const isApproved = cc.stage === 'approved' || email?.approved
                      
                      // Use lightweight SentEmailRow for sent emails
                      if (isSent) {
                        return (
                          <SentEmailRow
                            key={cc.id}
                            emailId={email.id}
                            contactName={`${cc.contact?.first_name || ''} ${cc.contact?.last_name || ''}`}
                            contactEmail={cc.contact?.email || ''}
                            contactFirm={cc.contact?.firm}
                            contactInitials={`${cc.contact?.first_name?.[0] || ''}${cc.contact?.last_name?.[0] || ''}`}
                            subject={email.subject || 'No subject'}
                            sentAt={email.sent_at || ''}
                            campaignId={campaignId}
                          />
                        )
                      }
                      
                      // Full composer only for drafts (editable)
                      return (
                        <GmailEmailComposer
                          key={cc.id}
                          email={email}
                          contactName={`${cc.contact?.first_name} ${cc.contact?.last_name}`}
                          contactEmail={cc.contact?.email || ''}
                          contactFirm={cc.contact?.firm}
                          contactInitials={`${cc.contact?.first_name?.[0] || ''}${cc.contact?.last_name?.[0] || ''}`}
                          isApproved={!!isApproved}
                          isSent={false}
                          onApprove={async () => handleApproveEmail(email)}
                          onUnapprove={async () => handleUnapproveEmail(email)}
                          onSend={async () => handleSendEmail(email, cc)}
                          onSave={async (updates) => handleSaveEmail(email.id, updates)}
                          onRegenerate={async (senderId?: string) => handleRegenerateDraft(cc.contact_id, senderId)}
                          onDelete={() => handleDeleteContact(cc.id, `${cc.contact?.first_name} ${cc.contact?.last_name}`)}
                          onSaveFormat={(format) => {
                            console.log('[CampaignPage] Saving format from email (structure only, not content)...')

                            // Build email body from format data
                            const emailBody: EmailJsonBody = {
                              greeting: format.bodyStructure.greeting,
                              context_p1: format.bodyStructure.context_p1,
                              value_p2: format.bodyStructure.value_p2,
                              cta: format.bodyStructure.cta,
                              bannerEnabled: format.bannerEnabled,
                              signatureMemberId: format.signatureMemberId,
                              signature: format.signature,
                            }

                            console.log('[CampaignPage] Format saved - will use AI to transfer structure to other emails')

                            // Save format with metadata (not placeholders - actual content for AI to learn from)
                            setSavedFormat({
                              templateBody: emailBody,
                              templateHtml: format.htmlContent,
                              bannerEnabled: format.bannerEnabled,
                              savedFromEmail: email.id,
                              savedFromContactName: cc.contact?.first_name || 'Unknown',
                              savedAt: new Date().toISOString(),
                            })

                            setSuccessMessage('Format saved! Click "Apply Format to All" to reformat other emails with AI (content preserved).')
                            setTimeout(() => setSuccessMessage(null), 4000)
                          }}
                        />
                      )
                    })}
                    
                    {/* Load More Button */}
                    {hasMore && (
                      <div className="pt-4 pb-2 flex justify-center">
                        <button
                          onClick={() => setDisplayLimit(prev => prev + EMAILS_PER_PAGE)}
                          className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors flex items-center space-x-2"
                        >
                          <span>Load More ({sortedContacts.length - displayLimit} remaining)</span>
                          <ChevronDown className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </>
                )
              })()}
            </div>
          )}
        </div>
        {campaign.prompt && <div className="mt-6 bg-white rounded-xl border border-gray-200 p-6"><h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">Campaign Prompt</h3><p className="text-gray-700">{campaign.prompt}</p></div>}
      </main>

      {showAddContacts && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-xl">
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Add VCs to Campaign</h2>
                  <p className="text-sm text-gray-500 mt-1">Select VCs from your contact sheets</p>
                </div>
                <button onClick={() => { setShowAddContacts(false); setSelectedContacts([]); setModalSearchQuery('') }} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                  <X className="h-5 w-5" />
                </button>
              </div>
              {/* Search Bar */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by name, email, firm, or role..."
                  value={modalSearchQuery}
                  onChange={(e) => setModalSearchQuery(e.target.value)}
                  className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-sm"
                />
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {modalSearchQuery && (
                  <button onClick={() => setModalSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Streamlined Filters - Only key ones */}
              {contactLists.length > 0 && (
                <div className="mt-4">
                  <ContactFilters
                    contactLists={contactLists}
                    selectedListIds={modalSelectedListIds}
                    onListSelectionChange={setModalSelectedListIds}
                    activeFilters={modalActiveFilters}
                    onFiltersChange={setModalActiveFilters}
                    totalCount={availableContacts.length}
                    filteredCount={modalActiveFilters.length > 0 || modalSelectedListIds.length > 0 ? filteredAvailableContacts.length : undefined}
                  />
                  {/* Regenerate Filters button - show when a specific list is selected */}
                  {modalSelectedListIds.length === 1 && (
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        onClick={() => regenerateFilters(modalSelectedListIds[0])}
                        disabled={isRegeneratingFilters}
                        className="text-xs text-purple-600 hover:text-purple-700 underline disabled:opacity-50"
                      >
                        {isRegeneratingFilters ? 'Regenerating filters...' : 'No filters showing? Click to regenerate'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Body - Sheets Accordion */}
            <div className="flex-1 overflow-y-auto p-6">
              {availableContacts.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">All contacts are already in this campaign</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Quick Stats & Select X */}
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                    <span className="text-sm text-gray-600">
                      <span className="font-semibold text-gray-900">{contactLists.length + (filteredAvailableContacts.some(c => !c.contact_list_id) ? 1 : 0)}</span> sources · <span className="font-semibold text-gray-900">{filteredAvailableContacts.length}</span> contacts
                    </span>
                    <div className="flex items-center gap-3">
                      {/* Select X contacts input */}
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-500">Select</span>
                        <input
                          type="number"
                          min="1"
                          max={filteredAvailableContacts.length}
                          value={selectCount}
                          onChange={(e) => setSelectCount(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const count = parseInt(selectCount)
                              if (count > 0) selectXContacts(count)
                            }
                          }}
                          placeholder="X"
                          className="w-16 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-brand-500 focus:border-brand-500"
                        />
                        <button
                          onClick={() => {
                            const count = parseInt(selectCount)
                            if (count > 0) selectXContacts(count)
                          }}
                          disabled={!selectCount || parseInt(selectCount) < 1}
                          className="px-2 py-1 text-xs bg-brand-600 text-white rounded hover:bg-brand-700 disabled:opacity-50"
                        >
                          Go
                        </button>
                      </div>
                      <span className="text-gray-300">|</span>
                      <button
                        onClick={() => {
                          const allIds = new Set(contactLists.map(l => l.id))
                          allIds.add('__manual__')
                          setExpandedSheets(allIds)
                        }}
                        className="text-xs text-brand-600 hover:text-brand-700"
                      >
                        Expand All
                      </button>
                      <button
                        onClick={() => setExpandedSheets(new Set())}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        Collapse All
                      </button>
                    </div>
                  </div>

                  {/* Sheet Accordions */}
                  {contactLists.map((list) => {
                    const listContacts = filteredAvailableContacts.filter(c => c.contact_list_id === list.id)
                    const searchedContacts = modalSearchQuery
                      ? listContacts.filter(c =>
                        `${c.first_name} ${c.last_name} ${c.email} ${c.firm || ''} ${c.role || ''}`
                          .toLowerCase()
                          .includes(modalSearchQuery.toLowerCase())
                      )
                      : listContacts
                    const selectedInList = searchedContacts.filter(c => selectedContacts.includes(c.id)).length
                    const isExpanded = expandedSheets.has(list.id)

                    if (searchedContacts.length === 0 && modalSearchQuery) return null

                    return (
                      <div key={list.id} className="border border-gray-200 rounded-xl overflow-hidden">
                        {/* Sheet Header */}
                        <button
                          onClick={() => {
                            const newExpanded = new Set(expandedSheets)
                            if (isExpanded) {
                              newExpanded.delete(list.id)
                            } else {
                              newExpanded.add(list.id)
                            }
                            setExpandedSheets(newExpanded)
                          }}
                          className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            {isExpanded ? (
                              <ChevronDown className="h-5 w-5 text-gray-400" />
                            ) : (
                              <ChevronRight className="h-5 w-5 text-gray-400" />
                            )}
                            <FileSpreadsheet className="h-5 w-5 text-brand-500" />
                            <span className="font-medium text-gray-900">{list.name}</span>
                            <span className="text-sm text-gray-500">({searchedContacts.length} contacts)</span>
                          </div>
                          <div className="flex items-center gap-3">
                            {selectedInList > 0 && (
                              <span className="px-2 py-1 bg-brand-100 text-brand-700 text-xs font-medium rounded-full">
                                {selectedInList} selected
                              </span>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                const allIds = searchedContacts.map(c => c.id)
                                if (selectedInList === searchedContacts.length) {
                                  setSelectedContacts(prev => prev.filter(id => !allIds.includes(id)))
                                } else {
                                  setSelectedContacts(prev => Array.from(new Set([...prev, ...allIds])))
                                }
                              }}
                              className="text-xs text-brand-600 hover:text-brand-700 font-medium px-2 py-1 hover:bg-brand-50 rounded"
                            >
                              {selectedInList === searchedContacts.length ? 'Deselect All' : 'Select All'}
                            </button>
                          </div>
                        </button>

                        {/* Contacts List - Limited to 300 */}
                        {isExpanded && (
                          <div className="p-4">
                            {searchedContacts.length > 300 && (
                              <div className="mb-3 bg-amber-50 px-3 py-2 rounded-lg text-sm text-amber-700">
                                Showing first 300 of {searchedContacts.length} contacts. Use search above to find specific contacts.
                              </div>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {searchedContacts.slice(0, 300).map((contact) => (
                              <div
                                key={contact.id}
                                onClick={() => toggleContact(contact.id)}
                                className={`flex items-start p-3 rounded-lg border cursor-pointer transition-all ${selectedContacts.includes(contact.id)
                                  ? 'border-brand-500 bg-brand-50'
                                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                  }`}
                              >
                                <div className={`w-5 h-5 rounded border-2 mr-3 mt-0.5 flex-shrink-0 flex items-center justify-center transition-colors ${selectedContacts.includes(contact.id) ? 'bg-brand-600 border-brand-600' : 'border-gray-300'
                                  }`}>
                                  {selectedContacts.includes(contact.id) && <CheckCircle className="h-3 w-3 text-white" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-gray-900 truncate">{contact.first_name} {contact.last_name}</p>
                                  <p className="text-sm text-brand-600 truncate">{contact.firm || 'No firm'}</p>
                                  <p className="text-xs text-gray-500 truncate">{contact.role || contact.email}</p>
                                </div>
                              </div>
                            ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {/* Manual / No Sheet VCs */}
                  {(() => {
                    const manualContacts = filteredAvailableContacts.filter(c => !c.contact_list_id)
                    const searchedManual = modalSearchQuery
                      ? manualContacts.filter(c =>
                        `${c.first_name} ${c.last_name} ${c.email} ${c.firm || ''} ${c.role || ''}`
                          .toLowerCase()
                          .includes(modalSearchQuery.toLowerCase())
                      )
                      : manualContacts
                    const selectedInManual = searchedManual.filter(c => selectedContacts.includes(c.id)).length
                    const isManualExpanded = expandedSheets.has('__manual__')

                    if (searchedManual.length === 0) return null

                    return (
                      <div className="border border-gray-200 rounded-xl overflow-hidden">
                        <button
                          onClick={() => {
                            const newExpanded = new Set(expandedSheets)
                            if (isManualExpanded) {
                              newExpanded.delete('__manual__')
                            } else {
                              newExpanded.add('__manual__')
                            }
                            setExpandedSheets(newExpanded)
                          }}
                          className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            {isManualExpanded ? <ChevronDown className="h-5 w-5 text-gray-400" /> : <ChevronRight className="h-5 w-5 text-gray-400" />}
                            <Users className="h-5 w-5 text-gray-500" />
                            <span className="font-medium text-gray-900">Manual / No Sheet</span>
                            <span className="text-sm text-gray-500">({searchedManual.length} contacts)</span>
                          </div>
                          <div className="flex items-center gap-3">
                            {selectedInManual > 0 && (
                              <span className="px-2 py-1 bg-brand-100 text-brand-700 text-xs font-medium rounded-full">
                                {selectedInManual} selected
                              </span>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                const allIds = searchedManual.map(c => c.id)
                                if (selectedInManual === searchedManual.length) {
                                  setSelectedContacts(prev => prev.filter(id => !allIds.includes(id)))
                                } else {
                                  setSelectedContacts(prev => Array.from(new Set([...prev, ...allIds])))
                                }
                              }}
                              className="text-xs text-brand-600 hover:text-brand-700 font-medium px-2 py-1 hover:bg-brand-50 rounded"
                            >
                              {selectedInManual === searchedManual.length ? 'Deselect All' : 'Select All'}
                            </button>
                          </div>
                        </button>
                        {isManualExpanded && (
                          <div className="p-4">
                            {searchedManual.length > 300 && (
                              <div className="mb-3 bg-amber-50 px-3 py-2 rounded-lg text-sm text-amber-700">
                                Showing first 300 of {searchedManual.length} contacts. Use search above to find specific contacts.
                              </div>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {searchedManual.slice(0, 300).map((contact) => (
                              <div
                                key={contact.id}
                                onClick={() => toggleContact(contact.id)}
                                className={`flex items-start p-3 rounded-lg border cursor-pointer transition-all ${selectedContacts.includes(contact.id) ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                  }`}
                              >
                                <div className={`w-5 h-5 rounded border-2 mr-3 mt-0.5 flex-shrink-0 flex items-center justify-center transition-colors ${selectedContacts.includes(contact.id) ? 'bg-brand-600 border-brand-600' : 'border-gray-300'
                                  }`}>
                                  {selectedContacts.includes(contact.id) && <CheckCircle className="h-3 w-3 text-white" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-gray-900 truncate">{contact.first_name} {contact.last_name}</p>
                                  <p className="text-sm text-brand-600 truncate">{contact.firm || 'No firm'}</p>
                                  <p className="text-xs text-gray-500 truncate">{contact.role || contact.email}</p>
                                </div>
                              </div>
                            ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>

            {/* Progress Bar */}
            {(isGenerating || isAddingContacts) && (
              <div className="px-6 py-4 border-t border-gray-100 bg-brand-50">
                <div className="flex items-center space-x-3">
                  <Zap className="h-5 w-5 text-brand-600 animate-pulse" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-brand-900 mb-1">
                      {isGenerating ? 'Generating personalized drafts...' : 'Adding contacts to campaign...'}
                    </p>
                    <div className="h-2 bg-brand-200 rounded-full overflow-hidden">
                      <div className="h-full bg-brand-600 transition-all duration-300" style={{ width: `${generatingProgress}%` }} />
                    </div>
                  </div>
                  <span className="text-sm font-medium text-brand-700">{Math.round(generatingProgress)}%</span>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm text-gray-600">
                  <span className="font-bold text-brand-600">{selectedContacts.length}</span> VC{selectedContacts.length !== 1 ? 's' : ''} selected
                </span>
                {selectedContacts.length > 20 && (
                  <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                    Tip: For large selections, use "Add Only" then batch generate
                  </span>
                )}
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => { setShowAddContacts(false); setSelectedContacts([]); setModalSearchQuery('') }}
                  disabled={isGenerating || isAddingContacts}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                {/* Add Only button - for large batches */}
                <button
                  onClick={handleAddContactsOnly}
                  disabled={selectedContacts.length === 0 || isGenerating || isAddingContacts}
                  className="flex items-center space-x-2 px-4 py-2 border border-brand-600 text-brand-600 rounded-lg hover:bg-brand-50 disabled:opacity-50 transition-colors font-medium"
                  title="Add contacts without generating drafts - use batch generation after"
                >
                  {isAddingContacts ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /><span>Adding...</span></>
                  ) : (
                    <><Plus className="h-4 w-4" /><span>Add Only ({selectedContacts.length})</span></>
                  )}
                </button>
                {/* Add & Generate button - for small batches */}
                <button
                  onClick={handleAddContacts}
                  disabled={selectedContacts.length === 0 || selectedContacts.length > 50 || isGenerating || isAddingContacts}
                  className="flex items-center space-x-2 px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors font-medium"
                  title={selectedContacts.length > 50 ? 'Use "Add Only" for large selections' : 'Add contacts and generate drafts'}
                >
                  {isGenerating ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /><span>Generating...</span></>
                  ) : (
                    <><Zap className="h-4 w-4" /><span>Add & Generate{selectedContacts.length > 50 ? ' (max 50)' : ''}</span></>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Batch Generation Modal */}
      <BatchGenerationModal
        isOpen={showBatchGeneration}
        onClose={() => setShowBatchGeneration(false)}
        campaignId={campaignId}
        contactIds={contactIdsNeedingDrafts.slice(0, 100)}
        totalPending={contactIdsNeedingDrafts.length}
        onComplete={refreshBulkStats}
      />
      
      {/* Edit Template Modal */}
      {showEditTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Edit Campaign Template</h2>
                <button onClick={() => setShowEditTemplate(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-1">Changes will apply to new drafts. Existing drafts won't be affected.</p>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Subject Line</label>
                <input
                  type="text"
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  placeholder="e.g., Quick intro - Astant x [FIRM]"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
                <p className="text-xs text-gray-500 mt-1">Use [FIRST_NAME], [FIRM], [SENDER_FIRST_NAME] for placeholders</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email Body Template</label>
                <RichTextEditor
                  content={editBody}
                  onChange={setEditBody}
                  placeholder="Hi [FIRST_NAME], I'm [SENDER_FIRST_NAME] from Astant Global Management..."
                  className="min-h-[300px]"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Available placeholders: [FIRST_NAME], [LAST_NAME], [FIRM], [ROLE], [SENDER_FIRST_NAME], [SENDER_NAME], [SENDER_TITLE]
                </p>
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3 bg-gray-50 rounded-b-2xl">
              <button
                onClick={() => setShowEditTemplate(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTemplate}
                disabled={isSavingTemplate || !editSubject.trim() || !editBody.trim()}
                className="flex items-center space-x-2 px-5 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
              >
                {isSavingTemplate ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    <span>Save Template</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}