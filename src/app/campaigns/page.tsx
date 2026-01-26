'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { 
  ArrowLeft, 
  Plus,
  Target,
  ChevronRight,
  Loader2,
  Sparkles,
  FileText,
  Users,
  Trash2,
  User
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import { TEAM_MEMBERS, getSignatureText, COMPANY_INFO } from '@/lib/signatures'
import { EMAIL_TEMPLATES, TEMPLATE_CATEGORIES, getTemplatesByCategory, type EmailTemplate } from '@/lib/email-templates'
import SignatureSelector from '@/components/signature-selector'
import TemplateSelector from '@/components/template-selector'
import { PROMPT_PRESETS, getPresetByCategory, type PromptCategory, type PromptPreset } from '@/lib/prompt-presets'

interface Campaign {
  id: string
  name: string
  prompt: string
  template_subject: string | null
  template_body: string | null
  status: 'draft' | 'ready' | 'active'
  contacts_count: number
  created_at: string
  sender_id?: string
  template_id?: string
  prompt_preset_id?: string | null
  reference_email?: string | null
}

// Safe localStorage getter (handles private browsing mode)
function safeGetLocalStorage(key: string): string {
  try {
    return localStorage.getItem(key) || '[]'
  } catch {
    return '[]'
  }
}

// Demo campaigns - only shown in development when no real data exists
const DEMO_CAMPAIGNS: Campaign[] = process.env.NODE_ENV === 'development' ? [
  {
    id: 'demo-1',
    name: 'Q1 2026 VC Outreach',
    prompt: 'A warm, founder-to-investor email introducing Astant. Mention our AI technology briefly. Ask for a 15-minute call. Keep it under 120 words.',
    template_subject: 'Quick intro - Astant x {firm}',
    template_body: `Hi {first_name},

I noticed {firm}'s recent focus on fintech infrastructure, and thought our work at Astant might resonate.

We're building AI-powered tools that help institutional investors and startups connect more efficiently. Think of it as the operating system for smarter capital allocation.

Given your background in {investment_focus}, I'd love to get your perspective on the space.

Would you be open to a quick 15-minute chat next week?

Best,
[Your name]`,
    status: 'ready',
    contacts_count: 25,
    created_at: new Date().toISOString(),
  },
] : []

