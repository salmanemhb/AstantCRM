'use client'

import { useState, useRef, useEffect } from 'react'
import DOMPurify from 'dompurify'
import {
  X,
  Paperclip,
  Image,
  FileText,
  Trash2,
  Save,
  Send,
  ChevronDown,
  PenTool,
  Plus
} from 'lucide-react'
import RichTextEditor from './rich-text-editor'
import type { Email, EmailJsonBody } from '@/lib/types'

interface Attachment {
  id: string
  name: string
  size: number
  type: string
  file?: File
}

interface Signature {
  id: string
  name: string
  content: string
  isDefault: boolean
}

// Default signatures - can be customized later
const DEFAULT_SIGNATURES: Signature[] = [
  {
    id: 'sig-1',
    name: 'Formal',
    content: `<p>Best regards,</p><p><strong>Astant Global Management</strong><br/>Quantitative Finance | Asset Management | Trade Finance<br/>Madrid • Bangalore • Luxembourg</p>`,
    isDefault: true
  },
  {
    id: 'sig-2',
    name: 'Casual',
    content: `<p>Thanks,<br/>The Astant Team</p>`,
    isDefault: false
  },
  {
    id: 'sig-3',
    name: 'Short',
    content: `<p>Best,<br/>Astant</p>`,
    isDefault: false
  }
]

interface EmailEditorModalProps {
  email: Email
  contactName: string
  contactEmail: string
  contactFirm?: string
  onSave: (updatedEmail: Partial<Email>) => Promise<void>
  onSend: () => Promise<void>
  onClose: () => void
}

export default function EmailEditorModal({
  email,
  contactName,
  contactEmail,
  contactFirm,
  onSave,
  onSend,
  onClose
}: EmailEditorModalProps) {
  const [subject, setSubject] = useState(email.subject)
  const [greeting, setGreeting] = useState(email.current_body?.greeting || email.original_body?.greeting || '')
  const [bodyContent, setBodyContent] = useState(() => {
    const body = email.current_body || email.original_body
    // Combine context_p1, value_p2, cta into HTML
    const parts = []
    if (body?.context_p1) parts.push(`<p>${body.context_p1}</p>`)
    if (body?.value_p2) parts.push(`<p>${body.value_p2}</p>`)
    if (body?.cta) parts.push(`<p>${body.cta}</p>`)
    return parts.join('')
  })
  const [signatureContent, setSignatureContent] = useState(() => {
    const sig = email.current_body?.signature || email.original_body?.signature || ''
    // Convert plain text to HTML
    return sig.includes('<') ? sig : `<p>${sig.replace(/\n/g, '<br/>')}</p>`
  })
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [showSignatures, setShowSignatures] = useState(false)
  const [signatures] = useState<Signature[]>(DEFAULT_SIGNATURES)
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Handle file attachment
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    const newAttachments: Attachment[] = Array.from(files).map(file => ({
      id: `att-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: file.name,
      size: file.size,
      type: file.type,
      file
    }))

    setAttachments(prev => [...prev, ...newAttachments])
    e.target.value = '' // Reset input
  }

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id))
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const handleSelectSignature = (sig: Signature) => {
    setSignatureContent(sig.content)
    setShowSignatures(false)
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      // Convert HTML content back to structured format
      const stripHtml = (html: string) => {
        const tmp = document.createElement('div')
        tmp.innerHTML = html
        return tmp.textContent || tmp.innerText || ''
      }

      const updatedBody: EmailJsonBody = {
        greeting: stripHtml(greeting),
        context_p1: '', // Will be the first part of body
        value_p2: '', // Will be second part
        cta: '', // Will be third part
        signature: stripHtml(signatureContent)
      }

      // Parse body content - split paragraphs
      const tmp = document.createElement('div')
      tmp.innerHTML = bodyContent
      const paragraphs = Array.from(tmp.querySelectorAll('p')).map(p => p.textContent || '')
      
      if (paragraphs.length >= 1) updatedBody.context_p1 = paragraphs[0]
      if (paragraphs.length >= 2) updatedBody.value_p2 = paragraphs[1]
      if (paragraphs.length >= 3) updatedBody.cta = paragraphs.slice(2).join(' ')

      // If no paragraphs, use full text as context
      if (paragraphs.length === 0) {
        updatedBody.context_p1 = stripHtml(bodyContent)
      }

      await onSave({
        subject,
        current_body: updatedBody
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleSend = async () => {
    setIsSending(true)
    try {
      await handleSave()
      await onSend()
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Edit Email</h2>
            <p className="text-sm text-gray-500 mt-1">
              To: {contactName} {contactFirm && `(${contactFirm})`} • {contactEmail}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            />
          </div>

          {/* Greeting */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Greeting
            </label>
            <input
              type="text"
              value={greeting}
              onChange={(e) => setGreeting(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              placeholder="Hi Sarah,"
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Body
            </label>
            <RichTextEditor
              content={bodyContent}
              onChange={setBodyContent}
              placeholder="Write your email content..."
            />
          </div>

          {/* Signature */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Signature
              </label>
              <div className="relative">
                <button
                  onClick={() => setShowSignatures(!showSignatures)}
                  className="flex items-center space-x-1 text-sm text-brand-600 hover:text-brand-700"
                >
                  <PenTool className="h-4 w-4" />
                  <span>Templates</span>
                  <ChevronDown className="h-3 w-3" />
                </button>
                {showSignatures && (
                  <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                    {signatures.map((sig) => (
                      <button
                        key={sig.id}
                        onClick={() => handleSelectSignature(sig)}
                        className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-0"
                      >
                        <p className="font-medium text-gray-900 text-sm">{sig.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">
                           {sig.content.replace(/<[^>]*>/g, ' ').substring(0, 50) + '...'}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <RichTextEditor
              content={signatureContent}
              onChange={setSignatureContent}
              placeholder="Add your signature..."
              className="min-h-[80px]"
            />
          </div>

          {/* Attachments */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Attachments
            </label>
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              {attachments.length > 0 && (
                <div className="space-y-2 mb-4">
                  {attachments.map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-gray-200"
                    >
                      <div className="flex items-center space-x-3">
                        {att.type.startsWith('image/') ? (
                          <Image className="h-5 w-5 text-green-600" />
                        ) : (
                          <FileText className="h-5 w-5 text-blue-600" />
                        )}
                        <div>
                          <p className="text-sm font-medium text-gray-900">{att.name}</p>
                          <p className="text-xs text-gray-500">{formatFileSize(att.size)}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => removeAttachment(att.id)}
                        className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900"
              >
                <Plus className="h-4 w-4" />
                <span>Add attachment</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex items-center justify-between bg-gray-50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-900"
          >
            Cancel
          </button>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center space-x-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              <span>{isSaving ? 'Saving...' : 'Save Draft'}</span>
            </button>
            <button
              onClick={handleSend}
              disabled={isSending}
              className="flex items-center space-x-2 px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              <span>{isSending ? 'Sending...' : 'Send Email'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
