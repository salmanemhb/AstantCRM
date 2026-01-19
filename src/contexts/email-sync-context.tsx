'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import type { EmailJsonBody, Email } from '@/lib/types'
import { getSignatureText } from '@/lib/signatures'

// ============================================
// EMAIL SYNC CONTEXT - SIMPLIFIED & WORKING
// ============================================
// When sync mode is ON:
// 1. User edits one email (the "source")
// 2. On save, we capture the format (banner, signature, paragraph structure)
// 3. We immediately update all other emails to match this format
// 4. Each email preserves its personalized content

export interface SyncFormat {
  // Number of paragraphs (including empty ones for spacing)
  paragraphCount: number
  
  // Indices of empty paragraphs (spacer lines)
  emptyParagraphIndices: number[]
  
  // Settings that sync
  bannerEnabled: boolean
  signatureMemberId: string
  signature: string
}

interface EmailSyncContextType {
  // Core sync state
  syncEnabled: boolean
  setSyncEnabled: (enabled: boolean) => void
  
  // The format template to apply to all emails
  masterFormat: SyncFormat | null
  setMasterFormat: (format: SyncFormat | null) => void
  
  // The source email ID
  sourceEmailId: string | null
  setSourceEmailId: (id: string | null) => void
  
  // Version counter to trigger re-renders
  syncVersion: number
  incrementSyncVersion: () => void
}

const EmailSyncContext = createContext<EmailSyncContextType | undefined>(undefined)

export function EmailSyncProvider({ children }: { children: ReactNode }) {
  const [syncEnabled, setSyncEnabled] = useState(false)
  const [masterFormat, setMasterFormat] = useState<SyncFormat | null>(null)
  const [sourceEmailId, setSourceEmailId] = useState<string | null>(null)
  const [syncVersion, setSyncVersion] = useState(0)
  
  const incrementSyncVersion = useCallback(() => {
    setSyncVersion(v => v + 1)
  }, [])
  
  return (
    <EmailSyncContext.Provider
      value={{
        syncEnabled,
        setSyncEnabled,
        masterFormat,
        setMasterFormat,
        sourceEmailId,
        setSourceEmailId,
        syncVersion,
        incrementSyncVersion
      }}
    >
      {children}
    </EmailSyncContext.Provider>
  )
}

export function useEmailSync() {
  const context = useContext(EmailSyncContext)
  if (context === undefined) {
    throw new Error('useEmailSync must be used within an EmailSyncProvider')
  }
  return context
}

// ============================================
// SYNC UTILITY FUNCTIONS
// ============================================

/**
 * Extract format from HTML content
 */
export function extractFormatFromHtml(htmlContent: string, body: EmailJsonBody): SyncFormat {
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = htmlContent
  const paragraphs = Array.from(tempDiv.querySelectorAll('p'))
  
  // Find empty paragraph indices
  const emptyParagraphIndices: number[] = []
  paragraphs.forEach((p, i) => {
    const text = (p.textContent || '').trim()
    if (text === '' || p.innerHTML === '<br>' || p.innerHTML === '<br/>') {
      emptyParagraphIndices.push(i)
    }
  })
  
  return {
    paragraphCount: paragraphs.length,
    emptyParagraphIndices,
    bannerEnabled: body.bannerEnabled || false,
    // Don't default to any specific sender - use whatever is in the body
    signatureMemberId: body.signatureMemberId || '',
    signature: body.signature || (body.signatureMemberId ? getSignatureText(body.signatureMemberId) : '')
  }
}

/**
 * Apply master format to an email body
 * Returns the updated body with synced format settings
 */
export function applyFormatToBody(
  masterFormat: SyncFormat,
  currentBody: EmailJsonBody
): EmailJsonBody {
  return {
    ...currentBody,
    bannerEnabled: masterFormat.bannerEnabled,
    signatureMemberId: masterFormat.signatureMemberId,
    signature: masterFormat.signature
  }
}

/**
 * Apply format to HTML content
 * Adjusts paragraph count to match master
 */
export function applyFormatToHtml(
  masterFormat: SyncFormat,
  currentHtml: string
): string {
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = currentHtml
  const currentParagraphs = Array.from(tempDiv.querySelectorAll('p'))
  const currentCount = currentParagraphs.length
  const targetCount = masterFormat.paragraphCount
  
  if (currentCount === targetCount) {
    // Same count, ensure empty paragraphs are in right places
    masterFormat.emptyParagraphIndices.forEach(idx => {
      if (idx < currentParagraphs.length) {
        const p = currentParagraphs[idx]
        const text = (p.textContent || '').trim()
        // If master has this as empty and current has minimal content, make empty
        if (text.length < 5) {
          p.innerHTML = '<br>'
        }
      }
    })
    return tempDiv.innerHTML
  }
  
  if (currentCount < targetCount) {
    // Add empty paragraphs
    const diff = targetCount - currentCount
    for (let i = 0; i < diff; i++) {
      const newP = document.createElement('p')
      newP.innerHTML = '<br>'
      tempDiv.appendChild(newP)
    }
    return tempDiv.innerHTML
  }
  
  // currentCount > targetCount - merge last paragraphs
  const excess = currentCount - targetCount
  if (excess > 0 && currentParagraphs.length > targetCount) {
    // Get content from excess paragraphs
    const excessContent: string[] = []
    for (let i = targetCount; i < currentCount; i++) {
      const p = currentParagraphs[i]
      const content = p.innerHTML
      if (content && content !== '<br>' && content !== '<br/>') {
        excessContent.push(content)
      }
      p.remove()
    }
    // Append to last kept paragraph
    if (excessContent.length > 0 && targetCount > 0) {
      const lastKept = tempDiv.querySelectorAll('p')[targetCount - 1]
      if (lastKept) {
        lastKept.innerHTML += '<br>' + excessContent.join('<br>')
      }
    }
  }
  
  return tempDiv.innerHTML
}
