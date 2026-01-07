'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  ArrowLeft, 
  Building,
  MapPin,
  Briefcase,
  Mail,
  Edit2,
  Trash2,
  Target,
  Loader2,
  Plus,
  Send,
  Clock,
  CheckCircle,
  AlertCircle,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Eye,
  Calendar,
  Users
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { generateDraft } from '@/lib/api'
import type { Contact, Campaign, ContactCampaign, Email, ContactList } from '@/lib/types'
import { formatDate, getConfidenceColor, getStageLabel } from '@/lib/utils'
import { formatCellValue } from '@/lib/spreadsheet-parser'

// Pipeline stages in order
const PIPELINE_STAGES: { key: string; label: string; icon: React.ReactNode; color: string }[] = [
  { key: 'drafted', label: 'Drafted', icon: <Edit2 className="h-4 w-4" />, color: 'bg-gray-400' },
  { key: 'approved', label: 'Approved', icon: <CheckCircle className="h-4 w-4" />, color: 'bg-blue-500' },
  { key: 'sent', label: 'Sent', icon: <Send className="h-4 w-4" />, color: 'bg-indigo-500' },
  { key: 'opened', label: 'Opened', icon: <Eye className="h-4 w-4" />, color: 'bg-purple-500' },
  { key: 'replied', label: 'Replied', icon: <MessageSquare className="h-4 w-4" />, color: 'bg-green-500' },
  { key: 'meeting', label: 'Meeting', icon: <Calendar className="h-4 w-4" />, color: 'bg-emerald-500' },
  { key: 'closed', label: 'Closed', icon: <CheckCircle className="h-4 w-4" />, color: 'bg-green-600' },
  { key: 'passed', label: 'Passed', icon: <AlertCircle className="h-4 w-4" />, color: 'bg-red-500' },
]