export default function CampaignsPage() {
  const router = useRouter()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const supabase = createClient()

  // Get list of deleted demo campaign IDs from localStorage (with try-catch for private browsing)
  const getDeletedDemoIds = (): string[] => {
    try {
      return JSON.parse(localStorage.getItem('deleted_demo_campaigns') || '[]')
    } catch {
      return []
    }
  }

  // Filter out deleted demo campaigns
  const filterDeletedDemos = (campaigns: Campaign[]): Campaign[] => {
    const deletedIds = getDeletedDemoIds()
    return campaigns.filter(c => !deletedIds.includes(c.id))
  }

  const fetchCampaigns = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .order('created_at', { ascending: false })

      // Get locally stored campaigns
      const stored = JSON.parse(safeGetLocalStorage('local_campaigns'))
      
      if (!error && data?.length > 0) {
        // Merge database and local campaigns, avoiding duplicates
        const allCampaigns = [...data, ...stored.filter((s: Campaign) => !data.find(d => d.id === s.id))]
        setCampaigns(allCampaigns as Campaign[])
      } else if (stored.length > 0) {
        setCampaigns([...filterDeletedDemos(DEMO_CAMPAIGNS), ...stored])
      } else {
        setCampaigns(filterDeletedDemos(DEMO_CAMPAIGNS))
      }
    } catch {
      // Use demo data + local storage
      const stored = JSON.parse(safeGetLocalStorage('local_campaigns'))
      setCampaigns([...filterDeletedDemos(DEMO_CAMPAIGNS), ...stored])
    } finally {
      setIsLoading(false)
    }
  }

  const deleteCampaign = async (id: string) => {
    console.log('=== DELETE CAMPAIGN CALLED ===')
    console.log('Campaign ID:', id)
    console.log('Current campaigns:', campaigns)
    
    const userConfirmed = confirm('Delete this campaign and all its email drafts? This cannot be undone.')
    console.log('User confirmed:', userConfirmed)
    
    if (!userConfirmed) {
      console.log('User cancelled deletion')
      return
    }
    
    // Check if this is a demo campaign (starts with 'demo-')
    const isDemoCampaign = id.startsWith('demo-')
    console.log('Is demo campaign:', isDemoCampaign)
    
    try {
      if (isDemoCampaign) {
        // For demo campaigns, store the deleted ID in localStorage so it stays deleted
        const deletedIds = getDeletedDemoIds()
        if (!deletedIds.includes(id)) {
          deletedIds.push(id)
          localStorage.setItem('deleted_demo_campaigns', JSON.stringify(deletedIds))
        }
      } else {
        // For real campaigns, delete from database
        console.log('Deleting campaign from database:', id)
        
        // First delete all emails associated with this campaign's contact_campaigns
        const { data: contactCampaigns, error: ccError } = await supabase
          .from('contact_campaigns')
          .select('id')
          .eq('campaign_id', id)
        
        console.log('Found contact_campaigns:', contactCampaigns, 'Error:', ccError)
        
        if (contactCampaigns && contactCampaigns.length > 0) {
          const ccIds = contactCampaigns.map(cc => cc.id)
          
          // Get all email IDs for these contact_campaigns
          const { data: emails } = await supabase.from('emails').select('id').in('contact_campaign_id', ccIds)
          
          if (emails && emails.length > 0) {
            const emailIds = emails.map(e => e.id)
            // Delete engagement_events first (foreign key constraint)
            const { error: engagementError } = await supabase.from('engagement_events').delete().in('email_id', emailIds)
            console.log('Delete engagement_events error:', engagementError)
          }
          
          // Now delete emails
          const { error: emailError } = await supabase.from('emails').delete().in('contact_campaign_id', ccIds)
          console.log('Delete emails error:', emailError)
          const { error: ccDeleteError } = await supabase.from('contact_campaigns').delete().eq('campaign_id', id)
          console.log('Delete contact_campaigns error:', ccDeleteError)
        }
        
        // Now delete the campaign from database
        const { error: campaignError } = await supabase.from('campaigns').delete().eq('id', id)
        console.log('Delete campaign error:', campaignError)
        
        if (campaignError) {
          throw new Error(`Failed to delete campaign: ${campaignError.message}`)
        }
      }
      
      // Always remove from localStorage (for locally created campaigns)
      const stored = JSON.parse(safeGetLocalStorage('local_campaigns'))
      try {
        localStorage.setItem('local_campaigns', JSON.stringify(stored.filter((c: Campaign) => c.id !== id)))
      } catch {
        // localStorage may not be available
      }
      
      // Always update local state (this handles both demo and real campaigns)
      console.log('Updating state - removing campaign:', id)
      console.log('Campaigns before:', campaigns)
      setCampaigns(prev => {
        const newCampaigns = prev.filter(c => c.id !== id)
        console.log('Campaigns after filter:', newCampaigns)
        return newCampaigns
      })
      console.log('Delete successful!')
    } catch (err) {
      console.error('Failed to delete campaign:', err)
      alert('Failed to delete campaign: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
  }

  useEffect(() => {
    fetchCampaigns()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/" className="text-gray-400 hover:text-gray-600">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Campaigns</h1>
                <p className="text-sm text-gray-500">Email templates for your outreach</p>
              </div>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>New Campaign</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 text-gray-400 animate-spin" />
          </div>
        ) : campaigns.length === 0 ? (
          <EmptyState onCreate={() => setShowCreateModal(true)} />
        ) : (
          <div className="space-y-4">
            {campaigns.map(campaign => (
              <CampaignCard 
                key={campaign.id} 
                campaign={campaign}
                onClick={() => router.push(`/campaigns/${campaign.id}`)}
                onDelete={() => deleteCampaign(campaign.id)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateCampaignModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(campaign) => {
            setCampaigns([campaign, ...campaigns])
            setShowCreateModal(false)
            router.push(`/campaigns/${campaign.id}`)
          }}
        />
      )}
    </div>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="text-center py-16">
      <div className="w-20 h-20 bg-brand-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <Target className="h-10 w-10 text-brand-600" />
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">No campaigns yet</h3>
      <p className="text-gray-500 mb-8 max-w-md mx-auto">
        Create your first campaign by describing the email you want. 
        AI will generate a template you can personalize for each contact.
      </p>
      <button
        onClick={onCreate}
        className="inline-flex items-center space-x-2 px-6 py-3 bg-brand-600 text-white rounded-lg hover:bg-brand-700"
      >
        <Plus className="h-5 w-5" />
        <span>Create Campaign</span>
      </button>
    </div>
  )
}

function CampaignCard({ campaign, onClick, onDelete }: { campaign: Campaign; onClick: () => void; onDelete: () => void }) {
  const handleDelete = (e: React.MouseEvent) => {
    console.log('=== DELETE BUTTON CLICKED ===')
    console.log('Campaign being deleted:', campaign.id, campaign.name)
    e.stopPropagation()
    e.preventDefault()
    console.log('Calling onDelete...')
    onDelete()
    console.log('onDelete called')
  }
  
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl border border-gray-200 p-6 cursor-pointer hover:border-brand-300 hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-3 mb-2">
            <h3 className="text-lg font-semibold text-gray-900">{campaign.name}</h3>
            <StatusBadge status={campaign.status} />
            <button
              onClick={handleDelete}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
              title="Delete campaign"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          
          {/* Prompt preview */}
          <p className="text-sm text-gray-500 mb-4 line-clamp-2">
            {campaign.prompt}
          </p>

          {/* Template preview */}
          {campaign.template_subject && (
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <p className="text-xs text-gray-500 uppercase font-medium mb-1">Template Preview</p>
              <p className="text-sm font-medium text-gray-900">{campaign.template_subject}</p>
              <p className="text-sm text-gray-600 line-clamp-2 mt-1">
                {stripHtml(campaign.template_body || '').slice(0, 150)}...
              </p>
            </div>
          )}

          {/* Stats */}
          <div className="flex items-center space-x-4 text-sm text-gray-500">
            <span className="flex items-center space-x-1">
              <Users className="h-4 w-4" />
              <span>{campaign.contacts_count} contacts</span>
            </span>
            <span>Created {formatDate(campaign.created_at)}</span>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-gray-400" />
      </div>
    </div>
  )
}

// Strip HTML tags for text preview
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&nbsp;/g, ' ') // Replace nbsp
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
}

