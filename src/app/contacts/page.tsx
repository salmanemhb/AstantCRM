'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { 
  ArrowLeft, 
  Plus,
  Users,
  Search,
  ChevronRight,
  ChevronDown,
  Loader2,
  Upload,
  FileSpreadsheet,
  Trash2
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Contact, ContactList } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import { formatCellValue } from '@/lib/spreadsheet-parser'
import ImportContactsModal from '@/components/import-contacts-modal'

// Demo data - only shown in development when no real data exists
const DEMO_LISTS: (ContactList & { contacts: Contact[] })[] = process.env.NODE_ENV === 'development' ? [
  {
    id: 'demo-list-1',
    name: 'Q1 2026 VC Targets',
    file_name: 'q1_vc_list.csv',
    file_type: 'csv',
    column_mapping: { email: 'Email', first_name: 'First Name', last_name: 'Last Name', firm: 'Fund' },
    original_headers: ['First Name', 'Last Name', 'Email', 'Fund', 'Title', 'AUM'],
    row_count: 3,
    created_at: new Date().toISOString(),
    contacts: [
      {
        id: 'demo-1',
        contact_list_id: 'demo-list-1',
        first_name: 'Sarah',
        last_name: 'Chen',
        email: 'sarah@sequoia.com',
        firm: 'Sequoia Capital',
        role: 'Partner',
        geography: 'San Francisco',
        investment_focus: 'Enterprise SaaS, Developer Tools',
        notes_private: null,
        raw_data: { 'First Name': 'Sarah', 'Last Name': 'Chen', 'Email': 'sarah@sequoia.com', 'Fund': 'Sequoia Capital', 'Title': 'Partner', 'AUM': '$85B' },
        created_at: new Date().toISOString(),
      },
      {
        id: 'demo-2',
        contact_list_id: 'demo-list-1',
        first_name: 'Marcus',
        last_name: 'Thompson',
        email: 'marcus@a16z.com',
        firm: 'Andreessen Horowitz',
        role: 'General Partner',
        geography: 'Menlo Park',
        investment_focus: 'Fintech, AI/ML',
        notes_private: null,
        raw_data: { 'First Name': 'Marcus', 'Last Name': 'Thompson', 'Email': 'marcus@a16z.com', 'Fund': 'Andreessen Horowitz', 'Title': 'General Partner', 'AUM': '$35B' },
        created_at: new Date().toISOString(),
      },
    ],
  },
  {
    id: 'demo-list-2',
    name: 'European Investors',
    file_name: 'europe_investors.xlsx',
    file_type: 'xlsx',
    column_mapping: { email: 'Contact Email', first_name: 'Contact', firm: 'Organisation' },
    original_headers: ['Contact', 'Contact Email', 'Organisation', 'City', 'Stage Focus'],
    row_count: 1,
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    contacts: [
      {
        id: 'demo-3',
        contact_list_id: 'demo-list-2',
        first_name: 'Elena',
        last_name: 'Rodriguez',
        email: 'elena@index.eu',
        firm: 'Index Ventures',
        role: 'Principal',
        geography: 'London',
        investment_focus: 'B2B Marketplaces',
        notes_private: null,
        raw_data: { 'Contact': 'Elena Rodriguez', 'Contact Email': 'elena@index.eu', 'Organisation': 'Index Ventures', 'City': 'London', 'Stage Focus': 'Series A-B' },
        created_at: new Date().toISOString(),
      },
    ],
  },
] : []

