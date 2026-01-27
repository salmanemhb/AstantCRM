'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useEditor, EditorContent, Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import DOMPurify from 'dompurify'
import { createClient } from '@/lib/supabase/client'
import {
  Send,
  Trash2,
  Loader2,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Link as LinkIcon,
  List,
  ListOrdered,
  Undo,
  Redo,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Check,
  CheckCircle,
  Copy,
  MoreVertical,
  Eye,
  X,
  Settings,
  Paperclip,
  FileText,
  Image as ImageIcon,
  File,
  XCircle,
  ToggleLeft,
  ToggleRight,
  Edit
} from 'lucide-react'
import type { Email, EmailJsonBody, EmailAttachment } from '@/lib/types'
import { TEAM_MEMBERS, COMPANY_INFO, getSignatureText, getSignatureHtml, getMemberById } from '@/lib/signatures'
import { DEFAULT_BANNER, BANNER_URL, type EmailBanner } from '@/lib/email-formatting'
import { updateSenderInBody } from '@/lib/template-utils'

// Attachment type for local state
interface LocalAttachment {
  id?: string
  file: File
  file_name: string
  file_size: number
  file_type: string
  uploading?: boolean
  error?: string
  storage_path?: string
}

// File size formatter
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

// Get icon for file type
function getFileIcon(type: string) {
  if (type.startsWith('image/')) return ImageIcon
  if (type.includes('pdf')) return FileText
  return File
}

// Formatting Toolbar Component
function FormattingToolbar({ 
  editor, 
  onAttach,
  bannerEnabled,
  onToggleBanner
}: { 
  editor: Editor | null
  onAttach: () => void
  bannerEnabled: boolean
  onToggleBanner: () => void
}) {
  const [showLinkInput, setShowLinkInput] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkText, setLinkText] = useState('')
  const linkInputRef = useRef<HTMLInputElement>(null)
  
  if (!editor) return null

  const addLink = () => {
    if (editor.state.selection.empty) {
      // No text selected - show input for both URL and text
      setShowLinkInput(true)
      setLinkText('')
      setLinkUrl('')
      setTimeout(() => linkInputRef.current?.focus(), 100)
    } else {
      // Text is selected - just ask for URL
      const url = window.prompt('Enter URL:')
      if (url) {
        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
      }
    }
  }

  const insertLink = () => {
    if (linkUrl) {
      if (linkText) {
        // Insert new linked text
        editor.chain().focus().insertContent(`<a href="${linkUrl}">${linkText}</a>`).run()
      } else {
        // Just insert the URL as a link
        editor.chain().focus().insertContent(`<a href="${linkUrl}">${linkUrl}</a>`).run()
      }
    }
    setShowLinkInput(false)
    setLinkUrl('')
    setLinkText('')
  }

  const buttonClass = (isActive: boolean) =>
    `p-1.5 rounded hover:bg-gray-200 transition-colors ${isActive ? 'bg-gray-200 text-brand-600' : 'text-gray-600'}`

  return (
    <div className="flex items-center space-x-1 px-3 py-2 border-b border-gray-200 bg-gray-50 relative">
      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={buttonClass(editor.isActive('bold'))}
        title="Bold (Ctrl+B)"
      >
        <Bold className="h-4 w-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={buttonClass(editor.isActive('italic'))}
        title="Italic (Ctrl+I)"
      >
        <Italic className="h-4 w-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        className={buttonClass(editor.isActive('underline'))}
        title="Underline (Ctrl+U)"
      >
        <UnderlineIcon className="h-4 w-4" />
      </button>
      
      <div className="w-px h-5 bg-gray-300 mx-1" />
      
      <button
        onClick={addLink}
        className={buttonClass(editor.isActive('link'))}
        title="Add Link"
      >
        <LinkIcon className="h-4 w-4" />
      </button>
      
      <div className="w-px h-5 bg-gray-300 mx-1" />
      
      <button
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={buttonClass(editor.isActive('bulletList'))}
        title="Bullet List"
      >
        <List className="h-4 w-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={buttonClass(editor.isActive('orderedList'))}
        title="Numbered List"
      >
        <ListOrdered className="h-4 w-4" />
      </button>
      
      <div className="w-px h-5 bg-gray-300 mx-1" />
      
      <button
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        className="p-1.5 rounded hover:bg-gray-200 text-gray-600 disabled:opacity-30"
        title="Undo (Ctrl+Z)"
      >
        <Undo className="h-4 w-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        className="p-1.5 rounded hover:bg-gray-200 text-gray-600 disabled:opacity-30"
        title="Redo (Ctrl+Y)"
      >
        <Redo className="h-4 w-4" />
      </button>
      
      <div className="w-px h-5 bg-gray-300 mx-1" />
      
      {/* Attach File Button */}
      <button
        onClick={onAttach}
        className="p-1.5 rounded hover:bg-gray-200 text-gray-600"
        title="Attach File"
      >
        <Paperclip className="h-4 w-4" />
      </button>
      
      {/* Banner Toggle Button */}
      <button
        onClick={onToggleBanner}
        className={`flex items-center space-x-1 px-2 py-1 rounded transition-colors ${
          bannerEnabled 
            ? 'bg-brand-100 text-brand-700 hover:bg-brand-200' 
            : 'text-gray-500 hover:bg-gray-200'
        }`}
        title={bannerEnabled ? 'Banner: ON (click to disable)' : 'Banner: OFF (click to enable)'}
      >
        <ImageIcon className="h-4 w-4" />
        <span className="text-xs font-medium">Banner</span>
        {bannerEnabled ? (
          <ToggleRight className="h-4 w-4" />
        ) : (
          <ToggleLeft className="h-4 w-4" />
        )}
      </button>
      
      {/* Link Input Popup */}
      {showLinkInput && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-20 w-80">
          <div className="space-y-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Link Text (optional)</label>
              <input
                type="text"
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
                placeholder="Display text"
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">URL</label>
              <input
                ref={linkInputRef}
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && insertLink()}
                placeholder="https://..."
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowLinkInput(false)}
                className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded"
              >
                Cancel
              </button>
              <button
                onClick={insertLink}
                disabled={!linkUrl}
                className="px-3 py-1.5 text-sm bg-brand-600 text-white rounded hover:bg-brand-700 disabled:opacity-50"
              >
                Insert Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Team Signature Display Component
