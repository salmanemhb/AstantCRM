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
  Sparkles
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { generateDraft } from '@/lib/api'
import type { Contact, ContactCampaign, Email } from '@/lib/types'
import { formatDate, getToneLabel } from '@/lib/utils'
import GmailEmailComposer from '@/components/gmail-email-composer'
import BulkOperationsPanel, { BatchGenerationModal } from '@/components/bulk-operations-panel'

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
}

interface ExtendedContactCampaign extends ContactCampaign {
  contact?: Contact
  emails?: Email[]
}

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
          const stored = JSON.parse(localStorage.getItem('local_campaigns') || '[]')
          const localCampaign = stored.find((c: any) => c.id === campaignId)
          setCampaign(localCampaign || null)
        } else {
          setCampaign(campaignData as LocalCampaign)
        }

        const { data: contactsData } = await supabase
          .from('contacts')
          .select('*')
          .order('last_name', { ascending: true })
        setContacts(contactsData || [])

        const { data: ccData } = await supabase
          .from('contact_campaigns')
          .select(`*, contact:contacts (*), emails:emails (*)`)
          .eq('campaign_id', campaignId)
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
          await supabase.from('emails').delete().in('contact_campaign_id', ccIds)
          await supabase.from('contact_campaigns').delete().eq('campaign_id', campaignId)
        }
        
        // Now delete the campaign from database
        await supabase.from('campaigns').delete().eq('id', campaignId)
      }
      
      // Always clean up localStorage
      const stored = JSON.parse(localStorage.getItem('local_campaigns') || '[]')
      localStorage.setItem('local_campaigns', JSON.stringify(stored.filter((c: any) => c.id !== campaignId)))
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
        await supabase.from('emails').delete().eq('contact_campaign_id', contactCampaignId)
        await supabase.from('contact_campaigns').delete().eq('id', contactCampaignId)
      }
      // Always update local state
      setContactCampaigns(prev => prev.filter(cc => cc.id !== contactCampaignId))
      setSuccessMessage(`${contactName} removed from campaign`)
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      setError('Failed to remove contact from campaign')
    }
  }

  const handleAddContacts = async () => {
    if (selectedContacts.length === 0) return
    setIsGenerating(true)
    setGeneratingProgress(0)
    setError(null)
    try {
      const existingContactIds = contactCampaigns.map(cc => cc.contact_id)
      const newContacts = selectedContacts.filter(id => !existingContactIds.includes(id))

      for (let i = 0; i < newContacts.length; i++) {
        const contactId = newContacts[i]
        const contact = contacts.find(c => c.id === contactId)

        const { data: thread, error: threadError } = await supabase
          .from('unified_threads')
          .insert({ firm_name: contact?.firm || 'Unknown Firm', status: 'active' })
          .select()
          .single()
        if (threadError) throw threadError

        await supabase.from('contact_campaigns').insert({
          contact_id: contactId,
          campaign_id: campaignId,
          unified_thread_id: thread.id,
          stage: 'drafted',
          confidence_score: 'yellow',
        })

        await generateDraft({
          contact_id: contactId,
          campaign_id: campaignId,
          signature: 'Best regards,\nAstant Global Management',
        })
        setGeneratingProgress(((i + 1) / newContacts.length) * 100)
      }

      const { data: updatedCc } = await supabase
        .from('contact_campaigns')
        .select(`*, contact:contacts (*), emails:emails (*)`)
        .eq('campaign_id', campaignId)
      setContactCampaigns(updatedCc || [])
      setShowAddContacts(false)
      setSelectedContacts([])
      
      setSuccessMessage(`Generated ${newContacts.length} draft${newContacts.length > 1 ? 's' : ''}!`)
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to generate drafts')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleApproveEmail = async (email: Email) => {
    try {
      await supabase.from('emails').update({ approved: true }).eq('id', email.id)
      await supabase.from('contact_campaigns').update({ stage: 'approved' }).eq('id', email.contact_campaign_id)
      setContactCampaigns(prev => prev.map(cc => cc.id === email.contact_campaign_id 
        ? { ...cc, stage: 'approved', emails: cc.emails?.map(e => e.id === email.id ? { ...e, approved: true } : e) } 
        : cc))
      setSuccessMessage('Email approved!')
      setTimeout(() => setSuccessMessage(null), 2000)
    } catch (err) {
      setError('Failed to approve email')
    }
  }

  const handleSaveEmail = async (emailId: string, updates: Partial<Email>) => {
    try {
      await supabase.from('emails').update(updates).eq('id', emailId)
      setContactCampaigns(prev => prev.map(cc => ({
        ...cc,
        emails: cc.emails?.map(e => e.id === emailId ? { ...e, ...updates } : e)
      })))
      setSuccessMessage('Email saved!')
      setTimeout(() => setSuccessMessage(null), 2000)
    } catch (err) {
      setError('Failed to save email')
    }
  }

  const handleSendEmail = async (email: Email, cc: ExtendedContactCampaign) => {
    try {
      // Use the send-email API endpoint
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email_id: email.id }),
      })
      
      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to send email')
      }
      
      // Update local state
      setContactCampaigns(prev => prev.map(item => item.id === email.contact_campaign_id 
        ? { ...item, stage: 'sent', emails: item.emails?.map(e => e.id === email.id ? { ...e, approved: true, sent_at: result.sent_at } : e) } 
        : item))
      setSuccessMessage(`Email sent to ${cc.contact?.first_name}!`)
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to send email')
    }
  }

  const handleRegenerateDraft = async (contactId: string) => {
    setError(null)
    try {
      await generateDraft({ contact_id: contactId, campaign_id: campaignId, signature: 'Best regards,\nAstant Global Management' })
      const { data: updatedCc } = await supabase.from('contact_campaigns').select(`*, contact:contacts (*), emails:emails (*)`).eq('campaign_id', campaignId)
      setContactCampaigns(updatedCc || [])
      setSuccessMessage('Draft regenerated!')
      setTimeout(() => setSuccessMessage(null), 2000)
    } catch (err: any) {
      setError(err.message || 'Failed to regenerate draft')
    }
  }

  const toggleContact = (contactId: string) => setSelectedContacts(prev => prev.includes(contactId) ? prev.filter(id => id !== contactId) : [...prev, contactId])
  const selectAllContacts = () => setSelectedContacts(availableContacts.map(c => c.id))
  const unselectAllContacts = () => setSelectedContacts([])
  const availableContacts = contacts.filter(c => !contactCampaigns.some(cc => cc.contact_id === c.id))

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
      setContactCampaigns(updatedCc || [])
    } catch (err) {
      console.error('Failed to refresh stats:', err)
    }
  }

  if (isLoading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><Loader2 className="h-8 w-8 text-gray-400 animate-spin" /></div>
  if (!campaign) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="text-center"><AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" /><h2 className="text-lg font-semibold text-gray-900 mb-2">Campaign not found</h2><Link href="/campaigns" className="text-brand-600 hover:text-brand-700">Back to campaigns</Link></div></div>

  const stats = { total: contactCampaigns.length, drafted: contactCampaigns.filter(cc => cc.stage === 'drafted').length, approved: contactCampaigns.filter(cc => cc.stage === 'approved').length, sent: contactCampaigns.filter(cc => cc.stage === 'sent').length }

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
              {availableContacts.length > 0 && (
                <button 
                  onClick={() => setShowBatchGeneration(true)} 
                  className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>Batch Generate</span>
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
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50"><h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Email Drafts</h2></div>
          {contactCampaigns.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4"><Mail className="h-8 w-8 text-gray-400" /></div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No drafts yet</h3>
              <p className="text-gray-500 mb-6">Add VCs to generate personalized email drafts</p>
              <button onClick={() => setShowAddContacts(true)} className="inline-flex items-center space-x-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700"><Plus className="h-4 w-4" /><span>Add VCs</span></button>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {contactCampaigns.map((cc) => {
                const email = cc.emails?.[0]
                if (!email) return null
                const isSent = cc.stage === 'sent'
                const isApproved = cc.stage === 'approved' || email?.approved
                return (
                  <GmailEmailComposer
                    key={cc.id}
                    email={email}
                    contactName={`${cc.contact?.first_name} ${cc.contact?.last_name}`}
                    contactEmail={cc.contact?.email || ''}
                    contactFirm={cc.contact?.firm}
                    contactInitials={`${cc.contact?.first_name?.[0] || ''}${cc.contact?.last_name?.[0] || ''}`}
                    isApproved={!!isApproved}
                    isSent={isSent}
                    onApprove={async () => handleApproveEmail(email)}
                    onSend={async () => handleSendEmail(email, cc)}
                    onSave={async (updates) => handleSaveEmail(email.id, updates)}
                    onRegenerate={async () => handleRegenerateDraft(cc.contact_id)}
                    onDelete={() => handleDeleteContact(cc.id, `${cc.contact?.first_name} ${cc.contact?.last_name}`)}
                  />
                )
              })}
            </div>
          )}
        </div>
        {campaign.prompt && <div className="mt-6 bg-white rounded-xl border border-gray-200 p-6"><h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">Campaign Prompt</h3><p className="text-gray-700">{campaign.prompt}</p></div>}
      </main>

      {showAddContacts && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] flex flex-col shadow-xl">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div><h2 className="text-xl font-bold text-gray-900">Add VCs to Campaign</h2><p className="text-sm text-gray-500 mt-1">Select VCs to generate personalized email drafts</p></div>
                <button onClick={() => { setShowAddContacts(false); setSelectedContacts([]) }} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"><X className="h-5 w-5" /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {availableContacts.length === 0 ? (
                <div className="text-center py-8"><Users className="h-12 w-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">All contacts are already in this campaign</p></div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                    <span className="text-sm text-gray-500">{availableContacts.length} contact{availableContacts.length !== 1 ? 's' : ''} available</span>
                    <div className="flex items-center space-x-2">
                      <button onClick={selectAllContacts} className="text-sm text-brand-600 hover:text-brand-700 font-medium">Select All</button>
                      <span className="text-gray-300">|</span>
                      <button onClick={unselectAllContacts} className="text-sm text-gray-500 hover:text-gray-700">Clear</button>
                    </div>
                  </div>
                  {availableContacts.map((contact) => (
                    <div key={contact.id} onClick={() => toggleContact(contact.id)} className={`flex items-center p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedContacts.includes(contact.id) ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}>
                      <div className={`w-5 h-5 rounded border-2 mr-3 flex items-center justify-center transition-colors ${selectedContacts.includes(contact.id) ? 'bg-brand-600 border-brand-600' : 'border-gray-300'}`}>
                        {selectedContacts.includes(contact.id) && <CheckCircle className="h-3 w-3 text-white" />}
                      </div>
                      <div className="w-10 h-10 bg-brand-100 rounded-full flex items-center justify-center mr-3"><span className="text-brand-700 font-semibold text-sm">{contact.first_name[0]}{contact.last_name[0]}</span></div>
                      <div className="flex-1"><p className="font-medium text-gray-900">{contact.first_name} {contact.last_name}</p><p className="text-sm text-gray-500">{contact.firm || contact.email}</p></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {isGenerating && (
              <div className="px-6 py-4 border-t border-gray-100 bg-brand-50">
                <div className="flex items-center space-x-3">
                  <Zap className="h-5 w-5 text-brand-600 animate-pulse" />
                  <div className="flex-1"><p className="text-sm font-medium text-brand-900 mb-1">Generating personalized drafts...</p><div className="h-2 bg-brand-200 rounded-full overflow-hidden"><div className="h-full bg-brand-600 transition-all duration-300" style={{ width: `${generatingProgress}%` }} /></div></div>
                  <span className="text-sm font-medium text-brand-700">{Math.round(generatingProgress)}%</span>
                </div>
              </div>
            )}
            <div className="p-6 border-t border-gray-200 flex justify-between items-center bg-gray-50 rounded-b-2xl">
              <span className="text-sm text-gray-600"><span className="font-semibold">{selectedContacts.length}</span> VC{selectedContacts.length !== 1 ? 's' : ''} selected</span>
              <div className="flex space-x-3">
                <button onClick={() => { setShowAddContacts(false); setSelectedContacts([]) }} disabled={isGenerating} className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50">Cancel</button>
                <button onClick={handleAddContacts} disabled={selectedContacts.length === 0 || isGenerating} className="flex items-center space-x-2 px-5 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors">
                  {isGenerating ? <><Loader2 className="h-4 w-4 animate-spin" /><span>Generating...</span></> : <><Zap className="h-4 w-4" /><span>Generate Drafts</span></>}
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
        contactIds={availableContacts.map(c => c.id)}
        onComplete={refreshBulkStats}
      />
    </div>
  )
}