export default function ContactsPage() {
  const [lists, setLists] = useState<(ContactList & { contacts: Contact[] })[]>([])
  const [manualContacts, setManualContacts] = useState<Contact[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showImportModal, setShowImportModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [expandedLists, setExpandedLists] = useState<Set<string>>(new Set(['demo-list-1']))

  const supabase = createClient()

  // Get list of deleted demo list IDs from localStorage
  const getDeletedDemoListIds = (): string[] => {
    return JSON.parse(localStorage.getItem('deleted_demo_lists') || '[]')
  }

  // Filter out deleted demo lists
  const filterDeletedDemoLists = (lists: (ContactList & { contacts: Contact[] })[]): (ContactList & { contacts: Contact[] })[] => {
    const deletedIds = getDeletedDemoListIds()
    return lists.filter(l => !deletedIds.includes(l.id))
  }

  const fetchData = async () => {
    console.log('[ContactsPage] fetchData starting...')
    setIsLoading(true)
    try {
      // Fetch contact lists with their contacts
      console.log('[ContactsPage] Fetching contact lists from Supabase...')
      const { data: listsData, error: listsError } = await supabase
        .from('contact_lists')
        .select(`
          *,
          contacts (*)
        `)
        .order('created_at', { ascending: false })

      if (listsError) {
        console.log('[ContactsPage] DB error, using demo data:', listsError.message)
        setLists(filterDeletedDemoLists(DEMO_LISTS))
      } else if (listsData && listsData.length > 0) {
        console.log('[ContactsPage] Found', listsData.length, 'contact lists')
        setLists(listsData as (ContactList & { contacts: Contact[] })[])
      } else {
        console.log('[ContactsPage] No lists found, using demo data')
        setLists(filterDeletedDemoLists(DEMO_LISTS))
      }

      // Fetch manual contacts (no list)
      console.log('[ContactsPage] Fetching manual contacts...')
      const { data: manualData, error: manualError } = await supabase
        .from('contacts')
        .select('*')
        .is('contact_list_id', null)
        .order('created_at', { ascending: false })

      if (manualError) {
        console.error('[ContactsPage] Error fetching manual contacts:', manualError)
      } else if (manualData) {
        console.log('[ContactsPage] Found', manualData.length, 'manual contacts')
        setManualContacts(manualData)
      }
    } catch (err) {
      console.error('[ContactsPage] fetchData error:', err)
      setLists(filterDeletedDemoLists(DEMO_LISTS))
    } finally {
      setIsLoading(false)
      console.log('[ContactsPage] fetchData completed')
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const toggleList = (listId: string) => {
    setExpandedLists(prev => {
      const next = new Set(prev)
      if (next.has(listId)) {
        next.delete(listId)
      } else {
        next.add(listId)
      }
      return next
    })
  }

  const deleteList = async (listId: string) => {
    if (!confirm('Delete this list and all its contacts? This cannot be undone.')) return
    
    // Check if this is a demo list
    const isDemoList = listId.startsWith('demo-')

    try {
      if (isDemoList) {
        // For demo lists, store the deleted ID in localStorage so it stays deleted
        const deletedIds = getDeletedDemoListIds()
        if (!deletedIds.includes(listId)) {
          deletedIds.push(listId)
          localStorage.setItem('deleted_demo_lists', JSON.stringify(deletedIds))
        }
        console.log('[ContactsPage] Demo list marked as deleted:', listId)
      } else {
        // For real lists, delete from database
        console.log('[ContactsPage] Deleting list from database:', listId)
        // First delete all contacts in this list
        const { error: contactsError } = await supabase.from('contacts').delete().eq('contact_list_id', listId)
        if (contactsError) console.error('[ContactsPage] Error deleting contacts:', contactsError)
        // Then delete the list
        const { error: listError } = await supabase.from('contact_lists').delete().eq('id', listId)
        if (listError) console.error('[ContactsPage] Error deleting list:', listError)
      }
      // Always update local state (handles both demo and real data)
      setLists(prev => prev.filter(l => l.id !== listId))
      console.log('[ContactsPage] List deleted successfully')
    } catch (err) {
      console.error('[ContactsPage] Failed to delete list:', err)
      alert('Failed to delete list. Please try again.')
    }
  }

  // Filter across all contacts
  const filterContacts = (contacts: Contact[]) => {
    if (!searchQuery) return contacts
    const query = searchQuery.toLowerCase()
    return contacts.filter(c =>
      c.first_name.toLowerCase().includes(query) ||
      c.last_name.toLowerCase().includes(query) ||
      c.email.toLowerCase().includes(query) ||
      (c.firm?.toLowerCase().includes(query) ?? false)
    )
  }

  // Count total contacts
  const totalContacts = lists.reduce((sum, l) => sum + (l.contacts?.length || 0), 0) + manualContacts.length

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
                <h1 className="text-lg font-semibold text-gray-900">Contacts</h1>
                <p className="text-sm text-gray-500">
                  {lists.length} lists • {totalContacts} contacts
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowImportModal(true)}
                className="flex items-center space-x-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Upload className="h-4 w-4" />
                <span>Import</span>
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>Add Contact</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Search */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search across all lists..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 text-gray-400 animate-spin" />
          </div>
        ) : lists.length === 0 && manualContacts.length === 0 ? (
          <EmptyState onImport={() => setShowImportModal(true)} onCreate={() => setShowCreateModal(true)} />
        ) : (
          <div className="space-y-4">
            {/* Contact Lists */}
            {lists.map((list) => (
              <ContactListCard
                key={list.id}
                list={list}
                isExpanded={expandedLists.has(list.id)}
                onToggle={() => toggleList(list.id)}
                onDelete={() => deleteList(list.id)}
                searchQuery={searchQuery}
                filterContacts={filterContacts}
              />
            ))}

            {/* Manual Contacts */}
            {manualContacts.length > 0 && (
              <ManualContactsCard
                contacts={filterContacts(manualContacts)}
                isExpanded={expandedLists.has('manual')}
                onToggle={() => toggleList('manual')}
              />
            )}
          </div>
        )}
      </main>

      {/* Modals */}
      {showImportModal && (
        <ImportContactsModal
          onClose={() => setShowImportModal(false)}
          onImported={fetchData}
        />
      )}

      {showCreateModal && (
        <CreateContactModal
          onClose={() => setShowCreateModal(false)}
          onCreated={fetchData}
        />
      )}
    </div>
  )
}