function TeamSignatureDisplay({ 
  memberId, 
  onChangeMember,
  isOpen, 
  onToggle 
}: { 
  memberId: string
  onChangeMember: (id: string) => void
  isOpen: boolean
  onToggle: () => void
}) {
  const member = getMemberById(memberId)
  
  return (
    <div className="border-t border-gray-200">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-2 text-sm text-gray-500 hover:bg-gray-50"
      >
        <span className="flex items-center space-x-2">
          <Settings className="h-4 w-4" />
          <span>Change Sender ({member?.firstName || 'Select'})</span>
        </span>
        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {isOpen && (
        <div className="px-4 py-3 bg-gray-50 space-y-2">
          {TEAM_MEMBERS.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                onChangeMember(m.id)
                onToggle()
              }}
              className={`w-full flex items-center space-x-3 p-3 rounded-lg border transition-colors ${
                m.id === memberId 
                  ? 'border-brand-500 bg-brand-50' 
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                m.id === memberId ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600'
              }`}>
                {m.firstName[0]}
              </div>
              <div className="text-left flex-1">
                <p className="text-sm font-medium text-gray-900">{m.name}</p>
                <p className="text-xs text-gray-500">{m.title}</p>
              </div>
              {m.id === memberId && (
                <Check className="h-5 w-5 text-brand-600" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Full Email Preview Modal
function EmailPreviewModal({
  isOpen,
  onClose,
  subject,
  bodyHtml,
  signatureMemberId,
  contactEmail,
  contactName,
  attachments
}: {
  isOpen: boolean
  onClose: () => void
  subject: string
  bodyHtml: string
  signatureMemberId: string
  contactEmail: string
  contactName: string
  attachments: LocalAttachment[]
}) {
  if (!isOpen) return null
  
  const member = getMemberById(signatureMemberId)
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900">Email Preview</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>
        
        {/* Email Preview */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Email Header */}
          <div className="space-y-2 mb-6 pb-4 border-b border-gray-200">
            <div className="flex items-center">
              <span className="text-sm text-gray-500 w-20">From:</span>
              <span className="text-sm text-gray-900">{member?.name} &lt;{member?.email}&gt;</span>
            </div>
            <div className="flex items-center">
              <span className="text-sm text-gray-500 w-20">To:</span>
              <span className="text-sm text-gray-900">{contactName} &lt;{contactEmail}&gt;</span>
            </div>
            <div className="flex items-center">
              <span className="text-sm text-gray-500 w-20">Subject:</span>
              <span className="text-sm font-medium text-gray-900">{subject}</span>
            </div>
          </div>
          
          {/* Email Body - Sanitized to prevent XSS */}
          <div 
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(bodyHtml, { 
              ALLOWED_TAGS: ['p', 'br', 'b', 'strong', 'i', 'em', 'u', 'a', 'ul', 'ol', 'li', 'span', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote'],
              ALLOWED_ATTR: ['href', 'target', 'rel', 'class']
            }) }}
          />
          
          {/* Signature */}
          <div className="mt-6 pt-4 border-t border-gray-100">
            <div className="flex items-start space-x-4">
              <img 
                src={COMPANY_INFO.logoUrl} 
                alt="Astant Global Management" 
                className="w-16 h-auto object-contain"
              />
              <div className="text-sm">
                <p className="font-semibold text-gray-900">{member?.name}</p>
                <p className="text-gray-600">{member?.title}</p>
                <p className="text-gray-700 font-medium mt-2">{COMPANY_INFO.name}</p>
                <p className="text-gray-500 text-xs">{COMPANY_INFO.address}</p>
                <p className="text-gray-500 text-xs">{COMPANY_INFO.city}, {COMPANY_INFO.country}</p>
                <div className="mt-2 flex items-center space-x-2 text-xs">
                  <a href={`mailto:${member?.email}`} className="text-brand-600 hover:underline">
                    {member?.email}
                  </a>
                  <span className="text-gray-300">|</span>
                  <a href={`https://${COMPANY_INFO.website}`} className="text-brand-600 hover:underline">
                    {COMPANY_INFO.website}
                  </a>
                </div>
              </div>
            </div>
          </div>
          
          {/* Attachments */}
          {attachments.length > 0 && (
            <div className="mt-6 pt-4 border-t border-gray-200">
              <p className="text-sm font-medium text-gray-700 mb-2">Attachments ({attachments.length})</p>
              <div className="flex flex-wrap gap-2">
                {attachments.map((att, index) => {
                  const FileIcon = getFileIcon(att.file_type)
                  return (
                    <div key={index} className="flex items-center space-x-2 px-3 py-2 bg-gray-100 rounded-lg">
                      <FileIcon className="h-4 w-4 text-gray-500" />
                      <span className="text-sm text-gray-700">{att.file_name}</span>
                      <span className="text-xs text-gray-500">({formatFileSize(att.file_size)})</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  )
}

interface GmailEmailComposerProps {
  email: Email
  contactName: string
  contactEmail: string
  contactFirm?: string | null
  contactInitials: string
  isApproved: boolean
  isSent: boolean
  onApprove: () => Promise<void>
  onUnapprove: () => Promise<void>  // Un-approve to enable editing
  onSend: () => Promise<void>
  onSave: (updates: Partial<Email>) => Promise<void>
  onRegenerate: (senderId?: string) => Promise<void>
  onDelete: () => void
  // Format template callback - saves structure AND settings for template application
  onSaveFormat?: (format: { 
    bannerEnabled: boolean
    signatureMemberId: string
    signature: string
    // HTML content from editor (for structure/formatting)
    htmlContent: string
    // Body structure fields
    bodyStructure: {
      greeting: string
      context_p1: string
      value_p2: string
      cta: string
    }
    // Source info for intelligent replacement when applying
    sourceContactName: string
    sourceContactFirm: string
    sourceSenderName: string
  }) => void
}

export default function GmailEmailComposer({
  email,
  contactName,
  contactEmail,
  contactFirm,
  contactInitials,
  isApproved,
  isSent,
  onApprove,
  onUnapprove,
  onSend,
  onSave,
  onRegenerate,
  onDelete,
  onSaveFormat
}: GmailEmailComposerProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showSenderSelector, setShowSenderSelector] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  
  // Frozen state - email is frozen (non-editable) when approved or sent
  const isFrozen = isApproved || isSent
  
  // Banner state - initialize from saved email body
  const [bannerEnabled, setBannerEnabled] = useState(() => {
    const body = email.current_body || email.original_body
    return body?.bannerEnabled || false
  })
  
  // Attachments state
  const [attachments, setAttachments] = useState<LocalAttachment[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Load attachments from database on mount
  useEffect(() => {
    async function loadAttachments() {
      const supabase = createClient()
      const { data } = await supabase
        .from('email_attachments')
        .select('*')
        .eq('email_id', email.id)
      
      if (data && data.length > 0) {
        setAttachments(data.map(att => ({
          id: att.id,
          file: null as any, // Already uploaded
          file_name: att.file_name,
          file_size: att.file_size,
          file_type: att.file_type,
          storage_path: att.storage_path,
          uploading: false,
        })))
      }
    }
    loadAttachments()
  }, [email.id])
  
  // Email state
  const [subject, setSubject] = useState(email.subject)
  const [signatureMemberId, setSignatureMemberId] = useState(() => {
    // Get signature member from email or use default (Jean-François)
    const body = email.current_body || email.original_body
    return body?.signatureMemberId || 'jean-francois'
  })

  // Handle file selection
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    
    for (const file of Array.from(files)) {
      // Check file size
      if (file.size > 10 * 1024 * 1024) {
        alert(`File "${file.name}" is too large. Maximum size is 10MB.`)
        continue
      }
      
      // Add to local state
      const localAttachment: LocalAttachment = {
        file,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
        uploading: true,
      }
      
      setAttachments(prev => [...prev, localAttachment])
      
      // Upload to server
      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('email_id', email.id)
        
        const response = await fetch('/api/upload-attachment', {
          method: 'POST',
          body: formData,
        })
        
        const result = await response.json()
        
        if (result.success) {
          setAttachments(prev => prev.map(a => 
            a.file === file 
              ? { ...a, id: result.attachment.id, storage_path: result.attachment.storage_path, uploading: false }
              : a
          ))
          setHasChanges(true)
        } else {
          setAttachments(prev => prev.map(a => 
            a.file === file 
              ? { ...a, uploading: false, error: result.error }
              : a
          ))
        }
      } catch (err) {
        setAttachments(prev => prev.map(a => 
          a.file === file 
            ? { ...a, uploading: false, error: 'Upload failed' }
            : a
        ))
      }
    }
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }
  
  // Remove attachment
  const removeAttachment = async (attachment: LocalAttachment) => {
    if (attachment.id) {
      try {
        await fetch('/api/upload-attachment', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ attachment_id: attachment.id }),
        })
      } catch (err) {
        console.error('Failed to delete attachment:', err)
      }
    }
    setAttachments(prev => prev.filter(a => a !== attachment))
  }

  // Build the email body content (excluding signature)
  const getEmailBodyHtml = useCallback(() => {
    const body = email.current_body || email.original_body
    if (!body) return ''
    
    // Helper to convert text with line breaks to proper HTML paragraphs
    const textToHtml = (text: string) => {
      if (!text) return ''
      // Split by double newlines for paragraphs, preserve single newlines as <br>
      return text
        .split(/\n\n+/)
        .filter(p => p.trim())
        .map(p => `<p>${p.replace(/\n/g, '<br/>')}</p>`)
        .join('')
    }
    
    const parts = [
      body.greeting,
      body.context_p1,
      body.value_p2,
      body.cta
    ].filter(Boolean)
    
    return parts.map(p => textToHtml(p)).join('')
  }, [email])

  // TipTap editor for the main email body
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-brand-600 underline hover:text-brand-700',
        },
      }),
      Placeholder.configure({
        placeholder: 'Write your email here...',
      }),
    ],
    content: getEmailBodyHtml(),
    editable: !isFrozen, // Frozen when approved or sent
    immediatelyRender: false,
    onUpdate: () => {
      setHasChanges(true)
    },
  })
  
  // Update editor editability when frozen state changes
  useEffect(() => {
    if (editor) {
      editor.setEditable(!isFrozen)
    }
  }, [editor, isFrozen])

  // Cleanup editor on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      editor?.destroy()
    }
  }, [editor])

  // Update editor content when email changes
  useEffect(() => {
    if (editor) {
      // Always update when email ID or body changes (e.g., after regeneration)
      const newContent = getEmailBodyHtml()
      const currentContent = editor.getHTML()
      
      // Only update if content is actually different
      if (newContent !== currentContent) {
        editor.commands.setContent(newContent)
        setHasChanges(false)
        
        // Also update signature member from the new email
        const body = email.current_body || email.original_body
        if (body?.signatureMemberId) {
          setSignatureMemberId(body.signatureMemberId)
        }
      }
    }
  }, [email.id, email.current_body, email.original_body, editor, getEmailBodyHtml])

  // Sync when the email body changes from external source (database update via Apply Format to All)
  // Use a key based on email body to force re-sync
  const emailBodyKey = JSON.stringify({
    bannerEnabled: (email.current_body || email.original_body)?.bannerEnabled,
    signatureMemberId: (email.current_body || email.original_body)?.signatureMemberId
  })
  
  useEffect(() => {
    const body = email.current_body || email.original_body
    if (body) {
      // Always sync from props - this ensures Apply Format to All works
      if (body.bannerEnabled !== undefined) {
        setBannerEnabled(body.bannerEnabled)
      }
      if (body.signatureMemberId) {
        setSignatureMemberId(body.signatureMemberId)
      }
    }
  }, [emailBodyKey]) // Use serialized key to detect changes

  const handleSave = async () => {
    if (!editor) return
    setIsSaving(true)
    
    try {
      // Get the HTML content - preserve formatting (bold, italic, etc.)
      const htmlContent = editor.getHTML()
      
      // Parse paragraphs from HTML, preserving inner HTML (including <strong>, <em>, etc.)
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = htmlContent
      const paragraphs = Array.from(tempDiv.querySelectorAll('p')).map(p => p.innerHTML || '')
      
      // Build the body structure - HTML content will be preserved
      const updatedBody: EmailJsonBody = {
        greeting: paragraphs[0] || '',
        context_p1: paragraphs[1] || '',
        value_p2: paragraphs[2] || '',
        cta: paragraphs.slice(3).join('\n\n') || '',
        signature: getSignatureText(signatureMemberId),
        signatureMemberId: signatureMemberId,
        bannerEnabled: bannerEnabled
      }
      
      await onSave({
        subject,
        current_body: updatedBody
      })
      
      setHasChanges(false)
    } finally {
      setIsSaving(false)
    }
  }

  // Save format as template - saves structure, formatting, AND settings
  // When applied to other emails, the structure is used but personalized values are swapped
  const handleSaveFormatAsTemplate = () => {
    console.log('[handleSaveFormatAsTemplate] Called, onSaveFormat:', !!onSaveFormat)
    
    if (!onSaveFormat) {
      console.error('[handleSaveFormatAsTemplate] onSaveFormat callback is not provided')
      return
    }
    
    if (!editor) {
      console.error('[handleSaveFormatAsTemplate] Editor not available')
      return
    }
    
    // Get the HTML content from editor
    const htmlContent = editor.getHTML()
    
    // Parse paragraphs from HTML to build body structure
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = htmlContent
    const paragraphs = Array.from(tempDiv.querySelectorAll('p')).map(p => p.innerHTML || '')
    
    // Build the body structure
    const bodyStructure = {
      greeting: paragraphs[0] || '',
      context_p1: paragraphs[1] || '',
      value_p2: paragraphs[2] || '',
      cta: paragraphs.slice(3).join('\n\n') || ''
    }
    
    // Get sender's first name
    const senderMember = getMemberById(signatureMemberId)
    const sourceSenderName = senderMember?.firstName || senderMember?.name?.split(' ')[0] || ''
    
    console.log('[handleSaveFormatAsTemplate] Saving full structure:', { 
      bannerEnabled, 
      signatureMemberId,
      contactName,
      contactFirm,
      sourceSenderName,
      bodyStructure
    })
    
    onSaveFormat({
      bannerEnabled,
      signatureMemberId,
      signature: getSignatureText(signatureMemberId),
      htmlContent,
      bodyStructure,
      sourceContactName: contactName,
      sourceContactFirm: contactFirm || '',
      sourceSenderName
    })
  }

  const handleSend = async () => {
    setIsSending(true)
    try {
      if (hasChanges) {
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
      setHasChanges(false)
    } finally {
      setIsRegenerating(false)
    }
  }

  const handleCopy = () => {
    if (!editor) return
    const plainText = editor.getText()
    const signatureText = getSignatureText(signatureMemberId)
    const fullEmail = `Subject: ${subject}\n\n${plainText}\n\n${signatureText}`
    navigator.clipboard.writeText(fullEmail)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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
    return { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Draft' }
  }

  const status = getStatusBadge()

  return (
    <div className={`bg-white border rounded-xl overflow-hidden transition-all duration-200 ${
      isSent ? 'border-gray-200 bg-gray-50' : 
      isExpanded ? 'border-brand-300 shadow-lg' : 
      'border-gray-200 hover:border-gray-300 hover:shadow-sm'
    }`}>
      {/* Collapsed Header - Gmail style */}
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-4 flex-1 min-w-0">
          {/* Avatar */}
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
            isSent ? 'bg-green-100' : isApproved ? 'bg-blue-100' : 'bg-brand-100'
          }`}>
            {isSent ? (
              <Check className="h-5 w-5 text-green-600" />
            ) : (
              <span className={`text-sm font-semibold ${isApproved ? 'text-blue-700' : 'text-brand-700'}`}>
                {contactInitials}
              </span>
            )}
          </div>
          
          {/* Contact Info & Subject Preview */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <p className="font-medium text-gray-900 truncate">{contactName}</p>
              <span className="text-gray-400">•</span>
              <p className="text-sm text-gray-500 truncate">{contactFirm}</p>
            </div>
            <p className="text-sm text-gray-600 truncate">{subject}</p>
          </div>
        </div>
        
        {/* Status & Actions */}
        <div className="flex items-center space-x-3 flex-shrink-0">
          <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${status.bg} ${status.text}`}>
            {status.label}
          </span>
          <span 
            className={`w-2.5 h-2.5 rounded-full ${getConfidenceColor()}`} 
            title={`${email.confidence_score || 'unknown'} confidence`}
          />
          {!isSent && (
            <button
              onClick={(e) => {
                e.stopPropagation()
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

      {/* Expanded Email Composer - Gmail style */}
      {isExpanded && (
        <div className="border-t border-gray-200">
          {/* Tracking Status for Sent Emails */}
          {isSent && (
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center space-x-6 text-sm">
                <div className="flex items-center space-x-2">
                  <span className="text-gray-500">Sent:</span>
                  <span className="text-gray-900">{email.sent_at ? new Date(email.sent_at).toLocaleDateString() : '—'}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={email.delivered_at ? 'text-green-600' : 'text-gray-400'}>●</span>
                  <span className="text-gray-600">Delivered</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={email.opened_at ? 'text-blue-600' : 'text-gray-400'}>●</span>
                  <span className="text-gray-600">Opened</span>
                  {email.opened_at && <span className="text-xs text-gray-500">({new Date(email.opened_at).toLocaleDateString()})</span>}
                </div>
                <div className="flex items-center space-x-2">
                  <span className={email.clicked_at ? 'text-purple-600' : 'text-gray-400'}>●</span>
                  <span className="text-gray-600">Clicked</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={email.replied_at ? 'text-green-600' : 'text-gray-400'}>●</span>
                  <span className="text-gray-600">Replied</span>
                </div>
                {email.bounced_at && (
                  <div className="flex items-center space-x-2 text-red-600">
                    <span>●</span>
                    <span>Bounced</span>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* To Field */}
          <div className="flex items-center px-4 py-2 border-b border-gray-100">
            <span className="text-sm text-gray-500 w-12">To:</span>
            <span className="text-sm text-gray-900">{contactEmail}</span>
          </div>

          {/* Subject Field */}
          <div className="flex items-center px-4 py-2 border-b border-gray-100">
            <span className="text-sm text-gray-500 w-12">Subject:</span>
            <input
              type="text"
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value)
                setHasChanges(true)
              }}
              disabled={isSent}
              className="flex-1 text-sm text-gray-900 bg-transparent border-none focus:outline-none focus:ring-0"
              placeholder="Email subject..."
            />
          </div>

          {/* Formatting Toolbar */}
          {!isSent && (
            <FormattingToolbar 
              editor={editor} 
              onAttach={() => fileInputRef.current?.click()}
              bannerEnabled={bannerEnabled}
              onToggleBanner={() => {
                setBannerEnabled(!bannerEnabled)
                setHasChanges(true)
              }}
            />
          )}
          
          {/* Banner Preview (when enabled) */}
          {bannerEnabled && (
            <div className="mx-4 mt-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="h-8 w-8 rounded bg-brand-100 flex items-center justify-center">
                    <ImageIcon className="h-4 w-4 text-brand-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Email Banner Enabled</p>
                    <p className="text-xs text-gray-500">Astant banner will appear at the top of the email</p>
                  </div>
                </div>
                <button
                  onClick={() => setBannerEnabled(false)}
                  className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-white/50"
                >
                  Remove
                </button>
              </div>
            </div>
          )}
          
          {/* Copy Format Button - saves this email's format for Apply to All */}
          {onSaveFormat && (
            <div className="mx-4 mt-3">
              <button
                onClick={handleSaveFormatAsTemplate}
                className="flex items-center space-x-1.5 px-3 py-1.5 text-xs text-gray-600 hover:text-brand-600 hover:bg-brand-50 rounded-lg border border-gray-200 hover:border-brand-200 transition-colors"
                title="Copy this email's format (banner, signature) to apply to all other emails"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>Copy Format</span>
              </button>
            </div>
          )}
          
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.png,.jpg,.jpeg,.gif"
          />

          {/* Email Body Editor */}
          <div className="min-h-[300px]">
            <EditorContent 
              editor={editor} 
              className="prose prose-sm max-w-none px-4 py-4 min-h-[250px] focus:outline-none [&_.ProseMirror]:min-h-[250px] [&_.ProseMirror]:focus:outline-none [&_.ProseMirror_p]:my-3 [&_.ProseMirror_p]:text-justify"
            />
            
            {/* Attachments Display */}
            {attachments.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-100">
                <div className="flex flex-wrap gap-2">
                  {attachments.map((att, index) => {
                    const FileIcon = getFileIcon(att.file_type)
                    return (
                      <div
                        key={index}
                        className={`flex items-center space-x-2 px-3 py-2 rounded-lg border ${
                          att.error ? 'bg-red-50 border-red-200' : 'bg-gray-100 border-gray-200'
                        }`}
                      >
                        <FileIcon className="h-4 w-4 text-gray-500" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-700 truncate max-w-[150px]">
                            {att.file_name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {att.error || formatFileSize(att.file_size)}
                          </p>
                        </div>
                        {att.uploading ? (
                          <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />
                        ) : (
                          <button
                            onClick={() => removeAttachment(att)}
                            className="p-0.5 text-gray-400 hover:text-red-500"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            
            {/* Signature Display with Logo */}
            <div className="px-4 py-4 border-t border-gray-100 bg-gray-50">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 border-r-[3px] border-brand-600 pr-4">
                  <img 
                    src={COMPANY_INFO.logoUrl} 
                    alt="Astant" 
                    className="w-[70px] h-auto object-contain"
                    onError={(e) => {
                      // Fallback if image doesn't load
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                </div>
                <div className="text-sm">
                  <p className="font-bold text-gray-900 text-base">{getMemberById(signatureMemberId)?.name}</p>
                  <p className="text-gray-500 text-sm mb-2">{getMemberById(signatureMemberId)?.title}</p>
                  <p className="text-gray-700 font-semibold text-sm">{COMPANY_INFO.name}</p>
                  <p className="text-gray-500 text-xs">{COMPANY_INFO.address}</p>
                  <p className="text-gray-500 text-xs mb-2">{COMPANY_INFO.city}, {COMPANY_INFO.country}</p>
                  <div className="flex items-center space-x-2 text-xs">
                    <a href={`mailto:${getMemberById(signatureMemberId)?.email}`} className="text-brand-600 hover:underline">
                      {getMemberById(signatureMemberId)?.email}
                    </a>
                    <span className="text-gray-300">|</span>
                    <a href={`https://${COMPANY_INFO.website}`} className="text-brand-600 hover:underline">
                      {COMPANY_INFO.website}
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sender Selector - Only shown when not frozen */}
          {!isFrozen && (
            <TeamSignatureDisplay
              memberId={signatureMemberId}
              onChangeMember={async (id) => {
                const oldSenderId = signatureMemberId
                console.log('[SenderChange] ===== SENDER CHANGE START =====')
                console.log('[SenderChange] Changing sender from', oldSenderId, 'to:', id)
                
                // Get sender info
                const oldSender = getMemberById(oldSenderId)
                const newSender = getMemberById(id)
                console.log('[SenderChange] Old sender name:', oldSender?.firstName)
                console.log('[SenderChange] New sender name:', newSender?.firstName)
                
                setSignatureMemberId(id)
                setHasChanges(true)
                
                // Get current body
                const currentBody = email.current_body || email.original_body
                const newSignature = getSignatureText(id)
                
                // Build updated body
                let updatedBody: EmailJsonBody
                
                if (editor) {
                  // Get current content from editor - PRESERVE HTML FORMATTING
                  const htmlContent = editor.getHTML()
                  console.log('[SenderChange] Editor HTML:', htmlContent.substring(0, 200))
                  
                  const tempDiv = document.createElement('div')
                  tempDiv.innerHTML = htmlContent
                  
                  // Extract paragraphs but PRESERVE innerHTML (keeps <strong>, <em>, etc.)
                  const paragraphs = Array.from(tempDiv.querySelectorAll('p')).map(p => {
                    // Use innerHTML to preserve formatting tags like <strong>, <em>, <a>
                    return p.innerHTML || ''
                  })
                  
                  console.log('[SenderChange] Paragraphs extracted with HTML:', paragraphs.map(p => p.substring(0, 80)))
                  
                  // Build body from editor content - HTML included
                  const bodyFromEditor: EmailJsonBody = {
                    greeting: paragraphs[0] || currentBody?.greeting || '',
                    context_p1: paragraphs[1] || currentBody?.context_p1 || '',
                    value_p2: paragraphs[2] || currentBody?.value_p2 || '',
                    cta: paragraphs.slice(3).join('\n\n') || currentBody?.cta || '',
                    signature: newSignature,
                    signatureMemberId: id,
                    bannerEnabled: bannerEnabled
                  }
                  
                  console.log('[SenderChange] Body from editor - context_p1:', bodyFromEditor.context_p1?.substring(0, 80))
                  
                  // Update sender name in body text - uses HTML-aware replacement
                  updatedBody = updateSenderInBody(bodyFromEditor, oldSenderId, id)
                  updatedBody.signature = newSignature
                  updatedBody.signatureMemberId = id
                  
                  console.log('[SenderChange] Updated body - context_p1:', updatedBody.context_p1?.substring(0, 80))
                  
                  // Update the editor content with new sender name - HTML formatting preserved
                  const newHtml = `
                    <p>${updatedBody.greeting || ''}</p>
                    <p>${updatedBody.context_p1 || ''}</p>
                    <p>${updatedBody.value_p2 || ''}</p>
                    <p>${updatedBody.cta || ''}</p>
                  `.trim()
                  
                  console.log('[SenderChange] Setting new HTML:', newHtml.substring(0, 150))
                  editor.commands.setContent(newHtml)
                } else {
                  console.log('[SenderChange] No editor, using currentBody directly')
                  const baseBody: EmailJsonBody = {
                    ...currentBody,
                    signature: newSignature,
                    signatureMemberId: id
                  }
                  updatedBody = updateSenderInBody(baseBody, oldSenderId, id)
                  updatedBody.signature = newSignature
                  updatedBody.signatureMemberId = id
                }
                
                // Save to database
                try {
                  await onSave({
                    subject: email.subject,
                    current_body: updatedBody
                  })
                  console.log('[SenderChange] ===== SAVED SUCCESSFULLY =====')
                } catch (err) {
                  console.error('[SenderChange] Failed to save:', err)
                }
              }}
              isOpen={showSenderSelector}
              onToggle={() => setShowSenderSelector(!showSenderSelector)}
            />
          )}

          {/* Sent timestamp */}
          {isSent && email.sent_at && (
            <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center space-x-2 text-sm text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span>Sent on {new Date(email.sent_at).toLocaleString()}</span>
              </div>
            </div>
          )}

          {/* Action Bar - Gmail style */}
          {!isSent && (
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
              {/* Left Actions */}
              <div className="flex items-center space-x-2">
                {/* Send Button */}
                <button
                  onClick={handleSend}
                  disabled={isSending}
                  className="flex items-center space-x-2 px-5 py-2 bg-brand-600 text-white rounded-full hover:bg-brand-700 transition-colors disabled:opacity-50 font-medium"
                >
                  {isSending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  <span>{isSending ? 'Sending...' : 'Send'}</span>
                </button>

                {/* Save indicator */}
                {hasChanges && (
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center space-x-1.5 px-3 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-full transition-colors"
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <span>Save draft</span>
                    )}
                  </button>
                )}
              </div>

              {/* Right Actions */}
              <div className="flex items-center space-x-1">
                {/* AI Regenerate - only when not frozen */}
                {!isFrozen && (
                  <button
                    onClick={handleRegenerate}
                    disabled={isRegenerating}
                    className="flex items-center space-x-1.5 px-3 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                    title="Regenerate with AI"
                  >
                    {isRegenerating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    <span className="hidden sm:inline">{isRegenerating ? 'Regenerating...' : 'AI Regenerate'}</span>
                  </button>
                )}

                {/* Copy */}
                <button
                  onClick={handleCopy}
                  className="flex items-center space-x-1.5 px-3 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                  title="Copy email"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">{copied ? 'Copied!' : 'Copy'}</span>
                </button>

                {/* Approve - shown when not approved */}
                {!isApproved && (
                  <button
                    onClick={onApprove}
                    className="flex items-center space-x-1.5 px-3 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                    title="Approve email"
                  >
                    <CheckCircle className="h-4 w-4" />
                    <span className="hidden sm:inline">Approve</span>
                  </button>
                )}
                
                {/* Unapprove - shown when approved (to unlock and edit) */}
                {isApproved && !isSent && (
                  <button
                    onClick={onUnapprove}
                    className="flex items-center space-x-1.5 px-3 py-2 text-sm text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                    title="Unapprove to make edits"
                  >
                    <Edit className="h-4 w-4" />
                    <span className="hidden sm:inline">Unapprove</span>
                  </button>
                )}

                {/* More Menu */}
                <div className="relative">
                  <button
                    onClick={() => setShowMoreMenu(!showMoreMenu)}
                    className="p-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  
                  {showMoreMenu && (
                    <div className="absolute right-0 bottom-full mb-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10">
                      <button
                        onClick={() => {
                          setShowMoreMenu(false)
                          setShowPreview(true)
                        }}
                        className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <Eye className="h-4 w-4" />
                        <span>Preview</span>
                      </button>
                      <button
                        onClick={() => {
                          setShowMoreMenu(false)
                          if (confirm('Remove this contact from the campaign?')) {
                            onDelete()
                          }
                        }}
                        className="w-full flex items-center space-x-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span>Remove from campaign</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Email Preview Modal */}
      <EmailPreviewModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        subject={subject}
        bodyHtml={editor?.getHTML() || ''}
        signatureMemberId={signatureMemberId}
        contactEmail={contactEmail}
        contactName={contactName}
        attachments={attachments}
      />
    </div>
  )
}
