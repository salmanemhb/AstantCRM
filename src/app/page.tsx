'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { 
  Mail, 
  Users, 
  Target, 
  BarChart3, 
  ArrowRight,
  Loader2,
  FileSpreadsheet,
  Sparkles,
  Send,
  CheckCircle
} from 'lucide-react'
import { getDashboardStats, type DashboardStats } from '@/lib/api'

export default function HomePage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    async function fetchStats() {
      try {
        const data = await getDashboardStats()
        setStats(data)
        setIsConnected(true)
      } catch {
        setIsConnected(false)
      } finally {
        setIsLoading(false)
      }
    }
    fetchStats()
  }, [])

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-brand-500 to-brand-600 rounded-lg flex items-center justify-center">
                <Mail className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">Astant Outreach</span>
            </div>
            <nav className="flex items-center space-x-4">
              <Link 
                href="/campaigns" 
                className="text-white bg-brand-600 hover:bg-brand-700 px-4 py-2 text-sm font-medium rounded-lg flex items-center space-x-1"
              >
                <Target className="h-4 w-4" />
                <span>Campaigns</span>
              </Link>
              <Link 
                href="/contacts" 
                className="text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium"
              >
                Contacts
              </Link>
              <Link 
                href="/analytics" 
                className="text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium flex items-center space-x-1"
              >
                <BarChart3 className="h-4 w-4" />
                <span>Analytics</span>
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            AI-Powered Investor Outreach
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
            Import your VC contacts, generate personalized emails with AI, 
            edit with full control, and send with confidence.
          </p>
          <div className="flex items-center justify-center space-x-4">
            <Link
              href="/campaigns"
              className="inline-flex items-center space-x-2 px-6 py-3 bg-brand-600 text-white text-lg font-medium rounded-lg hover:bg-brand-700 transition-colors"
            >
              <Target className="h-5 w-5" />
              <span>Start a Campaign</span>
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href="/contacts"
              className="inline-flex items-center space-x-2 px-6 py-3 border-2 border-gray-300 text-gray-700 text-lg font-medium rounded-lg hover:border-gray-400 hover:bg-gray-50 transition-colors"
            >
              <Users className="h-5 w-5" />
              <span>Import Contacts</span>
            </Link>
          </div>
          {isConnected && (
            <span className="inline-flex items-center mt-6 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
              <CheckCircle className="h-3 w-3 mr-1" />
              Connected to Supabase
            </span>
          )}
        </div>

        {/* Pipeline Steps */}
        <div className="mb-16">
          <h2 className="text-center text-lg font-semibold text-gray-900 mb-8">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <FileSpreadsheet className="h-8 w-8 text-purple-600" />
              </div>
              <div className="text-sm font-bold text-purple-600 mb-1">Step 1</div>
              <h3 className="font-semibold text-gray-900 mb-2">Import Contacts</h3>
              <p className="text-sm text-gray-600">
                Upload CSV/Excel with any columns. We auto-detect and preserve all data.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-brand-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Target className="h-8 w-8 text-brand-600" />
              </div>
              <div className="text-sm font-bold text-brand-600 mb-1">Step 2</div>
              <h3 className="font-semibold text-gray-900 mb-2">Create Campaign</h3>
              <p className="text-sm text-gray-600">
                Define your outreach goals, tone, and templates for personalization.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-yellow-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Sparkles className="h-8 w-8 text-yellow-600" />
              </div>
              <div className="text-sm font-bold text-yellow-600 mb-1">Step 3</div>
              <h3 className="font-semibold text-gray-900 mb-2">Generate & Edit</h3>
              <p className="text-sm text-gray-600">
                AI creates personalized drafts. Edit freely with rich formatting tools.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Send className="h-8 w-8 text-green-600" />
              </div>
              <div className="text-sm font-bold text-green-600 mb-1">Step 4</div>
              <h3 className="font-semibold text-gray-900 mb-2">Review & Send</h3>
              <p className="text-sm text-gray-600">
                Verify each email individually. Attach files, then send with one click.
              </p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
          <Link href="/campaigns" className="card-hover">
            <div className="bg-white rounded-xl p-6 border border-gray-200 hover:border-brand-300 hover:shadow-md transition-all">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-brand-500 to-brand-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Target className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Campaigns</h3>
                  <p className="text-gray-600 text-sm mb-4">
                    Create targeted campaigns, add VCs, generate AI drafts, and manage your outreach pipeline.
                  </p>
                  <div className="flex items-center text-brand-600 text-sm font-medium">
                    View Campaigns <ArrowRight className="ml-1 h-4 w-4" />
                  </div>
                </div>
              </div>
            </div>
          </Link>

          <Link href="/contacts" className="card-hover">
            <div className="bg-white rounded-xl p-6 border border-gray-200 hover:border-purple-300 hover:shadow-md transition-all">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Users className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Contacts</h3>
                  <p className="text-gray-600 text-sm mb-4">
                    Import spreadsheets with any format. View all contact data dynamically per-person.
                  </p>
                  <div className="flex items-center text-purple-600 text-sm font-medium">
                    View Contacts <ArrowRight className="ml-1 h-4 w-4" />
                  </div>
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* Stats Preview */}
        <div className="bg-white rounded-xl p-8 border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
            <BarChart3 className="h-5 w-5 mr-2 text-gray-400" />
            Pipeline Overview
          </h2>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <p className="text-3xl font-bold text-gray-900">
                    {stats?.pendingEmails ?? '--'}
                  </p>
                  <p className="text-sm text-gray-500">Drafts Pending</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-green-600">
                    {stats?.emailsByConfidence.green ?? '--'}
                  </p>
                  <p className="text-sm text-gray-500">High Confidence</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-brand-600">
                    {stats?.sentThisWeek ?? '--'}
                  </p>
                  <p className="text-sm text-gray-500">Sent This Week</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-purple-600">
                    {stats?.totalContacts ?? '--'}
                  </p>
                  <p className="text-sm text-gray-500">Total Contacts</p>
                </div>
              </div>
              {stats && (
                <div className="mt-6 pt-6 border-t border-gray-100">
                  <div className="flex items-center space-x-4 text-sm">
                    <span className="text-gray-500">Confidence Distribution:</span>
                    <span className="flex items-center">
                      <span className="w-3 h-3 rounded-full bg-green-500 mr-1"></span>
                      {stats.emailsByConfidence.green} green
                    </span>
                    <span className="flex items-center">
                      <span className="w-3 h-3 rounded-full bg-yellow-500 mr-1"></span>
                      {stats.emailsByConfidence.yellow} yellow
                    </span>
                    <span className="flex items-center">
                      <span className="w-3 h-3 rounded-full bg-red-500 mr-1"></span>
                      {stats.emailsByConfidence.red} red
                    </span>
                  </div>
                </div>
              )}
              {!isConnected && (
                <p className="text-xs text-gray-400 mt-4">
                  Connect to Supabase to see live data
                </p>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}
