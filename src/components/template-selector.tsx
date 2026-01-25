'use client'

import { useState, useEffect, useCallback } from 'react'
import { 
  FileText, 
  ChevronDown, 
  ChevronRight, 
  Search, 
  Sparkles, 
  Target, 
  Newspaper, 
  Users, 
  Coffee,
  Plus,
  Trash2,
  Edit3,
  Loader2,
  CheckCircle,
  AlertCircle,
  Upload,
  X
} from 'lucide-react'
import RichTextEditor from './rich-text-editor'
import { 
  EMAIL_TEMPLATES, 
  TEMPLATE_CATEGORIES, 
  getTemplatesByCategory,
  type EmailTemplate,
  type TemplateCategory
} from '@/lib/email-templates'

// Custom template type from database
interface CustomTemplate {
  id: string
  name: string
  category: string
  description: string | null
  subject: string
  body: string
  placeholders: string[]
  created_by: string | null
  created_at: string
  updated_at: string
}

// Detected placeholder from AI
interface DetectedPlaceholder {
  name: string
  original_text: string
  confidence: 'high' | 'medium' | 'low'
  description: string
}

interface TemplateSelectorProps {
  onSelect: (template: EmailTemplate) => void
  onClose: () => void
}

export default function TemplateSelector({ onSelect, onClose }: TemplateSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedCategory, setExpandedCategory] = useState<TemplateCategory | 'custom' | null>('investor')
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null)
  
  // Editable preview state - allows modifying template before using
  const [editedSubject, setEditedSubject] = useState('')
  const [editedBody, setEditedBody] = useState('')
  
  // Custom templates state
  const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>([])
  const [isLoadingCustom, setIsLoadingCustom] = useState(true)
  
  // Import modal state
  const [showImportModal, setShowImportModal] = useState(false)
  
  // Edit modal state
  const [editingTemplate, setEditingTemplate] = useState<CustomTemplate | null>(null)
  
  // Update edited values when template selection changes
  useEffect(() => {
    if (selectedTemplate) {
      setEditedSubject(selectedTemplate.subject)
      setEditedBody(selectedTemplate.body)
    }
  }, [selectedTemplate])

  // Fetch custom templates
  const fetchCustomTemplates = useCallback(async () => {
    setIsLoadingCustom(true)
    try {
      const res = await fetch('/api/templates')
      if (res.ok) {
        const data = await res.json()
        setCustomTemplates(data.templates || [])
      }
    } catch (error) {
      console.error('Failed to fetch custom templates:', error)
    } finally {
      setIsLoadingCustom(false)
    }
  }, [])

  useEffect(() => {
    fetchCustomTemplates()
  }, [fetchCustomTemplates])

  const getCategoryIcon = (category: TemplateCategory | 'custom') => {
    switch (category) {
      case 'investor': return Target
      case 'partner': return Users
      case 'media': return Newspaper
      case 'follow-up': return Coffee
      case 'custom': return Sparkles
      default: return FileText
    }
  }

  // Convert custom template to EmailTemplate format
  const customToEmailTemplate = (custom: CustomTemplate): EmailTemplate => ({
    id: custom.id,
    name: custom.name,
    category: custom.category as TemplateCategory,
    description: custom.description || '',
    author: 'Custom',
    subject: custom.subject,
    body: custom.body,
    placeholders: custom.placeholders,
    subject_template: custom.subject,
    body_template: custom.body,
    recommendedSender: 'jean-francois',
  })

  // Get all templates including custom ones
  const allTemplates = [
    ...EMAIL_TEMPLATES,
    ...customTemplates.map(customToEmailTemplate)
  ]

  const filteredTemplates = searchQuery
    ? allTemplates.filter(t => 
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : null

  // Delete custom template
  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Delete this template? This cannot be undone.')) return
    
    try {
      const res = await fetch(`/api/templates?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        setCustomTemplates(prev => prev.filter(t => t.id !== id))
        if (selectedTemplate?.id === id) {
          setSelectedTemplate(null)
        }
      }
    } catch (error) {
      console.error('Failed to delete template:', error)
      alert('Failed to delete template')
    }
  }

  // Handle edit template
  const handleEditTemplate = (template: CustomTemplate) => {
    setEditingTemplate(template)
  }

  // Check if template is custom (vs built-in)
  const isCustomTemplate = (id: string) => customTemplates.some(t => t.id === id)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-brand-100 rounded-lg flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-brand-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Email Templates</h2>
                <p className="text-sm text-gray-500">Choose a template or import your own</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowImportModal(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>Import Template</span>
              </button>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none px-2"
              >
                ×
              </button>
            </div>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search templates..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Template List */}
          <div className="w-1/2 border-r border-gray-200 overflow-y-auto">
            {filteredTemplates ? (
              // Search results
              <div className="p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  {filteredTemplates.length} results
                </p>
                <div className="space-y-2">
                  {filteredTemplates.map(template => (
                    <TemplateItem
                      key={template.id}
                      template={template}
                      isSelected={selectedTemplate?.id === template.id}
                      isCustom={isCustomTemplate(template.id)}
                      onClick={() => setSelectedTemplate(template)}
                      onDelete={isCustomTemplate(template.id) ? () => handleDeleteTemplate(template.id) : undefined}
                      onEdit={isCustomTemplate(template.id) ? () => handleEditTemplate(customTemplates.find(t => t.id === template.id)!) : undefined}
                    />
                  ))}
                </div>
              </div>
            ) : (
              // Category view
              <div className="p-4 space-y-2">
                {/* Custom Templates Category */}
                {customTemplates.length > 0 && (
                  <div>
                    <button
                      onClick={() => setExpandedCategory(expandedCategory === 'custom' ? null : 'custom')}
                      className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors bg-brand-50"
                    >
                      <div className="flex items-center space-x-3">
                        <Sparkles className="h-5 w-5 text-brand-600" />
                        <span className="font-medium text-brand-900">My Templates</span>
                        <span className="text-xs text-brand-600 bg-brand-100 px-2 py-0.5 rounded-full">
                          {customTemplates.length}
                        </span>
                      </div>
                      {expandedCategory === 'custom' ? (
                        <ChevronDown className="h-4 w-4 text-brand-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-brand-400" />
                      )}
                    </button>
                    
                    {expandedCategory === 'custom' && (
                      <div className="ml-8 mt-1 space-y-1">
                        {isLoadingCustom ? (
                          <div className="p-3 text-center text-gray-500">
                            <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                            Loading...
                          </div>
                        ) : (
                          customTemplates.map(template => (
                            <TemplateItem
                              key={template.id}
                              template={customToEmailTemplate(template)}
                              isSelected={selectedTemplate?.id === template.id}
                              isCustom={true}
                              onClick={() => setSelectedTemplate(customToEmailTemplate(template))}
                              onDelete={() => handleDeleteTemplate(template.id)}
                              onEdit={() => handleEditTemplate(template)}
                            />
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Built-in Categories */}
                {TEMPLATE_CATEGORIES.map(({ value, label }) => {
                  const Icon = getCategoryIcon(value)
                  const templates = getTemplatesByCategory(value)
                  const isExpanded = expandedCategory === value

                  if (templates.length === 0) return null

                  return (
                    <div key={value}>
                      <button
                        onClick={() => setExpandedCategory(isExpanded ? null : value)}
                        className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          <Icon className="h-5 w-5 text-brand-600" />
                          <span className="font-medium text-gray-900">{label}</span>
                          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                            {templates.length}
                          </span>
                        </div>
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-gray-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        )}
                      </button>
                      
                      {isExpanded && (
                        <div className="ml-8 mt-1 space-y-1">
                          {templates.map(template => (
                            <TemplateItem
                              key={template.id}
                              template={template}
                              isSelected={selectedTemplate?.id === template.id}
                              isCustom={false}
                              onClick={() => setSelectedTemplate(template)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Preview */}
          <div className="w-1/2 overflow-y-auto bg-gray-50">
            {selectedTemplate ? (
              <div className="p-6">
                <div className="mb-4">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-xs font-semibold text-brand-600 uppercase tracking-wider">
                      {isCustomTemplate(selectedTemplate.id) ? 'Custom Template' : 
                        TEMPLATE_CATEGORIES.find(c => c.value === selectedTemplate.category)?.label}
                    </span>
                    {isCustomTemplate(selectedTemplate.id) && (
                      <span className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full">
                        My Template
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mt-1">{selectedTemplate.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">{selectedTemplate.description}</p>
                  {selectedTemplate.author && !isCustomTemplate(selectedTemplate.id) && (
                    <p className="text-xs text-gray-400 mt-2">By {selectedTemplate.author}</p>
                  )}
                </div>

                {/* Placeholders */}
                {selectedTemplate.placeholders && selectedTemplate.placeholders.length > 0 && (
                  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs font-medium text-blue-700 mb-2">Placeholders that will be personalized:</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedTemplate.placeholders.map(p => (
                        <code key={p} className="px-2 py-0.5 bg-white border border-blue-300 text-blue-700 text-xs rounded">
                          [{p}]
                        </code>
                      ))}
                    </div>
                  </div>
                )}

                {/* Subject - Editable */}
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    Subject
                  </label>
                  <input
                    type="text"
                    value={editedSubject}
                    onChange={(e) => setEditedSubject(e.target.value)}
                    className="w-full text-sm text-gray-900 bg-white p-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  />
                </div>

                {/* Body - Editable */}
                <div className="mb-6">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    Email Body
                  </label>
                  <RichTextEditor
                    content={editedBody}
                    onChange={setEditedBody}
                    placeholder="Write your email template here..."
                  />
                </div>

                {/* Use Template Button - passes edited values */}
                <button
                  onClick={() => onSelect({
                    ...selectedTemplate,
                    subject: editedSubject,
                    body: editedBody,
                  })}
                  className="w-full py-3 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700 transition-colors"
                >
                  Use This Template
                </button>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Select a template to preview</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Import Template Modal */}
      {showImportModal && (
        <ImportTemplateModal
          onClose={() => setShowImportModal(false)}
          onImported={(template) => {
            setCustomTemplates(prev => [template, ...prev])
            setShowImportModal(false)
            setExpandedCategory('custom')
            setSelectedTemplate(customToEmailTemplate(template))
          }}
        />
      )}

      {/* Edit Template Modal */}
      {editingTemplate && (
        <EditTemplateModal
          template={editingTemplate}
          onClose={() => setEditingTemplate(null)}
          onSaved={(updated) => {
            setCustomTemplates(prev => prev.map(t => t.id === updated.id ? updated : t))
            setEditingTemplate(null)
            if (selectedTemplate?.id === updated.id) {
              setSelectedTemplate(customToEmailTemplate(updated))
            }
          }}
        />
      )}
    </div>
  )
}

function TemplateItem({ 
  template, 
  isSelected, 
  isCustom,
  onClick,
  onDelete,
  onEdit,
}: { 
  template: EmailTemplate
  isSelected: boolean
  isCustom: boolean
  onClick: () => void
  onDelete?: () => void
  onEdit?: () => void
}) {
  return (
    <div
      className={`w-full text-left p-3 rounded-lg transition-colors ${
        isSelected 
          ? 'bg-brand-50 border border-brand-200' 
          : 'hover:bg-gray-50 border border-transparent'
      }`}
    >
      <div className="flex items-start justify-between">
        <button onClick={onClick} className="flex-1 text-left flex items-start space-x-3">
          <FileText className={`h-4 w-4 mt-0.5 flex-shrink-0 ${isSelected ? 'text-brand-600' : 'text-gray-400'}`} />
          <div className="min-w-0">
            <p className={`text-sm font-medium ${isSelected ? 'text-brand-900' : 'text-gray-900'} truncate`}>
              {template.name}
            </p>
            <p className="text-xs text-gray-500 line-clamp-1">{template.description}</p>
          </div>
        </button>
        
        {isCustom && (
          <div className="flex items-center space-x-1 ml-2 flex-shrink-0">
            {onEdit && (
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                className="p-1 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded"
                title="Edit template"
              >
                <Edit3 className="h-3.5 w-3.5" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                title="Delete template"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Import Template Modal
function ImportTemplateModal({
  onClose,
  onImported,
}: {
  onClose: () => void
  onImported: (template: CustomTemplate) => void
}) {
  const [step, setStep] = useState<'paste' | 'review' | 'saving'>('paste')
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [category, setCategory] = useState<TemplateCategory>('investor')
  const [detectedPlaceholders, setDetectedPlaceholders] = useState<DetectedPlaceholder[]>([])
  const [selectedPlaceholders, setSelectedPlaceholders] = useState<string[]>([])
  const [isDetecting, setIsDetecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDetectPlaceholders = async () => {
    if (!body.trim()) {
      setError('Please paste your email template body')
      return
    }

    setIsDetecting(true)
    setError(null)

    try {
      const res = await fetch('/api/templates/detect-placeholders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, body }),
      })

      if (!res.ok) throw new Error('Failed to detect placeholders')

      const data = await res.json()
      setDetectedPlaceholders(data.placeholders || [])
      setSelectedPlaceholders(data.placeholders?.map((p: DetectedPlaceholder) => p.name) || [])
      
      if (!name && data.suggested_name) {
        setName(data.suggested_name)
      }
      
      setStep('review')
    } catch (err: any) {
      setError(err.message || 'Failed to analyze template')
    } finally {
      setIsDetecting(false)
    }
  }

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Please enter a template name')
      return
    }

    setStep('saving')
    setError(null)

    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          category,
          subject: subject || `Template: ${name}`,
          body,
          detect_placeholders: false, // We already detected them
        }),
      })

      if (!res.ok) throw new Error('Failed to save template')

      const data = await res.json()
      
      // Update with selected placeholders
      const templateWithPlaceholders = {
        ...data.template,
        placeholders: selectedPlaceholders,
      }

      // Update placeholders in DB
      await fetch('/api/templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: data.template.id,
          placeholders: selectedPlaceholders,
        }),
      })

      onImported(templateWithPlaceholders)
    } catch (err: any) {
      setError(err.message || 'Failed to save template')
      setStep('review')
    }
  }

  const togglePlaceholder = (name: string) => {
    setSelectedPlaceholders(prev => 
      prev.includes(name) 
        ? prev.filter(p => p !== name)
        : [...prev, name]
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-brand-100 rounded-lg flex items-center justify-center">
                <Upload className="h-5 w-5 text-brand-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Import Template</h2>
                <p className="text-sm text-gray-500">
                  {step === 'paste' && 'Paste your email template below'}
                  {step === 'review' && 'Review detected placeholders'}
                  {step === 'saving' && 'Saving your template...'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 'paste' && (
            <div className="space-y-4">
              {/* Subject (optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject Line <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Quick intro - Astant x {firm}"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>

              {/* Body */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Body <span className="text-red-500">*</span>
                </label>
                <RichTextEditor
                  content={body}
                  onChange={setBody}
                  placeholder="Paste your email template here... Use [FIRST_NAME], [FIRM], etc. for placeholders."
                  className="min-h-[250px]"
                />
                <p className="text-xs text-gray-500 mt-1">
                  AI will automatically detect placeholders like [FIRST_NAME], {'{firm}'}, etc.
                </p>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2 text-red-700">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              )}
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-4">
              {/* Template Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Template Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="VC Cold Outreach v2"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as TemplateCategory)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                >
                  {TEMPLATE_CATEGORIES.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>

              {/* Detected Placeholders */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Detected Placeholders
                </label>
                {detectedPlaceholders.length > 0 ? (
                  <div className="space-y-2">
                    {detectedPlaceholders.map(p => (
                      <label
                        key={p.name}
                        className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedPlaceholders.includes(p.name)
                            ? 'bg-brand-50 border-brand-200'
                            : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedPlaceholders.includes(p.name)}
                          onChange={() => togglePlaceholder(p.name)}
                          className="h-4 w-4 text-brand-600 rounded focus:ring-brand-500"
                        />
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <code className="text-sm font-semibold text-brand-700">[{p.name}]</code>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              p.confidence === 'high' ? 'bg-green-100 text-green-700' :
                              p.confidence === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {p.confidence}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">
                            Found: &quot;{p.original_text}&quot; → {p.description}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-700">
                      No placeholders detected. You can still save this template and add placeholders manually using [BRACKETS] format.
                    </p>
                  </div>
                )}
              </div>

              {/* Preview */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Template Preview
                </label>
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  {subject && (
                    <p className="text-sm font-medium text-gray-900 mb-2 pb-2 border-b">
                      Subject: {subject}
                    </p>
                  )}
                  <p className="text-sm text-gray-700 whitespace-pre-wrap max-h-[200px] overflow-y-auto">
                    {body}
                  </p>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2 text-red-700">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              )}
            </div>
          )}

          {step === 'saving' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-12 w-12 text-brand-600 animate-spin mb-4" />
              <p className="text-gray-600">Saving your template...</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex justify-between">
          {step === 'paste' && (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleDetectPlaceholders}
                disabled={!body.trim() || isDetecting}
                className="flex items-center space-x-2 px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDetecting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>Detect Placeholders</span>
                  </>
                )}
              </button>
            </>
          )}

          {step === 'review' && (
            <>
              <button
                onClick={() => setStep('paste')}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Back
              </button>
              <button
                onClick={handleSave}
                disabled={!name.trim()}
                className="flex items-center space-x-2 px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle className="h-4 w-4" />
                <span>Save Template</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// Edit Template Modal
function EditTemplateModal({
  template,
  onClose,
  onSaved,
}: {
  template: CustomTemplate
  onClose: () => void
  onSaved: (template: CustomTemplate) => void
}) {
  const [name, setName] = useState(template.name)
  const [subject, setSubject] = useState(template.subject)
  const [body, setBody] = useState(template.body)
  const [category, setCategory] = useState(template.category)
  const [placeholders, setPlaceholders] = useState(template.placeholders.join(', '))
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Template name is required')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      // Parse placeholders from comma-separated string
      const parsedPlaceholders = placeholders
        .split(',')
        .map(p => p.trim().toUpperCase().replace(/[\[\]{}]/g, ''))
        .filter(p => p.length > 0)

      const res = await fetch('/api/templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: template.id,
          name,
          subject,
          body,
          category,
          placeholders: parsedPlaceholders,
        }),
      })

      if (!res.ok) throw new Error('Failed to update template')

      const data = await res.json()
      onSaved(data.template)
    } catch (err: any) {
      setError(err.message || 'Failed to save template')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-brand-100 rounded-lg flex items-center justify-center">
                <Edit3 className="h-5 w-5 text-brand-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Edit Template</h2>
                <p className="text-sm text-gray-500">Modify your custom template</p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Template Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            >
              {TEMPLATE_CATEGORIES.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject Line</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Body</label>
            <RichTextEditor
              content={body}
              onChange={setBody}
              placeholder="Write your email template here..."
              className="min-h-[250px]"
            />
          </div>

          {/* Placeholders */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Placeholders <span className="text-gray-400">(comma-separated)</span>
            </label>
            <input
              type="text"
              value={placeholders}
              onChange={(e) => setPlaceholders(e.target.value)}
              placeholder="FIRST_NAME, FIRM, INVESTMENT_FOCUS"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              List the placeholder names that appear in your template
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2 text-red-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm">{error}</span>
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
          <button
            onClick={handleSave}
            disabled={!name.trim() || isSaving}
            className="flex items-center space-x-2 px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
