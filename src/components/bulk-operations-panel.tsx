'use client'

import { useState } from 'react'
import {
  Zap,
  CheckCircle,
  Send,
  RefreshCw,
  AlertTriangle,
  Users,
  Mail,
  Clock,
  Check,
  X,
  Loader2,
  ChevronDown,
  FileText,
  Sparkles,
  PlayCircle,
} from 'lucide-react'
import { BulkProgressModal, ConfirmDialog, useToast } from './toast'

interface BulkOperationsPanelProps {
  campaignId: string
  stats: {
    total: number
    by_confidence: {
      green: number
      yellow: number
      red: number
    }
    by_status: {
      draft: number
      approved: number
      sent: number
    }
    ready_to_send: number
    needs_review: number
  }
  onRefresh: () => void
}

export default function BulkOperationsPanel({
  campaignId,
  stats,
  onRefresh,
}: BulkOperationsPanelProps) {
  const { showToast } = useToast()
  const [isExpanded, setIsExpanded] = useState(true)
  const [loading, setLoading] = useState<string | null>(null)
  const [result, setResult] = useState<{
    operation: string
    success: number
    failed: number
    total: number
    dry_run?: boolean
    message?: string
  } | null>(null)
  
  // Progress modal state
  const [progressModal, setProgressModal] = useState<{
    isOpen: boolean
    title: string
    current: number
    total: number
    status: 'running' | 'success' | 'error' | 'cancelled'
    errors: string[]
    skipped: number
    failed: number
  }>({
    isOpen: false,
    title: '',
    current: 0,
    total: 0,
    status: 'running',
    errors: [],
    skipped: 0,
    failed: 0
  })
  
  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    title: string
    message: string
    onConfirm: () => void
    variant: 'danger' | 'warning' | 'default'
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    variant: 'default'
  })

  interface OperationOptions {
    filter?: 'green' | 'yellow' | 'red' | 'all'
    sender_id?: string
    dry_run?: boolean
  }

  const executeOperation = async (operation: string, options: OperationOptions = {}) => {
    setLoading(operation)
    setResult(null)

    // For send operations, show progress modal
    const isSendOperation = operation.includes('send') && !options.dry_run
    
    if (isSendOperation) {
      setProgressModal({
        isOpen: true,
        title: 'Sending Emails',
        current: 0,
        total: stats.ready_to_send,
        status: 'running',
        errors: [],
        skipped: 0,
        failed: 0
      })
    }

    try {
      const response = await fetch('/api/bulk-operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation,
          campaign_id: campaignId,
          ...options,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setResult(data.result)
        
        if (isSendOperation) {
          setProgressModal(prev => ({
            ...prev,
            current: data.result.success,
            skipped: data.result.skipped || 0,
            failed: data.result.failed || 0,
            status: data.result.failed > 0 ? 'error' : 'success',
            errors: data.result.errors || []
          }))
        }
        
        onRefresh()
      } else {
        if (isSendOperation) {
          setProgressModal(prev => ({
            ...prev,
            status: 'error',
            errors: [data.error]
          }))
        } else {
          showToast(`Error: ${data.error}`, 'error')
        }
      }
    } catch (err: any) {
      if (isSendOperation) {
        setProgressModal(prev => ({
          ...prev,
          status: 'error',
          errors: [err.message]
        }))
      } else {
        showToast(`Error: ${err.message}`, 'error')
      }
    } finally {
      setLoading(null)
    }
  }
  
  // Wrapper for send operations that require confirmation
  const confirmAndExecute = (operation: string, title: string, message: string, options: OperationOptions = {}) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      variant: operation.includes('send') ? 'warning' : 'default',
      onConfirm: () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }))
        executeOperation(operation, options)
      }
    })
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-6 py-4 bg-gradient-to-r from-brand-50 to-white hover:from-brand-100 transition-colors"
      >
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-brand-600 rounded-lg flex items-center justify-center">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-gray-900">Bulk Operations</h3>
            <p className="text-sm text-gray-500">Mass actions for {stats.total} emails</p>
          </div>
        </div>
        <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
      </button>

      {isExpanded && (
        <div className="p-6 border-t border-gray-100">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <Mail className="h-5 w-5 text-gray-400" />
                <span className="text-2xl font-bold text-gray-900">{stats.total}</span>
              </div>
              <p className="text-sm text-gray-500 mt-1">Total Emails</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="text-2xl font-bold text-green-700">{stats.by_confidence.green}</span>
              </div>
              <p className="text-sm text-green-600 mt-1">Green (Ready)</p>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                <span className="text-2xl font-bold text-yellow-700">{stats.by_confidence.yellow}</span>
              </div>
              <p className="text-sm text-yellow-600 mt-1">Yellow (Review)</p>
            </div>
            <div className="bg-red-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <X className="h-5 w-5 text-red-500" />
                <span className="text-2xl font-bold text-red-700">{stats.by_confidence.red}</span>
              </div>
              <p className="text-sm text-red-600 mt-1">Red (Needs Work)</p>
            </div>
          </div>

          {/* Status Row */}
          <div className="flex items-center space-x-6 mb-6 pb-6 border-b border-gray-100">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
              <span className="text-sm text-gray-600">{stats.by_status.draft} Draft</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span className="text-sm text-gray-600">{stats.by_status.approved} Approved</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-600">{stats.by_status.sent} Sent</span>
            </div>
            <div className="ml-auto">
              <span className="px-3 py-1 bg-brand-100 text-brand-700 text-sm font-medium rounded-full">
                {stats.ready_to_send} ready to send
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Approve All Green */}
            <button
              onClick={() => executeOperation('approve_green')}
              disabled={loading !== null || stats.by_confidence.green === 0}
              className="flex items-center justify-center space-x-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading === 'approve_green' ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Check className="h-5 w-5" />
              )}
              <span>Approve Green ({stats.by_confidence.green})</span>
            </button>

            {/* Approve All */}
            <button
              onClick={() => executeOperation('approve_all')}
              disabled={loading !== null || stats.by_status.draft === 0}
              className="flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading === 'approve_all' ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <CheckCircle className="h-5 w-5" />
              )}
              <span>Approve All ({stats.by_status.draft})</span>
            </button>

            {/* Dry Run - Test without sending */}
            <button
              onClick={() => executeOperation('send_dry_run')}
              disabled={loading !== null || stats.ready_to_send === 0}
              className="flex items-center justify-center space-x-2 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading === 'send_dry_run' ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <PlayCircle className="h-5 w-5" />
              )}
              <span>Dry Run ({stats.ready_to_send})</span>
            </button>

            {/* Send All Approved */}
            <button
              onClick={() => confirmAndExecute(
                'send_approved',
                'Send All Approved Emails?',
                `You are about to send ${stats.ready_to_send} emails. This action cannot be undone.`
              )}
              disabled={loading !== null || stats.ready_to_send === 0}
              className="flex items-center justify-center space-x-2 px-4 py-3 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading === 'send_approved' ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
              <span>Send Approved ({stats.ready_to_send})</span>
            </button>

            {/* Regenerate Red */}
            <button
              onClick={() => executeOperation('regenerate_red')}
              disabled={loading !== null || stats.by_confidence.red === 0}
              className="flex items-center justify-center space-x-2 px-4 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading === 'regenerate_red' ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <RefreshCw className="h-5 w-5" />
              )}
              <span>Regenerate Red ({stats.by_confidence.red})</span>
            </button>
          </div>

          {/* Result Display */}
          {result && (
            <div className={`mt-4 p-4 rounded-lg ${
              result.dry_run 
                ? 'bg-purple-50 border border-purple-200' 
                : result.failed > 0 
                  ? 'bg-amber-50 border border-amber-200' 
                  : 'bg-green-50 border border-green-200'
            }`}>
              <div className="flex items-center space-x-2">
                {result.dry_run ? (
                  <PlayCircle className="h-5 w-5 text-purple-600" />
                ) : result.failed > 0 ? (
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                ) : (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                )}
                <span className={`font-medium ${
                  result.dry_run 
                    ? 'text-purple-800' 
                    : result.failed > 0 
                      ? 'text-amber-800' 
                      : 'text-green-800'
                }`}>
                  {result.dry_run 
                    ? `DRY RUN: ${result.success} emails validated (no emails sent)`
                    : `${result.operation.replace('_', ' ').toUpperCase()}: ${result.success} succeeded${result.failed > 0 ? `, ${result.failed} failed` : ''}`
                  }
                </span>
              </div>
              {result.dry_run && (
                <p className="text-sm text-purple-600 mt-2">
                  ✅ All emails passed validation. Click &quot;Send Approved&quot; to actually send them.
                </p>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText="Send Emails"
        cancelText="Cancel"
        variant={confirmDialog.variant}
      />
      
      {/* Progress Modal */}
      <BulkProgressModal
        isOpen={progressModal.isOpen}
        title={progressModal.title}
        current={progressModal.current}
        total={progressModal.total}
        status={progressModal.status}
        errors={progressModal.errors}
        skipped={progressModal.skipped}
        failed={progressModal.failed}
        onClose={() => setProgressModal(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  )
}

// ============================================
// BATCH GENERATION MODAL
// ============================================

interface BatchGenerationModalProps {
  isOpen: boolean
  onClose: () => void
  campaignId: string
  contactIds: string[]
  totalPending?: number  // Total contacts still needing drafts (for showing "X more remaining")
  onComplete: () => void
}

export function BatchGenerationModal({
  isOpen,
  onClose,
  campaignId,
  contactIds,
  totalPending,
  onComplete,
}: BatchGenerationModalProps) {
  const { showToast } = useToast()
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [result, setResult] = useState<any>(null)
  const [config, setConfig] = useState({
    category: 'vc-outreach',
    sender_id: 'jean-francois',
    tone: 'warm',
    include_forbes_link: true,
    include_demo_link: true,
    include_pitch_deck: false,
  })

  if (!isOpen) return null

  const startGeneration = async () => {
    setIsGenerating(true)
    setProgress({ current: 0, total: contactIds.length })

    try {
      const response = await fetch('/api/batch-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_id: campaignId,
          contact_ids: contactIds,
          ...config,
          save_to_db: true,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setResult(data.result)
        onComplete()
      } else {
        showToast(`Error: ${data.error}`, 'error')
      }
    } catch (err: any) {
      showToast(`Error: ${err.message}`, 'error')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-brand-600 rounded-lg flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Generate AI Emails</h2>
              <p className="text-sm text-gray-500">
                {contactIds.length} contacts in this batch
                {totalPending && totalPending > contactIds.length && (
                  <span className="text-amber-600 ml-1">
                    ({totalPending - contactIds.length} more after this batch)
                  </span>
                )}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Config */}
        {!isGenerating && !result && (
          <div className="p-6 space-y-4 overflow-y-auto">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
              <select
                value={config.category}
                onChange={(e) => setConfig({ ...config, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="vc-outreach">VC Outreach</option>
                <option value="media-outreach">Media Outreach</option>
                <option value="client-outreach">Client Outreach</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sender</label>
              <select
                value={config.sender_id}
                onChange={(e) => setConfig({ ...config, sender_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="jean-francois">Jean-François (IR Associate)</option>
                <option value="fahd">Fahd (CIO & Co-Founder)</option>
                <option value="marcos">Marcos (CEO & Co-Founder)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tone</label>
              <select
                value={config.tone}
                onChange={(e) => setConfig({ ...config, tone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="warm">Warm & Personable</option>
                <option value="direct">Direct & Concise</option>
                <option value="technical">Technical & Detailed</option>
                <option value="visionary">Visionary & Big Picture</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Include in emails</label>
              <div className="flex flex-wrap gap-3">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={config.include_forbes_link}
                    onChange={(e) => setConfig({ ...config, include_forbes_link: e.target.checked })}
                    className="rounded text-brand-600"
                  />
                  <span className="text-sm text-gray-600">Forbes Link</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={config.include_demo_link}
                    onChange={(e) => setConfig({ ...config, include_demo_link: e.target.checked })}
                    className="rounded text-brand-600"
                  />
                  <span className="text-sm text-gray-600">Demo Link</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={config.include_pitch_deck}
                    onChange={(e) => setConfig({ ...config, include_pitch_deck: e.target.checked })}
                    className="rounded text-brand-600"
                  />
                  <span className="text-sm text-gray-600">Pitch Deck</span>
                </label>
              </div>
            </div>

            {/* Estimate */}
            <div className="bg-gray-50 rounded-lg p-4 mt-4">
              <div className="flex items-center space-x-2 text-gray-700">
                <Clock className="h-5 w-5" />
                <span>Estimated time: ~{Math.ceil(contactIds.length * 3 / 60)} minutes</span>
              </div>
            </div>
          </div>
        )}

        {/* Progress */}
        {isGenerating && (
          <div className="p-6 flex flex-col items-center justify-center">
            <Loader2 className="h-12 w-12 text-brand-600 animate-spin mb-4" />
            <p className="text-lg font-medium text-gray-900">Generating emails...</p>
            <p className="text-sm text-gray-500 mt-1">This may take a few minutes</p>
            <div className="w-full max-w-xs mt-6">
              <div className="bg-gray-200 rounded-full h-2">
                <div
                  className="bg-brand-600 rounded-full h-2 transition-all"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
              <p className="text-center text-sm text-gray-500 mt-2">
                {progress.current} / {progress.total}
              </p>
            </div>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="p-6">
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <h3 className="text-xl font-semibold text-center text-gray-900 mb-2">
              Generation Complete!
            </h3>
            <p className="text-center text-gray-500 mb-6">
              {result.generated} emails generated
            </p>

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-green-700">{result.green}</p>
                <p className="text-sm text-green-600">Green</p>
              </div>
              <div className="bg-yellow-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-yellow-700">{result.yellow}</p>
                <p className="text-sm text-yellow-600">Yellow</p>
              </div>
              <div className="bg-red-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-red-700">{result.red}</p>
                <p className="text-sm text-red-600">Red</p>
              </div>
            </div>

            {result.needs_review > 0 && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  <AlertTriangle className="h-4 w-4 inline mr-1" />
                  {result.needs_review} emails need review before sending
                </p>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            {result ? 'Close' : 'Cancel'}
          </button>
          {!isGenerating && !result && (
            <button
              onClick={startGeneration}
              className="px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors flex items-center space-x-2"
            >
              <Sparkles className="h-5 w-5" />
              <span>Generate {contactIds.length} Emails</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