function EmptyState({ onImport, onCreate }: { onImport: () => void; onCreate: () => void }) {
  return (
    <div className="text-center py-16">
      <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <Users className="h-10 w-10 text-gray-400" />
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">No contacts yet</h3>
      <p className="text-gray-500 mb-8 max-w-md mx-auto">
        Import a spreadsheet with your investor contacts or add them manually.
      </p>
      <div className="flex items-center justify-center space-x-4">
        <button
          onClick={onImport}
          className="flex items-center space-x-2 px-6 py-3 bg-brand-600 text-white rounded-lg hover:bg-brand-700"
        >
          <Upload className="h-5 w-5" />
          <span>Import Spreadsheet</span>
        </button>
        <button
          onClick={onCreate}
          className="flex items-center space-x-2 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
        >
          <Plus className="h-5 w-5" />
          <span>Add Manually</span>
        </button>
      </div>
    </div>
  )
}

function ContactListCard({
  list,
  isExpanded,
  onToggle,
  onDelete,
  searchQuery,
  filterContacts,
}: {
  list: ContactList & { contacts: Contact[] }
  isExpanded: boolean
  onToggle: () => void
  onDelete: () => void
  searchQuery: string
  filterContacts: (contacts: Contact[]) => Contact[]
}) {
  const filteredContacts = filterContacts(list.contacts || [])
  const showingFiltered = searchQuery && filteredContacts.length !== (list.contacts?.length || 0)

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* List Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
        onClick={onToggle}
      >
        <div className="flex items-center space-x-3">
          <button className="p-1">
            {isExpanded ? (
              <ChevronDown className="h-5 w-5 text-gray-400" />
            ) : (
              <ChevronRight className="h-5 w-5 text-gray-400" />
            )}
          </button>
          <div className="w-10 h-10 bg-brand-100 rounded-lg flex items-center justify-center">
            <FileSpreadsheet className="h-5 w-5 text-brand-600" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900">{list.name}</h3>
            <div className="flex items-center space-x-2 text-xs text-gray-500">
              <span>{list.file_name}</span>
              <span>•</span>
              <span>
                {showingFiltered ? (
                  <>{filteredContacts.length} of {list.row_count} shown</>
                ) : (
                  <>{list.row_count} contacts</>
                )}
              </span>
              <span>•</span>
              <span>{formatDate(list.created_at)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full uppercase">
            {list.file_type}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="p-2 text-gray-400 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && filteredContacts.length > 0 && (
        <div className="border-t border-gray-200">
          {/* Dynamic Column Headers from Original Spreadsheet */}
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 overflow-x-auto">
            <div className="flex items-center space-x-4 text-xs font-medium text-gray-500 uppercase min-w-max">
              {list.original_headers.slice(0, 6).map((header) => (
                <div key={header} className="w-32 flex-shrink-0">
                  {header}
                </div>
              ))}
              {list.original_headers.length > 6 && (
                <div className="text-gray-400">
                  +{list.original_headers.length - 6} more
                </div>
              )}
            </div>
          </div>

          {/* Contact Rows with Original Data */}
          <div className="divide-y divide-gray-100 overflow-x-auto">
            {filteredContacts.map((contact) => (
              <Link
                key={contact.id}
                href={`/contacts/${contact.id}`}
                className="flex items-center space-x-4 px-4 py-3 hover:bg-gray-50 min-w-max"
              >
                {list.original_headers.slice(0, 6).map((header) => (
                  <div key={header} className="w-32 flex-shrink-0 text-sm text-gray-700 truncate">
                    {formatCellValue(contact.raw_data?.[header])}
                  </div>
                ))}
                <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {isExpanded && filteredContacts.length === 0 && (
        <div className="border-t border-gray-200 p-8 text-center text-gray-500">
          {searchQuery ? 'No contacts match your search' : 'No contacts in this list'}
        </div>
      )}
    </div>
  )
}

function ManualContactsCard({
  contacts,
  isExpanded,
  onToggle,
}: {
  contacts: Contact[]
  isExpanded: boolean
  onToggle: () => void
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
        onClick={onToggle}
      >
        <div className="flex items-center space-x-3">
          <button className="p-1">
            {isExpanded ? (
              <ChevronDown className="h-5 w-5 text-gray-400" />
            ) : (
              <ChevronRight className="h-5 w-5 text-gray-400" />
            )}
          </button>
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
            <Users className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900">Manual Contacts</h3>
            <p className="text-xs text-gray-500">{contacts.length} contacts added manually</p>
          </div>
        </div>
      </div>

      {isExpanded && contacts.length > 0 && (
        <div className="border-t border-gray-200 divide-y divide-gray-100">
          {contacts.map((contact) => (
            <Link
              key={contact.id}
              href={`/contacts/${contact.id}`}
              className="flex items-center justify-between p-4 hover:bg-gray-50"
            >
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-brand-100 rounded-full flex items-center justify-center">
                  <span className="text-brand-700 font-medium">
                    {contact.first_name[0]}{contact.last_name[0]}
                  </span>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">
                    {contact.first_name} {contact.last_name}
                  </h4>
                  <div className="flex items-center space-x-3 text-sm text-gray-500">
                    <span>{contact.email}</span>
                    {contact.firm && (
                      <>
                        <span>•</span>
                        <span>{contact.firm}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function CreateContactModal({ 
  onClose, 
  onCreated 
}: { 
  onClose: () => void
  onCreated: () => void 
}) {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    firm: '',
    role: '',
    geography: '',
    investment_focus: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const { error } = await supabase
        .from('contacts')
        .insert({
          ...formData,
          contact_list_id: null, // Manual contact
          firm: formData.firm || null,
          role: formData.role || null,
          geography: formData.geography || null,
          investment_focus: formData.investment_focus || null,
        })

      if (error) throw error

      onCreated()
      onClose()
    } catch (err) {
      console.error('Failed to create contact:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Add Contact</h2>
          </div>

          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name *
                </label>
                <input
                  type="text"
                  value={formData.first_name}
                  onChange={(e) => updateField('first_name', e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name *
                </label>
                <input
                  type="text"
                  value={formData.last_name}
                  onChange={(e) => updateField('last_name', e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email *
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => updateField('email', e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Firm
              </label>
              <input
                type="text"
                value={formData.firm}
                onChange={(e) => updateField('firm', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                placeholder="Sequoia Capital"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role
              </label>
              <input
                type="text"
                value={formData.role}
                onChange={(e) => updateField('role', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                placeholder="Partner"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Geography
              </label>
              <input
                type="text"
                value={formData.geography}
                onChange={(e) => updateField('geography', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                placeholder="San Francisco"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Investment Focus
              </label>
              <input
                type="text"
                value={formData.investment_focus}
                onChange={(e) => updateField('investment_focus', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                placeholder="Enterprise SaaS, AI/ML"
              />
            </div>
          </div>

          <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !formData.first_name || !formData.last_name || !formData.email}
              className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Adding...' : 'Add Contact'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
