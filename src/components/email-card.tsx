'use client'

import { useState } from 'react'
import { 
  Check, 
  X, 
  RotateCcw, 
  Send,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  AlertCircle
} from 'lucide-react'
import type { Email, EmailJsonBody, ConfidenceScore, RebuttalType } from '@/lib/types'
import { cn, getConfidenceColor } from '@/lib/utils'

// Rebuttal options
const REBUTTAL_OPTIONS: { type: RebuttalType; label: string; icon: string }[] = [
  { type: 'SOFTER_TONE', label: 'Softer', icon: '🕊️' },
  { type: 'MORE_TECHNICAL', label: 'Technical', icon: '⚙️' },
  { type: 'SHORTER', label: 'Shorter', icon: '✂️' },
  { type: 'CLARIFY_VALUE_PROP', label: 'Clearer', icon: '💡' },
  { type: 'LESS_PITCHY', label: 'Less Pitchy', icon: '🎯' },
]

interface EmailCardProps {
  email: Email
  contactName: string
  firmName: string
  onApprove: (emailId: string) => void
  onReject: (emailId: string) => void
  onRebuttal: (emailId: string, type: RebuttalType) => void
  onSend: (emailId: string) => void
  isProcessing: boolean
}

export function EmailCard({
  email,
  contactName,
  firmName,
  onApprove,
  onReject,
  onRebuttal,
  onSend,
  isProcessing,
}: EmailCardProps) {
  const [showRebuttalMenu, setShowRebuttalMenu] = useState(false)
  const [animationClass, setAnimationClass] = useState('')

  const handleApprove = () => {
    setAnimationClass('swipe-right')
    setTimeout(() => onApprove(email.id), 300)
  }

  const handleReject = () => {
    setAnimationClass('swipe-left')
    setTimeout(() => onReject(email.id), 300)
  }

  const body = email.current_body

  return (
    <div className={cn(
      "bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden max-w-2xl w-full",
      animationClass
    )}>
      {/* Header */}
      <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">{contactName}</h3>
            <p className="text-sm text-gray-500">{firmName}</p>
          </div>
          <div className="flex items-center space-x-2">
            <span className={cn(
              "confidence-badge",
              email.confidence_score
            )}>
              {email.confidence_score.toUpperCase()}
            </span>
            {email.last_rebuttal_enum && (
              <span className="text-xs text-gray-400">
                Edited: {email.last_rebuttal_enum.replace('_', ' ')}
              </span>
            )}
          </div>
        </div>
        <div className="mt-2">
          <p className="text-sm font-medium text-gray-700">
            Subject: {email.subject}
          </p>
        </div>
      </div>

      {/* Email Body */}
      <div className="p-6 email-preview">
        <p className="font-medium">{body.greeting}</p>
        <p>{body.context_p1}</p>
        <p>{body.value_p2}</p>
        <p>{body.cta}</p>
        <p className="whitespace-pre-line text-gray-600">{body.signature}</p>
      </div>

      {/* Red Confidence Warning */}
      {email.confidence_score === 'red' && (
        <div className="px-6 py-3 bg-red-50 border-t border-red-100">
          <div className="flex items-center text-red-700 text-sm">
            <AlertCircle className="h-4 w-4 mr-2" />
            Low confidence — review carefully or apply rebuttal
          </div>
        </div>
      )}

      {/* Rebuttal Menu */}
      {showRebuttalMenu && (
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <p className="text-xs text-gray-500 mb-3">Choose a refinement:</p>
          <div className="flex flex-wrap gap-2">
            {REBUTTAL_OPTIONS.map((option) => (
              <button
                key={option.type}
                onClick={() => {
                  onRebuttal(email.id, option.type)
                  setShowRebuttalMenu(false)
                }}
                disabled={isProcessing}
                className="flex items-center space-x-1 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-sm hover:bg-gray-100 disabled:opacity-50"
              >
                <span>{option.icon}</span>
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="px-6 py-4 border-t border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          {/* Reject */}
          <button
            onClick={handleReject}
            disabled={isProcessing}
            className="w-14 h-14 rounded-full bg-red-100 hover:bg-red-200 flex items-center justify-center transition-colors disabled:opacity-50"
          >
            <X className="h-7 w-7 text-red-600" />
          </button>

          {/* Rebuttal Toggle */}
          <button
            onClick={() => setShowRebuttalMenu(!showRebuttalMenu)}
            disabled={isProcessing}
            className="w-12 h-12 rounded-full bg-purple-100 hover:bg-purple-200 flex items-center justify-center transition-colors disabled:opacity-50"
          >
            <Sparkles className="h-5 w-5 text-purple-600" />
          </button>

          {/* Approve */}
          {!email.approved ? (
            <button
              onClick={handleApprove}
              disabled={isProcessing || email.confidence_score === 'red'}
              className="w-14 h-14 rounded-full bg-green-100 hover:bg-green-200 flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={email.confidence_score === 'red' ? 'Cannot approve red confidence emails' : 'Approve'}
            >
              <Check className="h-7 w-7 text-green-600" />
            </button>
          ) : (
            <button
              onClick={() => onSend(email.id)}
              disabled={isProcessing}
              className="w-14 h-14 rounded-full bg-brand-100 hover:bg-brand-200 flex items-center justify-center transition-colors disabled:opacity-50"
            >
              <Send className="h-6 w-6 text-brand-600" />
            </button>
          )}
        </div>

        {/* Status text */}
        <div className="text-center mt-3">
          {email.approved ? (
            <p className="text-sm text-green-600 font-medium">✓ Approved — Ready to send</p>
          ) : (
            <p className="text-xs text-gray-400">Swipe or tap to decide</p>
          )}
        </div>
      </div>
    </div>
  )
}

// Empty state component
export function EmptyQueue() {
  return (
    <div className="text-center py-16">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <Check className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">Queue is empty!</h3>
      <p className="text-gray-500 max-w-sm mx-auto">
        All drafts have been reviewed. Generate new drafts from your campaigns.
      </p>
    </div>
  )
}