function StatusBadge({ status }: { status: Campaign['status'] }) {
  const styles = {
    draft: 'bg-gray-100 text-gray-600',
    ready: 'bg-green-100 text-green-700',
    active: 'bg-brand-100 text-brand-700',
  }
  const labels = {
    draft: 'Draft',
    ready: 'Ready',
    active: 'Active',
  }
  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}

function CreateCampaignModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (campaign: Campaign) => void
}) {
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<{
    id: string
    subject: string
    body: string
    placeholders: string[]
  } | null>(null)
  const [selectedSender, setSelectedSender] = useState('jean-francois')
  const [showTemplateSelector, setShowTemplateSelector] = useState(true) // Show template selector by default

  const supabase = createClient()

  // Handle template selection from selector modal
  const handleTemplateSelect = (template: EmailTemplate) => {
    setSelectedTemplate({
      id: template.id,
      subject: template.subject,
      body: template.body,
      placeholders: template.placeholders || [],
    })
    if (template.recommendedSender) {
      setSelectedSender(template.recommendedSender)
    }
    if (!name) {
      setName(template.name)
    }
    setShowTemplateSelector(false)
  }

  const handleSave = async () => {
    if (!selectedTemplate) return
    setError(null)

    // Only include fields that exist in the database schema
    const campaignData = {
      name: name || 'New Campaign',
      prompt: notes, // Store notes as prompt field
      template_subject: selectedTemplate.subject,
      template_body: selectedTemplate.body,
      status: 'ready',
      contacts_count: 0,
      global_context: JSON.stringify({ sender_id: selectedSender, template_id: selectedTemplate.id }),
    }

    try {
      // Try to save to database
      const { data, error: dbError } = await supabase
        .from('campaigns')
        .insert(campaignData)
        .select()
        .single()

      if (dbError) {
        console.error('Database error:', dbError)
        setError(`Database error: ${dbError.message}. Creating locally.`)
        
        // Create locally if DB fails
        const localCampaign: Campaign = {
          ...campaignData,
          status: 'ready' as const,
          id: crypto.randomUUID(),
          created_at: new Date().toISOString(),
          sender_id: selectedSender,
          template_id: selectedTemplate.id,
        }
        // Store in localStorage for detail page to find
        const stored = JSON.parse(safeGetLocalStorage('local_campaigns'))
        stored.push(localCampaign)
        try {
          localStorage.setItem('local_campaigns', JSON.stringify(stored))
        } catch {
          // localStorage may not be available
        }
        onCreated(localCampaign)
      } else {
        onCreated(data as Campaign)
      }
    } catch (err: any) {
      console.error('Error creating campaign:', err)
      setError(`Error: ${err.message}. Creating locally.`)
      
      // Create locally
      const localCampaign: Campaign = {
        ...campaignData,
        status: 'ready' as const,
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        sender_id: selectedSender,
        template_id: selectedTemplate.id,
      }
      // Store in localStorage for detail page to find
      const storedFallback = JSON.parse(safeGetLocalStorage('local_campaigns'))
      storedFallback.push(localCampaign)
      try {
        localStorage.setItem('local_campaigns', JSON.stringify(storedFallback))
      } catch {
        // localStorage may not be available
      }
      onCreated(localCampaign)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Create Campaign</h2>
              <p className="text-sm text-gray-500 mt-1">
                Select a template - emails will be personalized for each contact
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Template Selection - Main Focus */}
          {!selectedTemplate ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-brand-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="h-8 w-8 text-brand-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Choose a Template</h3>
              <p className="text-sm text-gray-500 mb-4">
                Select one of Jean-François's professional email templates
              </p>
              <button
                onClick={() => setShowTemplateSelector(true)}
                className="inline-flex items-center space-x-2 px-6 py-3 bg-brand-600 text-white rounded-lg hover:bg-brand-700"
              >
                <FileText className="h-5 w-5" />
                <span>Browse Templates</span>
              </button>
            </div>
          ) : (
            <>
              {/* Selected Template Preview */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <FileText className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-green-800">Template Selected</span>
                  </div>
                  <button
                    onClick={() => setShowTemplateSelector(true)}
                    className="text-sm text-brand-600 hover:text-brand-700"
                  >
                    Change
                  </button>
                </div>
                <div className="bg-white rounded-lg p-3 border border-green-200">
                  <p className="text-sm font-medium text-gray-900 mb-1">
                    Subject: {selectedTemplate.subject}
                  </p>
                  <p className="text-xs text-gray-500 line-clamp-3">
                    {selectedTemplate.body.substring(0, 200)}...
                  </p>
                </div>
                {selectedTemplate.placeholders.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs text-green-700 mb-1">Placeholders that will be personalized:</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedTemplate.placeholders.map(p => (
                        <code key={p} className="px-2 py-0.5 bg-white border border-green-300 text-green-700 text-xs rounded">
                          [{p}]
                        </code>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Sender Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Send As
                </label>
                <SignatureSelector
                  selectedMemberId={selectedSender}
                  onSelect={setSelectedSender}
                  showPreview={true}
                />
              </div>
              
              {/* Campaign Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Campaign Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Q1 2026 VC Outreach"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>

              {/* Notes (Optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Any notes about this campaign..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>

              {/* Info Box */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-700">
                  <strong>How it works:</strong> When you add contacts to this campaign, 
                  the system will automatically replace placeholders like [RECIPIENT_NAME] 
                  with their actual information. The email text stays exactly the same.
                </p>
              </div>
            </>
          )}

          {/* Error */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
          {selectedTemplate && (
            <button
              onClick={handleSave}
              className="flex items-center space-x-2 px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700"
            >
              <FileText className="h-4 w-4" />
              <span>Create Campaign</span>
            </button>
          )}
        </div>
      </div>
      
      {/* Template Selector Modal */}
      {showTemplateSelector && (
        <TemplateSelector
          onSelect={handleTemplateSelect}
          onClose={() => setShowTemplateSelector(false)}
        />
      )}
    </div>
  )
}