export default function ContactDetailPage() {
  const params = useParams()
  const router = useRouter()
  const contactId = params.id as string

  const [contact, setContact] = useState<(Contact & { contact_list?: ContactList }) | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [contactCampaigns, setContactCampaigns] = useState<(ContactCampaign & { campaign?: Campaign; emails?: Email[] })[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showAddToCampaign, setShowAddToCampaign] = useState(false)
  const [selectedCampaign, setSelectedCampaign] = useState<string>('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAllRawData, setShowAllRawData] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true)
      try {
        // Fetch contact with its list
        const { data: contactData, error: contactError } = await supabase
          .from('contacts')
          .select(`
            *,
            contact_list:contact_lists (*)
          `)
          .eq('id', contactId)
          .single()

        if (contactError) throw contactError
        setContact(contactData)

        // Fetch all campaigns for dropdown
        const { data: campaignsData } = await supabase
          .from('campaigns')
          .select('*')
          .order('created_at', { ascending: false })
        
        setCampaigns(campaignsData || [])

        // Fetch contact's campaigns with emails
        const { data: ccData } = await supabase
          .from('contact_campaigns')
          .select(`
            *,
            campaign:campaigns (*),
            emails:emails (*)
          `)
          .eq('contact_id', contactId)

        setContactCampaigns(ccData || [])
      } catch (err) {
        console.error('Failed to fetch contact:', err)
      } finally {
        setIsLoading(false)
      }
    }

    if (contactId) {
      fetchData()
    }
  }, [contactId])

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this contact? This will also remove them from all campaigns. This cannot be undone.')) {
      return
    }

    setIsDeleting(true)
    
    // Check if this is a demo contact
    const isDemoContact = contactId.startsWith('demo-')
    
    try {
      if (!isDemoContact) {
        // First delete all emails for this contact's campaigns
        const ccIds = contactCampaigns.map(cc => cc.id)
        if (ccIds.length > 0) {
          await supabase.from('emails').delete().in('contact_campaign_id', ccIds)
          await supabase.from('contact_campaigns').delete().eq('contact_id', contactId)
        }
        
        // Then delete the contact from database
        const { error } = await supabase
          .from('contacts')
          .delete()
          .eq('id', contactId)

        if (error) throw error
      }
      // Always redirect back to contacts (for both demo and real)
      router.push('/contacts')
    } catch (err) {
      console.error('Failed to delete contact:', err)
      setError('Failed to delete contact')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleAddToCampaign = async () => {
    if (!selectedCampaign) return

    setIsGenerating(true)
    setError(null)

    try {
      // First create unified thread
      const { data: thread, error: threadError } = await supabase
        .from('unified_threads')
        .insert({
          firm_name: contact?.firm || 'Unknown Firm',
          status: 'active',
        })
        .select()
        .single()

      if (threadError) throw threadError

      // Create contact_campaign record
      const { data: cc, error: ccError } = await supabase
        .from('contact_campaigns')
        .insert({
          contact_id: contactId,
          campaign_id: selectedCampaign,
          unified_thread_id: thread.id,
          stage: 'drafted',
          confidence_score: 'yellow',
        })
        .select(`*, campaign:campaigns (*)`)
        .single()

      if (ccError) throw ccError

      // Generate draft
      const signature = `Best regards,\n${contact?.first_name || 'Team'}\nAstant Global Management`
      
      const result = await generateDraft({
        contact_id: contactId,
        campaign_id: selectedCampaign,
        signature,
      })

      // Refresh contact campaigns
      const { data: updatedCc } = await supabase
        .from('contact_campaigns')
        .select(`*, campaign:campaigns (*), emails:emails (*)`)
        .eq('contact_id', contactId)

      setContactCampaigns(updatedCc || [])
      setShowAddToCampaign(false)
      setSelectedCampaign('')
    } catch (err: any) {
      console.error('Failed to add to campaign:', err)
      setError(err.message || 'Failed to generate draft')
    } finally {
      setIsGenerating(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-gray-400 animate-spin" />
      </div>
    )
  }

  if (!contact) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Contact not found</h2>
          <Link href="/contacts" className="text-brand-600 hover:text-brand-700">
            Back to contacts
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/contacts" className="text-gray-400 hover:text-gray-600">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-brand-100 rounded-full flex items-center justify-center">
                  <span className="text-brand-700 font-semibold text-lg">
                    {contact.first_name[0]}{contact.last_name[0]}
                  </span>
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-gray-900">
                    {contact.first_name} {contact.last_name}
                  </h1>
                  <p className="text-sm text-gray-500">{contact.email}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="p-2 text-gray-400 hover:text-red-600 disabled:opacity-50"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border-b border-red-100 px-4 py-3">
          <div className="max-w-4xl mx-auto">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Pipeline Section */}
        <PipelineSection contactCampaigns={contactCampaigns} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Contact Info + Raw Data */}
          <div className="lg:col-span-1 space-y-6">
            {/* Contact Info Card */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
                Contact Details
              </h2>
              <div className="space-y-4">
                {contact.firm && (
                  <div className="flex items-start space-x-3">
                    <Building className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500">Firm</p>
                      <p className="text-sm font-medium text-gray-900">{contact.firm}</p>
                    </div>
                  </div>
                )}
                {contact.role && (
                  <div className="flex items-start space-x-3">
                    <Briefcase className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500">Role</p>
                      <p className="text-sm font-medium text-gray-900">{contact.role}</p>
                    </div>
                  </div>
                )}
                {contact.geography && (
                  <div className="flex items-start space-x-3">
                    <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500">Location</p>
                      <p className="text-sm font-medium text-gray-900">{contact.geography}</p>
                    </div>
                  </div>
                )}
                {contact.investment_focus && (
                  <div className="flex items-start space-x-3">
                    <Target className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500">Investment Focus</p>
                      <p className="text-sm font-medium text-gray-900">{contact.investment_focus}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-start space-x-3">
                  <Clock className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">Added</p>
                    <p className="text-sm font-medium text-gray-900">{formatDate(contact.created_at)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Raw Spreadsheet Data Card */}
            {contact.raw_data && Object.keys(contact.raw_data).length > 0 && (
              <SpreadsheetDataCard 
                contact={contact} 
                showAll={showAllRawData}
                onToggle={() => setShowAllRawData(!showAllRawData)}
              />
            )}
          </div>

          {/* Campaigns & Emails */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
                  Campaigns & Emails
                </h2>
                <button
                  onClick={() => setShowAddToCampaign(true)}
                  className="flex items-center space-x-2 px-3 py-1.5 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add to Campaign</span>
                </button>
              </div>

              {contactCampaigns.length === 0 ? (
                <div className="text-center py-8">
                  <Mail className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">No campaigns yet</p>
                  <p className="text-gray-400 text-xs mt-1">Add this contact to a campaign to generate a draft</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {contactCampaigns.map((cc) => (
                    <div key={cc.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <Target className="h-4 w-4 text-gray-400" />
                          <span className="font-medium text-gray-900">
                            {cc.campaign?.name || 'Unknown Campaign'}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-0.5 text-xs rounded-full ${getConfidenceColor(cc.confidence_score)}`}>
                            {cc.confidence_score}
                          </span>
                          <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
                            {getStageLabel(cc.stage)}
                          </span>
                        </div>
                      </div>

                      {cc.emails && cc.emails.length > 0 ? (
                        <div className="space-y-2">
                          {cc.emails.map((email) => (
                            <div key={email.id} className="bg-gray-50 rounded p-3">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-gray-700">
                                  {email.subject}
                                </span>
                                <div className="flex items-center space-x-2">
                                  {email.sent_at ? (
                                    <span className="flex items-center text-xs text-green-600">
                                      <CheckCircle className="h-3 w-3 mr-1" />
                                      Sent
                                    </span>
                                  ) : email.approved ? (
                                    <span className="flex items-center text-xs text-blue-600">
                                      <CheckCircle className="h-3 w-3 mr-1" />
                                      Approved
                                    </span>
                                  ) : (
                                    <span className="flex items-center text-xs text-yellow-600">
                                      <Clock className="h-3 w-3 mr-1" />
                                      Pending Review
                                    </span>
                                  )}
                                </div>
                              </div>
                              <p className="text-xs text-gray-500 line-clamp-2">
                                {email.current_body.context_p1}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400">No emails generated yet</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Add to Campaign Modal */}
      {showAddToCampaign && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Add to Campaign</h2>
              <p className="text-sm text-gray-500 mt-1">
                Generate an AI-powered email draft for {contact.first_name}
              </p>
            </div>

            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Campaign
              </label>
              <select
                value={selectedCampaign}
                onChange={(e) => setSelectedCampaign(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              >
                <option value="">Choose a campaign...</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              {campaigns.length === 0 && (
                <p className="text-sm text-gray-500 mt-2">
                  No campaigns available. <Link href="/campaigns" className="text-brand-600">Create one first</Link>.
                </p>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowAddToCampaign(false)
                  setSelectedCampaign('')
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleAddToCampaign}
                disabled={!selectedCampaign || isGenerating}
                className="flex items-center space-x-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    <span>Generate Draft</span>
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

// Pipeline visualization component
function PipelineSection({ 
  contactCampaigns 
}: { 
  contactCampaigns: (ContactCampaign & { campaign?: Campaign; emails?: Email[] })[] 
}) {
  // Get the furthest stage across all campaigns
  const currentStages = contactCampaigns.map(cc => cc.stage)
  const stageOrder = PIPELINE_STAGES.map(s => s.key)
  
  const furthestStageIndex = currentStages.reduce((max, stage) => {
    const idx = stageOrder.indexOf(stage)
    return idx > max ? idx : max
  }, -1)

  if (contactCampaigns.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
          Pipeline Status
        </h2>
        <div className="flex items-center justify-center py-8 text-gray-400">
          <Users className="h-5 w-5 mr-2" />
          <span className="text-sm">Not yet added to any campaign</span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-6">
        Pipeline Status
      </h2>
      
      {/* Pipeline visualization */}
      <div className="relative">
        <div className="flex items-center justify-between">
          {PIPELINE_STAGES.filter(s => s.key !== 'passed').map((stage, index) => {
            const isActive = currentStages.includes(stage.key as any)
            const isPast = stageOrder.indexOf(stage.key) < furthestStageIndex
            const isCurrent = stageOrder.indexOf(stage.key) === furthestStageIndex
            const isPassed = currentStages.includes('passed' as any) && stage.key === 'passed'
            
            return (
              <div key={stage.key} className="flex flex-col items-center flex-1">
                {/* Connector line */}
                {index > 0 && (
                  <div 
                    className={`absolute h-1 top-5 ${
                      isPast || isActive ? 'bg-brand-500' : 'bg-gray-200'
                    }`}
                    style={{
                      left: `${(index - 1) * (100 / (PIPELINE_STAGES.length - 2)) + 50 / (PIPELINE_STAGES.length - 2)}%`,
                      width: `${100 / (PIPELINE_STAGES.length - 2) - 2}%`,
                    }}
                  />
                )}
                
                {/* Stage circle */}
                <div 
                  className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    isCurrent 
                      ? 'bg-brand-600 text-white ring-4 ring-brand-100' 
                      : isPast || isActive
                        ? 'bg-brand-500 text-white'
                        : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {stage.icon}
                </div>
                
                {/* Stage label */}
                <span className={`mt-2 text-xs font-medium ${
                  isCurrent ? 'text-brand-600' : isPast || isActive ? 'text-gray-700' : 'text-gray-400'
                }`}>
                  {stage.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Campaign stages breakdown */}
      {contactCampaigns.length > 1 && (
        <div className="mt-6 pt-6 border-t border-gray-100">
          <p className="text-xs text-gray-500 mb-3">Campaigns:</p>
          <div className="flex flex-wrap gap-2">
            {contactCampaigns.map(cc => (
              <div 
                key={cc.id}
                className="flex items-center space-x-2 px-3 py-1.5 bg-gray-50 rounded-full"
              >
                <span className={`w-2 h-2 rounded-full ${
                  cc.stage === 'passed' ? 'bg-red-500' :
                  cc.stage === 'closed' || cc.stage === 'meeting' ? 'bg-green-500' :
                  cc.stage === 'replied' ? 'bg-emerald-500' :
                  'bg-brand-500'
                }`} />
                <span className="text-xs text-gray-700">{cc.campaign?.name || 'Campaign'}</span>
                <span className="text-xs text-gray-400">• {getStageLabel(cc.stage)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Spreadsheet data display component
function SpreadsheetDataCard({ 
  contact, 
  showAll, 
  onToggle 
}: { 
  contact: Contact & { contact_list?: ContactList }
  showAll: boolean
  onToggle: () => void
}) {
  const rawData = contact.raw_data || {}
  const entries = Object.entries(rawData)
  const displayEntries = showAll ? entries : entries.slice(0, 6)
  const hasMore = entries.length > 6

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <FileSpreadsheet className="h-4 w-4 text-brand-600" />
          <span className="text-sm font-medium text-gray-900">
            Original Spreadsheet Data
          </span>
        </div>
        {contact.contact_list && (
          <p className="text-xs text-gray-500 mt-1">
            From: {contact.contact_list.file_name}
          </p>
        )}
      </div>

      {/* Data Grid */}
      <div className="divide-y divide-gray-100">
        {displayEntries.map(([key, value]) => (
          <div key={key} className="px-4 py-3 flex justify-between items-start">
            <span className="text-sm text-gray-500 font-medium">{key}</span>
            <span className="text-sm text-gray-900 text-right max-w-[60%] break-words">
              {formatCellValue(value)}
            </span>
          </div>
        ))}
      </div>

      {/* Show more/less toggle */}
      {hasMore && (
        <button
          onClick={onToggle}
          className="w-full px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-center space-x-2 text-sm text-gray-600 hover:bg-gray-100 transition-colors"
        >
          {showAll ? (
            <>
              <ChevronUp className="h-4 w-4" />
              <span>Show less</span>
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4" />
              <span>Show all {entries.length} fields</span>
            </>
          )}
        </button>
      )}
    </div>
  )
}
