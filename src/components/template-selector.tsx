'use client'

import { useState } from 'react'
import { FileText, ChevronDown, ChevronRight, Search, Sparkles, Target, Newspaper, Users } from 'lucide-react'
import { 
  EMAIL_TEMPLATES, 
  TEMPLATE_CATEGORIES, 
  getTemplatesByCategory,
  type EmailTemplate,
  type TemplateCategory
} from '@/lib/email-templates'

interface TemplateSelectorProps {
  onSelect: (template: EmailTemplate) => void
  onClose: () => void
}

export default function TemplateSelector({ onSelect, onClose }: TemplateSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedCategory, setExpandedCategory] = useState<TemplateCategory | null>('vc-outreach')
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null)

  const getCategoryIcon = (category: TemplateCategory) => {
    switch (category) {
      case 'vc-outreach': return Target
      case 'media-outreach': return Newspaper
      case 'client-outreach': return Users
    }
  }

  const filteredTemplates = searchQuery
    ? EMAIL_TEMPLATES.filter(t => 
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : null

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
                <p className="text-sm text-gray-500">Choose a professional template inspired by our best outreach</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            >
              ×
            </button>
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
                      onClick={() => setSelectedTemplate(template)}
                    />
                  ))}
                </div>
              </div>
            ) : (
              // Category view
              <div className="p-4 space-y-2">
                {TEMPLATE_CATEGORIES.map(({ value, label }) => {
                  const Icon = getCategoryIcon(value)
                  const templates = getTemplatesByCategory(value)
                  const isExpanded = expandedCategory === value

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
                  <span className="text-xs font-semibold text-brand-600 uppercase tracking-wider">
                    {TEMPLATE_CATEGORIES.find(c => c.value === selectedTemplate.category)?.label}
                  </span>
                  <h3 className="text-lg font-semibold text-gray-900 mt-1">{selectedTemplate.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">{selectedTemplate.description}</p>
                </div>

                {/* Subject Preview */}
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    Subject
                  </label>
                  <p className="text-sm text-gray-900 bg-white p-3 rounded-lg border border-gray-200">
                    {selectedTemplate.subject}
                  </p>
                </div>

                {/* Body Preview */}
                <div className="mb-6">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    Email Body
                  </label>
                  <div className="text-sm text-gray-700 bg-white p-4 rounded-lg border border-gray-200 whitespace-pre-wrap max-h-[300px] overflow-y-auto">
                    {selectedTemplate.body}
                  </div>
                </div>

                {/* Use Template Button */}
                <button
                  onClick={() => onSelect(selectedTemplate)}
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
    </div>
  )
}

function TemplateItem({ 
  template, 
  isSelected, 
  onClick 
}: { 
  template: EmailTemplate
  isSelected: boolean
  onClick: () => void 
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg transition-colors ${
        isSelected 
          ? 'bg-brand-50 border border-brand-200' 
          : 'hover:bg-gray-50 border border-transparent'
      }`}
    >
      <div className="flex items-start space-x-3">
        <FileText className={`h-4 w-4 mt-0.5 ${isSelected ? 'text-brand-600' : 'text-gray-400'}`} />
        <div>
          <p className={`text-sm font-medium ${isSelected ? 'text-brand-900' : 'text-gray-900'}`}>
            {template.name}
          </p>
          <p className="text-xs text-gray-500 line-clamp-1">{template.description}</p>
        </div>
      </div>
    </button>
  )
}
