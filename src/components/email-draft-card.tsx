'use client'

import { useState, useRef, useEffect } from 'react'
import {
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Send,
  RefreshCw,
  Trash2,
  Loader2,
  Edit3,
  Save,
  X,
  Copy,
  MoreHorizontal,
  Eye,
  Sparkles,
  Check
} from 'lucide-react'
import type { Email, EmailJsonBody } from '@/lib/types'

interface EmailDraftCardProps {
  email: Email
  contactName: string
  contactEmail: string
  contactFirm?: string | null
  contactInitials: string
  stage: string
  isApproved: boolean
  isSent: boolean
  onApprove: () => Promise<void>
  onSend: () => Promise<void>
  onSave: (updates: Partial<Email>) => Promise<void>
  onRegenerate: () => Promise<void>
  onDelete: () => void
}

export default function EmailDraftCard({
  email,
  contactName,
  contactEmail,
  contactFirm,
  contactInitials,
  stage,
  isApproved,
  isSent,
  onApprove,
  onSend,
  onSave,
  onRegenerate,
  onDelete
}: EmailDraftCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [showActions, setShowActions] = useState(false)
  const [copied, setCopied] = useState(false)
  
  // Editable fields
  const [editSubject, setEditSubject] = useState(email.subject)
  const [editGreeting, setEditGreeting] = useState(email.current_body?.greeting || email.original_body?.greeting || '')
  const [editContext, setEditContext] = useState(email.current_body?.context_p1 || email.original_body?.context_p1 || '')
  const [editValue, setEditValue] = useState(email.current_body?.value_p2 || email.original_body?.value_p2 || '')
  const [editCta, setEditCta] = useState(email.current_body?.cta || email.original_body?.cta || '')
  const [editSignature, setEditSignature] = useState(email.current_body?.signature || email.original_body?.signature || '')

  const actionsRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (actionsRef.current && !actionsRef.current.contains(event.target as Node)) {
        setShowActions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const updatedBody: EmailJsonBody = {
        greeting: editGreeting,
        context_p1: editContext,
        value_p2: editValue,
        cta: editCta,
        signature: editSignature
      }
      await onSave({
        subject: editSubject,
        current_body: updatedBody
      })
      setIsEditing(false)
    } finally {
      setIsSaving(false)
    }
  }

  const handleSend = async () => {
    setIsSending(true)
    try {
      // Save first if there are unsaved changes
      if (isEditing) {
        await handleSave()
      }
      await onSend()
    } finally {
      setIsSending(false)
    }
  }

  const handleRegenerate = async () => {
    setIsRegenerating(true)
    try {
      await onRegenerate()
    } finally {
      setIsRegenerating(false)
    }
  }

  const handleCopy = () => {
    const body = email.current_body || email.original_body
    const fullEmail = `Subject: ${email.subject}\n\n${body?.greeting}\n\n${body?.context_p1}\n\n${body?.value_p2}\n\n${body?.cta}\n\n${body?.signature}`
    navigator.clipboard.writeText(fullEmail)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const cancelEdit = () => {
    // Reset to original values
    setEditSubject(email.subject)
    setEditGreeting(email.current_body?.greeting || email.original_body?.greeting || '')
    setEditContext(email.current_body?.context_p1 || email.original_body?.context_p1 || '')
    setEditValue(email.current_body?.value_p2 || email.original_body?.value_p2 || '')
    setEditCta(email.current_body?.cta || email.original_body?.cta || '')
    setEditSignature(email.current_body?.signature || email.original_body?.signature || '')
    setIsEditing(false)
  }

  const getConfidenceColor = () => {
    switch (email.confidence_score) {
      case 'green': return 'bg-green-500'
      case 'yellow': return 'bg-yellow-500'
      case 'red': return 'bg-red-500'
      default: return 'bg-gray-400'
    }
  }

  const getStatusBadge = () => {
    if (isSent) return { bg: 'bg-green-100', text: 'text-green-700', label: 'Sent' }
    if (isApproved) return { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Approved' }
    return { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Draft' }
  }

  const status = getStatusBadge()
  const body = email.current_body || email.original_body

  return (
    <div className={`border rounded-xl transition-all duration-200 ${isSent ? 'bg-gray-50 border-gray-200' : isExpanded ? 'border-brand-300 shadow-md' : 'border-gray-200 hover:border-gray-300'}`}>
      {/* Header - Always visible */}
      <div 
        className="flex items-center justify-between p-4 cursor-pointer"
        onClick={() => !isEditing && setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isSent ? 'bg-green-100' : isApproved ? 'bg-blue-100' : 'bg-brand-100'}`}>
            {isSent ? (
              <Check className="h-5 w-5 text-green-600" />
            ) : (
              <span className={`font-semibold ${isApproved ? 'text-blue-700' : 'text-brand-700'}`}>
                {contactInitials}
              </span>
            )}
          </div>
          <div>
            <p className="font-medium text-gray-900">{contactName}</p>
            <p className="text-sm text-gray-500">{contactFirm} • {contactEmail}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <span className={`px-3 py-1 text-xs font-medium rounded-full ${status.bg} ${status.text}`}>
            {status.label}
          </span>
          {!isSent && (
            <span 
              className={`w-3 h-3 rounded-full ${getConfidenceColor()}`} 
              title={`${email.confidence_score} confidence`}
            />
          )}
          {!isSent && (
            <button
              onClick={(e) => { 
                e.stopPropagation(); 
                if (confirm('Remove this contact from the campaign?')) {
                  onDelete()
                }
              }}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
              title="Remove from campaign"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button className="p-1 text-gray-400">
            {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-gray-100">
          {/* Email Preview/Edit Area */}
          <div className="p-6">
            {/* Subject Line */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                Subject
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  className="w-full px-3 py-2 text-gray-900 font-medium border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              ) : (
                <p className="text-gray-900 font-medium">{email.subject}</p>
              )}
            </div>

            {/* Email Body */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              {/* Greeting */}
              <div className="px-4 py-3 border-b border-gray-100">
                {isEditing ? (
                  <input
                    type="text"
                    value={editGreeting}
                    onChange={(e) => setEditGreeting(e.target.value)}
                    className="w-full px-2 py-1 text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="Hi [Name],"
                  />
                ) : (
                  <p className="text-gray-900">{body?.greeting}</p>
                )}
              </div>

              {/* Context Paragraph */}
              <div className="px-4 py-3 border-b border-gray-100">
                {isEditing ? (
                  <textarea
                    value={editContext}
                    onChange={(e) => setEditContext(e.target.value)}
                    rows={3}
                    className="w-full px-2 py-1 text-gray-700 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                    placeholder="Opening paragraph - context and connection..."
                  />
                ) : (
                  <p className="text-gray-700">{body?.context_p1}</p>
                )}
              </div>

              {/* Value Proposition */}
              <div className="px-4 py-3 border-b border-gray-100">
                {isEditing ? (
                  <textarea
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    rows={3}
                    className="w-full px-2 py-1 text-gray-700 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                    placeholder="Value proposition..."
                  />
                ) : (
                  <p className="text-gray-700">{body?.value_p2}</p>
                )}
              </div>

              {/* CTA */}
              <div className="px-4 py-3 border-b border-gray-100">
                {isEditing ? (
                  <textarea
                    value={editCta}
                    onChange={(e) => setEditCta(e.target.value)}
                    rows={2}
                    className="w-full px-2 py-1 text-gray-700 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                    placeholder="Call to action..."
                  />
                ) : (
                  <p className="text-gray-700">{body?.cta}</p>
                )}
              </div>

              {/* Signature */}
              <div className="px-4 py-3 bg-gray-50">
                {isEditing ? (
                  <textarea
                    value={editSignature}
                    onChange={(e) => setEditSignature(e.target.value)}
                    rows={3}
                    className="w-full px-2 py-1 text-gray-600 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none bg-white"
                    placeholder="Best regards,&#10;Your Name&#10;Company"
                  />
                ) : (
                  <p className="text-gray-600 text-sm whitespace-pre-line">{body?.signature}</p>
                )}
              </div>
            </div>

            {/* Sent timestamp */}
            {isSent && email.sent_at && (
              <div className="mt-4 flex items-center space-x-2 text-sm text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span>Sent on {new Date(email.sent_at).toLocaleString()}</span>
              </div>
            )}
          </div>

          {/* Action Bar */}
          {!isSent && (
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {isEditing ? (
                  <>
                    <button
                      onClick={cancelEdit}
                      className="flex items-center space-x-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      <X className="h-4 w-4" />
                      <span>Cancel</span>
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="flex items-center space-x-1.5 px-3 py-1.5 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
                    >
                      {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="flex items-center space-x-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      <Edit3 className="h-4 w-4" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={handleRegenerate}
                      disabled={isRegenerating}
                      className="flex items-center space-x-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {isRegenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      <span>{isRegenerating ? 'Regenerating...' : 'Regenerate'}</span>
                    </button>
                    <button
                      onClick={handleCopy}
                      className="flex items-center space-x-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                      <span>{copied ? 'Copied!' : 'Copy'}</span>
                    </button>
                  </>
                )}
              </div>

              {!isEditing && (
                <div className="flex items-center space-x-3">
                  {!isApproved && (
                    <button
                      onClick={onApprove}
                      className="flex items-center space-x-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-white transition-colors"
                    >
                      <CheckCircle className="h-4 w-4" />
                      <span>Approve</span>
                    </button>
                  )}
                  <button
                    onClick={handleSend}
                    disabled={isSending}
                    className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    <span>{isSending ? 'Sending...' : 'Send Email'}</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
