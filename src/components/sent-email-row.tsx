'use client'

import { CheckCircle, ExternalLink, ChevronRight } from 'lucide-react'
import Link from 'next/link'

interface SentEmailRowProps {
  emailId: string
  contactName: string
  contactEmail: string
  contactFirm?: string | null
  contactInitials: string
  subject: string
  sentAt: string
  campaignId: string
}

/**
 * Lightweight component for displaying sent emails
 * Much lighter than GmailEmailComposer - just shows a summary row
 */
export default function SentEmailRow({
  emailId,
  contactName,
  contactEmail,
  contactFirm,
  contactInitials,
  subject,
  sentAt,
  campaignId,
}: SentEmailRowProps) {
  const sentDate = new Date(sentAt)
  const formattedDate = sentDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="flex items-center justify-between py-3 px-4 bg-green-50/50 rounded-lg border border-green-100 hover:bg-green-50 transition-colors group">
      <div className="flex items-center space-x-3 min-w-0 flex-1">
        {/* Avatar */}
        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-green-700 font-semibold text-sm">{contactInitials}</span>
        </div>
        
        {/* Contact Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
            <span className="font-medium text-gray-900 truncate">{contactName}</span>
            {contactFirm && (
              <span className="text-gray-400 truncate hidden sm:inline">• {contactFirm}</span>
            )}
          </div>
          <p className="text-sm text-gray-500 truncate">
            {subject}
          </p>
        </div>
      </div>

      {/* Right side - date and link */}
      <div className="flex items-center space-x-4 flex-shrink-0 ml-4">
        <span className="text-sm text-gray-400">{formattedDate}</span>
        
        <Link
          href={`/contacts/${emailId}?from=campaign&campaignId=${campaignId}`}
          className="flex items-center space-x-1 text-sm text-brand-600 hover:text-brand-700 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <span>View</span>
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}
