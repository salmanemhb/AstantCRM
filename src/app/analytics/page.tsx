'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
    BarChart3, TrendingUp, Mail, Users,
    MessageSquare, AlertTriangle, ArrowUp, ArrowDown,
    Activity, Flame, Clock, RefreshCw, Eye,
    User, Building2, Send, Search, MoreHorizontal,
    ExternalLink, Globe
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// ============================================
// TYPES
// ============================================

interface AnalyticsData {
    totals: {
        total_campaigns: number
        total_contacts: number
        total_emails_sent: number
        total_opens: number
        total_replies: number
        total_bounces: number
    }
    rates: {
        open_rate: number
        reply_rate: number
        bounce_rate: number
    }
    daily_trends: Array<{
        date: string
        sent: number
        opened: number
        replied: number
    }>
    top_campaigns: Array<{
        id: string
        name: string
        sent: number
        open_rate: number
        click_rate: number
        reply_rate: number
    }>
    hot_contacts: Array<{
        engagement_score: number
        tier: string
        total_opens: number
        total_clicks: number
        total_replies: number
        contact: {
            id: string
            first_name: string
            last_name: string
            email: string
            firm: string
        }
    }>
    recent_activity: Array<{
        id: string
        event_type: string
        timestamp: string
        email?: {
            subject: string
            contact_campaign?: {
                contact?: {
                    first_name: string
                    last_name: string
                    firm: string
                }
            }
        }
    }>
}

interface PipelineItem {
    id: string
    pipeline_stage: string
    stage: string
    contact: {
        id: string
        first_name: string
        last_name: string
        email: string
        firm: string
        role: string
    }
    campaign: {
        id: string
        name: string
    }
    emails: Array<{
        id: string
        subject: string
        sent_at: string
        opened_at: string | null
        clicked_at: string | null
        replied_at: string | null
    }>
}

interface ContactDetail {
    id: string
    first_name: string
    last_name: string
    email: string
    firm: string | null
    role: string | null
    geography: string | null
    investment_focus: string | null
    notes_private: string | null
    created_at: string
    campaigns: Array<{
        id: string
        campaign_name: string
        stage: string
        pipeline_stage: string
        emails: Array<{
            id: string
            subject: string
            sent_at: string | null
            opened_at: string | null
            clicked_at: string | null
            replied_at: string | null
        }>
    }>
}

// ============================================
// TAB DEFINITIONS
// ============================================

type TabId = 'overview' | 'pipeline' | 'contacts'

import type { LucideIcon } from 'lucide-react'

const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'pipeline', label: 'Pipeline', icon: Users },
    { id: 'contacts', label: 'Contacts', icon: User },
]

const PIPELINE_STAGES = [
    { id: 'sent', label: 'Sent', color: 'bg-gray-100 border-gray-300', textColor: 'text-gray-700', dotColor: 'bg-gray-400' },
    { id: 'opened', label: 'Opened', color: 'bg-blue-50 border-blue-300', textColor: 'text-blue-700', dotColor: 'bg-blue-500' },
    { id: 'replied', label: 'Replied', color: 'bg-green-50 border-green-300', textColor: 'text-green-700', dotColor: 'bg-green-500' },
    { id: 'interested', label: 'Interested', color: 'bg-purple-50 border-purple-300', textColor: 'text-purple-700', dotColor: 'bg-purple-500' },
    { id: 'meeting', label: 'Meeting', color: 'bg-orange-50 border-orange-300', textColor: 'text-orange-700', dotColor: 'bg-orange-500' },
    { id: 'closed', label: 'Closed', color: 'bg-emerald-50 border-emerald-400', textColor: 'text-emerald-700', dotColor: 'bg-emerald-500' },
    { id: 'not_interested', label: 'Passed', color: 'bg-red-50 border-red-300', textColor: 'text-red-600', dotColor: 'bg-red-500' },
]

// ============================================
// UTILITY COMPONENTS
// ============================================

function StatCard({
    icon: Icon,
    label,
    value,
    subValue,
    trend,
    color = 'brand'
}: {
    icon: any
    label: string
    value: string | number
    subValue?: string
    trend?: { value: number; direction: 'up' | 'down' | 'neutral' }
    color?: 'brand' | 'green' | 'yellow' | 'red' | 'blue' | 'purple'
}) {
    const colorClasses: Record<string, string> = {
        brand: 'bg-brand-50 text-brand-600',
        green: 'bg-green-50 text-green-600',
        yellow: 'bg-yellow-50 text-yellow-600',
        red: 'bg-red-50 text-red-600',
        blue: 'bg-blue-50 text-blue-600',
        purple: 'bg-purple-50 text-purple-600'
    }

    return (
        <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-lg transition-all duration-200">
            <div className="flex items-center justify-between mb-3">
                <div className={`p-2.5 rounded-lg ${colorClasses[color]}`}>
                    <Icon className="h-5 w-5" />
                </div>
                {trend && (
                    <div className={`flex items-center text-sm font-medium ${
                        trend.direction === 'up' ? 'text-green-600' :
                        trend.direction === 'down' ? 'text-red-600' : 'text-gray-500'
                    }`}>
                        {trend.direction === 'up' && <ArrowUp className="h-4 w-4 mr-1" />}
                        {trend.direction === 'down' && <ArrowDown className="h-4 w-4 mr-1" />}
                        {trend.value}%
                    </div>
                )}
            </div>
            <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
            <p className="text-sm text-gray-500 mt-1">{label}</p>
            {subValue && (
                <p className="text-xs text-gray-400 mt-2">{subValue}</p>
            )}
        </div>
    )
}

interface ChartDataPoint {
    date: string
    sent?: number
    opened?: number
    replied?: number
    [key: string]: string | number | undefined
}

function SimpleBarChart({ data }: { data: ChartDataPoint[] }) {
    if (!data || data.length === 0) {
        return (
            <div className="h-[200px] flex items-center justify-center text-gray-400">
                <div className="text-center">
                    <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No data yet</p>
                </div>
            </div>
        )
    }

    const maxValue = Math.max(
        ...data.map(d => Math.max(d.sent || 0, d.opened || 0, d.replied || 0)),
        1
    )

    return (
        <div className="flex items-end gap-2 h-[200px] px-4 overflow-hidden">
            {data.slice(-14).map((day, i) => {
                const sentHeight = Math.min(((day.sent || 0) / maxValue) * 160, 160)
                const openedHeight = Math.min(((day.opened || 0) / maxValue) * 160, 160)

                return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                        <div className="w-full flex gap-0.5 relative" style={{ height: 160 }}>
                            <div
                                className="flex-1 bg-brand-200 rounded-t transition-all group-hover:bg-brand-300"
                                style={{ height: sentHeight, marginTop: 160 - sentHeight }}
                                title={`Sent: ${day.sent || 0}`}
                            />
                            <div
                                className="flex-1 bg-green-400 rounded-t transition-all group-hover:bg-green-500"
                                style={{ height: openedHeight, marginTop: 160 - openedHeight }}
                                title={`Opened: ${day.opened || 0}`}
                            />
                            <div className="absolute -top-16 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                                <div>Sent: {day.sent || 0}</div>
                                <div>Opened: {day.opened || 0}</div>
                            </div>
                        </div>
                        <span className="text-xs text-gray-400 group-hover:text-gray-600">
                            {new Date(day.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                        </span>
                    </div>
                )
            })}
        </div>
    )
}

function getEventDisplay(eventType: string) {
    switch (eventType) {
        case 'sent': return { icon: Send, color: 'text-blue-500 bg-blue-50', label: 'Sent' }
        case 'delivered': return { icon: Mail, color: 'text-green-500 bg-green-50', label: 'Delivered' }
        case 'opened': return { icon: Eye, color: 'text-purple-500 bg-purple-50', label: 'Opened' }
        case 'replied': return { icon: MessageSquare, color: 'text-green-600 bg-green-50', label: 'Replied' }
        case 'bounced': return { icon: AlertTriangle, color: 'text-red-500 bg-red-50', label: 'Bounced' }
        default: return { icon: Activity, color: 'text-gray-500 bg-gray-50', label: eventType }
    }
}

function getStageInfo(stage: string) {
    return PIPELINE_STAGES.find(s => s.id === stage) || PIPELINE_STAGES[0]
}

// ============================================
// OVERVIEW TAB
// ============================================

function OverviewTab({ 
    data, 
    days, 
    setDays, 
    syncing, 
    syncReplies, 
    syncMessage 
}: { 
    data: AnalyticsData | null
    days: number
    setDays: (d: number) => void
    syncing: boolean
    syncReplies: () => void
    syncMessage: string | null
}) {
    return (
        <div className="space-y-6">
            {/* Time range and sync controls */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {[7, 30, 90].map(d => (
                        <button
                            key={d}
                            onClick={() => setDays(d)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                days === d
                                    ? 'bg-brand-600 text-white'
                                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                            }`}
                        >
                            {d} days
                        </button>
                    ))}
                </div>
                <div className="relative">
                    <button
                        onClick={syncReplies}
                        disabled={syncing}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                        <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                        {syncing ? 'Syncing...' : 'Sync Data'}
                    </button>
                    {syncMessage && (
                        <div className={`absolute top-full right-0 mt-2 px-4 py-2 rounded-lg text-sm whitespace-nowrap ${
                            syncMessage.startsWith('OK') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                            {syncMessage}
                        </div>
                    )}
                </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-3 gap-4">
                <StatCard
                    icon={Mail}
                    label="Emails Sent"
                    value={data?.totals.total_emails_sent || 0}
                    subValue={`${data?.totals.total_campaigns || 0} campaigns`}
                    color="brand"
                />
                <StatCard
                    icon={Eye}
                    label="Opens"
                    value={data?.totals.total_opens || 0}
                    subValue={`${data?.rates.open_rate || 0}% open rate`}
                    color="blue"
                />
                <StatCard
                    icon={MessageSquare}
                    label="Replies"
                    value={data?.totals.total_replies || 0}
                    subValue={`${data?.rates.reply_rate || 0}% reply rate`}
                    color="green"
                />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Daily Activity Chart */}
                <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-semibold text-gray-900">Daily Activity</h2>
                        <div className="flex items-center gap-4 text-sm">
                            <span className="flex items-center">
                                <span className="w-3 h-3 bg-brand-200 rounded mr-2"></span>
                                Sent
                            </span>
                            <span className="flex items-center">
                                <span className="w-3 h-3 bg-green-400 rounded mr-2"></span>
                                Opened
                            </span>
                        </div>
                    </div>
                    <SimpleBarChart data={data?.daily_trends || []} />
                </div>

                {/* Hot Contacts */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                            <Flame className="h-5 w-5 text-orange-500 mr-2" />
                            Hot Contacts
                        </h2>
                    </div>
                    <div className="space-y-3">
                        {data?.hot_contacts?.slice(0, 5).map((hc, i) => (
                            <Link 
                                key={i} 
                                href={`/contacts/${hc.contact?.id}`}
                                className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0 hover:bg-gray-50 -mx-2 px-2 rounded transition-colors"
                            >
                                <div>
                                    <p className="font-medium text-gray-900">
                                        {hc.contact?.first_name} {hc.contact?.last_name}
                                    </p>
                                    <p className="text-xs text-gray-500">{hc.contact?.firm}</p>
                                </div>
                                <div className="text-right">
                                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                                        hc.tier === 'hot' ? 'bg-orange-100 text-orange-700' :
                                        hc.tier === 'warm' ? 'bg-yellow-100 text-yellow-700' :
                                        hc.tier === 'cool' ? 'bg-blue-100 text-blue-700' :
                                        'bg-gray-100 text-gray-700'
                                    }`}>
                                        Score: {hc.engagement_score}
                                    </span>
                                </div>
                            </Link>
                        )) || (
                            <p className="text-gray-400 text-sm py-4 text-center">No engagement data yet</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Campaigns */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <TrendingUp className="h-5 w-5 text-brand-600 mr-2" />
                        Top Campaigns
                    </h2>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="text-left text-xs text-gray-500 uppercase border-b border-gray-100">
                                    <th className="pb-3 font-medium">Campaign</th>
                                    <th className="pb-3 text-right font-medium">Sent</th>
                                    <th className="pb-3 text-right font-medium">Open %</th>
                                    <th className="pb-3 text-right font-medium">Reply %</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data?.top_campaigns?.map((campaign, i) => (
                                    <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                                        <td className="py-3">
                                            <Link href={`/campaigns/${campaign.id}`} className="text-brand-600 hover:underline font-medium">
                                                {campaign.name}
                                            </Link>
                                        </td>
                                        <td className="py-3 text-right text-gray-900">{campaign.sent}</td>
                                        <td className="py-3 text-right">
                                            <span className={`${campaign.open_rate >= 30 ? 'text-green-600' : campaign.open_rate >= 15 ? 'text-yellow-600' : 'text-gray-600'}`}>
                                                {campaign.open_rate}%
                                            </span>
                                        </td>
                                        <td className="py-3 text-right">
                                            <span className={`${campaign.reply_rate >= 10 ? 'text-green-600' : campaign.reply_rate >= 5 ? 'text-yellow-600' : 'text-gray-600'}`}>
                                                {campaign.reply_rate}%
                                            </span>
                                        </td>
                                    </tr>
                                )) || (
                                    <tr>
                                        <td colSpan={4} className="py-8 text-center text-gray-400">
                                            No campaign data yet
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <Clock className="h-5 w-5 text-gray-600 mr-2" />
                        Recent Activity
                    </h2>
                    <div className="space-y-4 max-h-[300px] overflow-y-auto">
                        {data?.recent_activity?.slice(0, 10).map((activity, i) => {
                            const event = getEventDisplay(activity.event_type)
                            const Icon = event.icon
                            const contact = activity.email?.contact_campaign?.contact

                            return (
                                <div key={i} className="flex items-start gap-3">
                                    <div className={`p-2 rounded-full ${event.color}`}>
                                        <Icon className="h-4 w-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-gray-900 truncate">
                                            <span className="font-medium">{contact?.first_name} {contact?.last_name}</span>
                                            {' '}<span className="text-gray-500">{event.label.toLowerCase()}</span>
                                        </p>
                                        <p className="text-xs text-gray-500 truncate">
                                            {activity.email?.subject}
                                        </p>
                                    </div>
                                    <span className="text-xs text-gray-400 whitespace-nowrap">
                                        {new Date(activity.timestamp).toLocaleTimeString('en-US', {
                                            hour: 'numeric',
                                            minute: '2-digit'
                                        })}
                                    </span>
                                </div>
                            )
                        }) || (
                            <p className="text-gray-400 text-sm py-4 text-center">No recent activity</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

// ============================================
// PIPELINE TAB (KANBAN)
// ============================================

function PipelineTab({ 
    pipeline, 
    loading, 
    onStageChange,
    onManualTrack 
}: { 
    pipeline: Record<string, PipelineItem[]>
    loading: boolean
    onStageChange: (id: string, stage: string) => void
    onManualTrack: (id: string, action: string) => void
}) {
    const totalCount = Object.values(pipeline).flat().length

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-brand-600 border-t-transparent"></div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900">VC Pipeline</h2>
                    <p className="text-sm text-gray-500">{totalCount} contacts in pipeline</p>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                        <Activity className="h-4 w-4" />
                        Use dropdown to move stages
                    </span>
                </div>
            </div>

            {totalCount === 0 ? (
                <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
                    <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No contacts in pipeline</h3>
                    <p className="text-gray-500 mb-4">Send emails to VCs to populate the pipeline</p>
                    <Link href="/campaigns" className="text-brand-600 hover:text-brand-700 font-medium">
                        Go to Campaigns
                    </Link>
                </div>
            ) : (
                <div className="flex gap-4 overflow-x-auto pb-4">
                    {PIPELINE_STAGES.map(stage => {
                        const items = pipeline[stage.id] || []
                        return (
                            <div
                                key={stage.id}
                                className={`flex-shrink-0 w-72 ${stage.color} border-2 rounded-xl`}
                            >
                                <div className="p-4 border-b border-gray-200/50">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2.5 h-2.5 rounded-full ${stage.dotColor}`}></div>
                                            <h3 className={`font-semibold ${stage.textColor}`}>
                                                {stage.label}
                                            </h3>
                                        </div>
                                        <span className={`text-sm font-medium px-2 py-0.5 rounded-full bg-white/50 ${stage.textColor}`}>
                                            {items.length}
                                        </span>
                                    </div>
                                </div>

                                <div className="p-3 space-y-3 max-h-[500px] overflow-y-auto">
                                    {items.map(item => (
                                        <PipelineCard
                                            key={item.id}
                                            item={item}
                                            onStageChange={onStageChange}
                                            onManualTrack={onManualTrack}
                                        />
                                    ))}
                                    {items.length === 0 && (
                                        <p className="text-center py-8 text-gray-400 text-sm">
                                            No contacts
                                        </p>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

function PipelineCard({ 
    item, 
    onStageChange,
    onManualTrack 
}: { 
    item: PipelineItem
    onStageChange: (id: string, stage: string) => void
    onManualTrack: (id: string, action: string) => void
}) {
    const [showDropdown, setShowDropdown] = useState(false)
    const latestEmail = item.emails?.[0]
    const isOpened = !!latestEmail?.opened_at
    const isReplied = !!latestEmail?.replied_at

    return (
        <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-all">
            <div className="flex items-start justify-between mb-2">
                <Link href={`/contacts/${item.contact?.id}`} className="flex-1 min-w-0 hover:opacity-75">
                    <p className="font-semibold text-gray-900 truncate">
                        {item.contact?.first_name} {item.contact?.last_name}
                    </p>
                    <p className="text-sm text-brand-600 truncate">{item.contact?.firm || 'No firm'}</p>
                </Link>
                <div className="relative">
                    <button
                        onClick={() => setShowDropdown(!showDropdown)}
                        className="p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100"
                    >
                        <MoreHorizontal className="h-4 w-4" />
                    </button>
                    {showDropdown && (
                        <>
                            <div className="fixed inset-0 z-10" onClick={() => setShowDropdown(false)} />
                            <div className="absolute right-0 top-6 z-20 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[160px]">
                                <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase">Move to</div>
                                {PIPELINE_STAGES.map(stage => (
                                    <button
                                        key={stage.id}
                                        onClick={() => {
                                            onStageChange(item.id, stage.id)
                                            setShowDropdown(false)
                                        }}
                                        className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${
                                            item.pipeline_stage === stage.id ? 'bg-gray-100 font-medium' : ''
                                        }`}
                                    >
                                        <div className={`w-2 h-2 rounded-full ${stage.dotColor}`}></div>
                                        {stage.label}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>

            <p className="text-xs text-gray-500 truncate mb-1">{item.contact?.email}</p>
            {item.contact?.role && (
                <p className="text-xs text-gray-400 truncate mb-2">{item.contact?.role}</p>
            )}

            {item.campaign && (
                <div className="text-xs text-gray-400 mb-3 truncate">
                    Campaign: <span className="text-gray-600">{item.campaign.name}</span>
                </div>
            )}

            {latestEmail && (
                <div className="text-xs text-gray-400 mb-3 flex items-center gap-2">
                    <Mail className="h-3 w-3" />
                    <span className="truncate">{latestEmail.subject}</span>
                </div>
            )}

            <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                <button
                    onClick={() => onManualTrack(item.id, isOpened ? 'unmark_opened' : 'opened')}
                    className={`flex-1 px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1 ${
                        isOpened 
                            ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' 
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                >
                    <Eye className="h-3 w-3" />
                    {isOpened ? 'Opened' : 'Mark Open'}
                </button>
                <button
                    onClick={() => onManualTrack(item.id, 'replied')}
                    className={`flex-1 px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1 ${
                        isReplied || item.pipeline_stage === 'replied'
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                >
                    <MessageSquare className="h-3 w-3" />
                    {isReplied ? 'Replied' : 'Mark Reply'}
                </button>
            </div>
        </div>
    )
}

// ============================================
// CONTACTS TAB
// ============================================

function ContactsTab() {
    const [contacts, setContacts] = useState<ContactDetail[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedContact, setSelectedContact] = useState<ContactDetail | null>(null)
    const [filterStage, setFilterStage] = useState<string>('all')

    const supabase = createClient()

    useEffect(() => {
        fetchContacts()
    }, [])

    async function fetchContacts() {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('contacts')
                .select(`
                    id,
                    first_name,
                    last_name,
                    email,
                    firm,
                    role,
                    geography,
                    investment_focus,
                    notes_private,
                    created_at,
                    contact_campaigns (
                        id,
                        stage,
                        pipeline_stage,
                        campaign:campaigns (
                            id,
                            name
                        ),
                        emails (
                            id,
                            subject,
                            sent_at,
                            opened_at,
                            clicked_at,
                            replied_at
                        )
                    )
                `)
                .order('created_at', { ascending: false })

            if (error) throw error

            const transformed = data?.map(c => ({
                ...c,
                campaigns: c.contact_campaigns?.map((cc: any) => ({
                    id: cc.id,
                    campaign_name: cc.campaign?.name || 'Unknown',
                    stage: cc.stage,
                    pipeline_stage: cc.pipeline_stage,
                    emails: cc.emails || []
                })) || []
            })).filter(c => c.campaigns.length > 0)

            setContacts(transformed || [])
        } catch (err) {
            console.error('Failed to fetch contacts:', err)
        } finally {
            setLoading(false)
        }
    }

    const filteredContacts = contacts.filter(c => {
        const matchesSearch = searchQuery === '' || 
            `${c.first_name} ${c.last_name} ${c.email} ${c.firm}`.toLowerCase().includes(searchQuery.toLowerCase())
        
        const matchesStage = filterStage === 'all' || 
            c.campaigns.some(camp => camp.pipeline_stage === filterStage || camp.stage === filterStage)
        
        return matchesSearch && matchesStage
    })

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-brand-600 border-t-transparent"></div>
            </div>
        )
    }

    return (
        <div className="flex gap-6 h-[calc(100vh-250px)]">
            <div className="w-1/2 bg-white rounded-xl border border-gray-200 flex flex-col">
                <div className="p-4 border-b border-gray-200">
                    <div className="flex gap-3">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search contacts..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                            />
                        </div>
                        <select
                            value={filterStage}
                            onChange={(e) => setFilterStage(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                        >
                            <option value="all">All Stages</option>
                            {PIPELINE_STAGES.map(s => (
                                <option key={s.id} value={s.id}>{s.label}</option>
                            ))}
                        </select>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">{filteredContacts.length} contacts</p>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {filteredContacts.length === 0 ? (
                        <div className="text-center py-12 text-gray-400">
                            <User className="h-12 w-12 mx-auto mb-3 opacity-50" />
                            <p>No contacts found</p>
                        </div>
                    ) : (
                        filteredContacts.map(contact => {
                            const latestCampaign = contact.campaigns[0]
                            const stageInfo = getStageInfo(latestCampaign?.pipeline_stage || latestCampaign?.stage || 'sent')
                            
                            return (
                                <div
                                    key={contact.id}
                                    onClick={() => setSelectedContact(contact)}
                                    className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                                        selectedContact?.id === contact.id ? 'bg-brand-50 border-l-4 border-l-brand-500' : ''
                                    }`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-gray-900 truncate">
                                                {contact.first_name} {contact.last_name}
                                            </p>
                                            <p className="text-sm text-gray-500 truncate">{contact.firm || 'No firm'}</p>
                                            <p className="text-xs text-gray-400 truncate">{contact.email}</p>
                                        </div>
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${stageInfo.color} ${stageInfo.textColor}`}>
                                            {stageInfo.label}
                                        </span>
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>
            </div>

            <div className="w-1/2 bg-white rounded-xl border border-gray-200 flex flex-col">
                {selectedContact ? (
                    <ContactDetailPanel contact={selectedContact} />
                ) : (
                    <div className="flex-1 flex items-center justify-center text-gray-400">
                        <div className="text-center">
                            <User className="h-16 w-16 mx-auto mb-4 opacity-50" />
                            <p className="text-lg font-medium">Select a contact</p>
                            <p className="text-sm">Click on a contact to view details</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

function ContactDetailPanel({ contact }: { contact: ContactDetail }) {
    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-brand-50 to-white">
                <div className="flex items-start justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">
                            {contact.first_name} {contact.last_name}
                        </h2>
                        <p className="text-brand-600 font-medium">{contact.firm || 'No firm'}</p>
                        {contact.role && <p className="text-sm text-gray-500">{contact.role}</p>}
                    </div>
                    <Link
                        href={`/contacts/${contact.id}`}
                        className="text-brand-600 hover:text-brand-700 text-sm font-medium flex items-center gap-1"
                    >
                        View Full Profile
                        <ExternalLink className="h-4 w-4" />
                    </Link>
                </div>
            </div>

            <div className="p-6 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Contact Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2 text-gray-600">
                        <Mail className="h-4 w-4 text-gray-400" />
                        <span className="truncate">{contact.email}</span>
                    </div>
                    {contact.geography && (
                        <div className="flex items-center gap-2 text-gray-600">
                            <Globe className="h-4 w-4 text-gray-400" />
                            <span>{contact.geography}</span>
                        </div>
                    )}
                    {contact.investment_focus && (
                        <div className="col-span-2 flex items-start gap-2 text-gray-600">
                            <Building2 className="h-4 w-4 text-gray-400 mt-0.5" />
                            <span>{contact.investment_focus}</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Email History</h3>
                <div className="space-y-4">
                    {contact.campaigns.map((campaign, i) => (
                        <div key={i} className="border border-gray-200 rounded-lg overflow-hidden">
                            <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                                <p className="font-medium text-sm text-gray-900">{campaign.campaign_name}</p>
                                <p className="text-xs text-gray-500">
                                    Stage: <span className={`font-medium ${getStageInfo(campaign.pipeline_stage || campaign.stage).textColor}`}>
                                        {getStageInfo(campaign.pipeline_stage || campaign.stage).label}
                                    </span>
                                </p>
                            </div>
                            <div className="divide-y divide-gray-100">
                                {campaign.emails.map((email, j) => (
                                    <div key={j} className="p-4">
                                        <p className="font-medium text-sm text-gray-900 mb-2">{email.subject}</p>
                                        <div className="flex flex-wrap gap-2">
                                            {email.sent_at && (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded">
                                                    <Send className="h-3 w-3" />
                                                    Sent {new Date(email.sent_at).toLocaleDateString()}
                                                </span>
                                            )}
                                            {email.opened_at && (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-700 text-xs rounded">
                                                    <Eye className="h-3 w-3" />
                                                    Opened {new Date(email.opened_at).toLocaleDateString()}
                                                </span>
                                            )}
                                            {email.replied_at && (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 text-xs rounded">
                                                    <MessageSquare className="h-3 w-3" />
                                                    Replied {new Date(email.replied_at).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {campaign.emails.length === 0 && (
                                    <p className="p-4 text-sm text-gray-400">No emails sent yet</p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {contact.notes_private && (
                <div className="p-6 border-t border-gray-200 bg-yellow-50">
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">Private Notes</h3>
                    <p className="text-sm text-gray-600">{contact.notes_private}</p>
                </div>
            )}
        </div>
    )
}

// ============================================
// MAIN PAGE COMPONENT
// ============================================

export default function AnalyticsPage() {
    const [activeTab, setActiveTab] = useState<TabId>('overview')
    const [data, setData] = useState<AnalyticsData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [days, setDays] = useState(30)
    const [syncing, setSyncing] = useState(false)
    const [syncMessage, setSyncMessage] = useState<string | null>(null)
    const [pipeline, setPipeline] = useState<Record<string, PipelineItem[]>>({})
    const [pipelineLoading, setPipelineLoading] = useState(false)

    async function syncReplies() {
        setSyncing(true)
        setSyncMessage(null)
        try {
            const res = await fetch('/api/sync-replies', { method: 'POST' })
            const json = await res.json()
            if (json.success) {
                setSyncMessage('OK: ' + json.message)
                fetchAnalytics()
                fetchPipeline()
            } else {
                setSyncMessage('Error: ' + json.error)
            }
        } catch (err: any) {
            setSyncMessage('Error: ' + err.message)
        } finally {
            setSyncing(false)
            setTimeout(() => setSyncMessage(null), 5000)
        }
    }

    async function fetchAnalytics() {
        try {
            const res = await fetch(`/api/analytics/dashboard?days=${days}`)
            const json = await res.json()
            if (json.success) {
                setData(json.data)
            } else {
                setError(json.error || 'Failed to load analytics')
            }
        } catch (err: any) {
            setError(err.message)
        }
    }

    async function fetchPipeline() {
        setPipelineLoading(true)
        try {
            const res = await fetch('/api/pipeline')
            const json = await res.json()
            if (json.success) {
                setPipeline(json.data)
            }
        } catch (err) {
            console.error('Failed to load pipeline:', err)
        } finally {
            setPipelineLoading(false)
        }
    }

    useEffect(() => {
        async function loadData() {
            setLoading(true)
            await Promise.all([fetchAnalytics(), fetchPipeline()])
            setLoading(false)
        }
        loadData()
    }, [days])

    async function handleStageChange(contactCampaignId: string, newStage: string) {
        try {
            const res = await fetch('/api/pipeline', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contactCampaignId, stage: newStage })
            })

            if (res.ok) {
                setPipeline(prev => {
                    const updated = { ...prev }
                    for (const [stage, items] of Object.entries(updated)) {
                        const idx = items.findIndex(i => i.id === contactCampaignId)
                        if (idx !== -1) {
                            const [item] = items.splice(idx, 1)
                            item.pipeline_stage = newStage
                            if (!updated[newStage]) updated[newStage] = []
                            updated[newStage].push(item)
                            break
                        }
                    }
                    return updated
                })
            }
        } catch (err) {
            console.error('Failed to update stage:', err)
        }
    }

    async function handleManualTrack(contactCampaignId: string, action: string) {
        try {
            const res = await fetch('/api/tracking/manual', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contact_campaign_id: contactCampaignId, action })
            })

            const json = await res.json()
            if (json.success) {
                const newStage = json.stage
                if (newStage) {
                    setPipeline(prev => {
                        const updated = { ...prev }
                        for (const [stage, items] of Object.entries(updated)) {
                            const idx = items.findIndex(i => i.id === contactCampaignId)
                            if (idx !== -1) {
                                const [item] = items.splice(idx, 1)
                                item.pipeline_stage = newStage
                                if (item.emails?.[0]) {
                                    if (action === 'opened') item.emails[0].opened_at = new Date().toISOString()
                                    if (action === 'replied') {
                                        item.emails[0].opened_at = new Date().toISOString()
                                        item.emails[0].replied_at = new Date().toISOString()
                                    }
                                    if (action === 'unmark_opened') item.emails[0].opened_at = null
                                }
                                if (!updated[newStage]) updated[newStage] = []
                                updated[newStage].push(item)
                                break
                            }
                        }
                        return updated
                    })
                }
                fetchAnalytics()
            }
        } catch (err) {
            console.error('Failed to update tracking:', err)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-brand-600 border-t-transparent mx-auto mb-4"></div>
                    <p className="text-gray-500">Loading analytics...</p>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                    <p className="text-gray-600 mb-4">{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700"
                    >
                        Retry
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link href="/" className="flex items-center gap-2">
                                <img src="/astant-logo.jpg" alt="Astant" className="h-8 w-8 rounded-lg object-cover" />
                                <span className="text-xl font-bold text-gray-900">Analytics</span>
                            </Link>
                        </div>
                        <nav className="flex items-center gap-4">
                            <Link href="/campaigns" className="text-gray-600 hover:text-gray-900 text-sm font-medium">
                                Campaigns
                            </Link>
                            <Link href="/contacts" className="text-gray-600 hover:text-gray-900 text-sm font-medium">
                                Contacts
                            </Link>
                        </nav>
                    </div>
                </div>

                <div className="max-w-7xl mx-auto px-4">
                    <div className="flex gap-1 border-b border-gray-200 -mb-px">
                        {TABS.map(tab => {
                            const Icon = tab.icon
                            const isActive = activeTab === tab.id
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                                        isActive
                                            ? 'border-brand-600 text-brand-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                                >
                                    <Icon className="h-4 w-4" />
                                    {tab.label}
                                </button>
                            )
                        })}
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-6">
                {activeTab === 'overview' && (
                    <OverviewTab 
                        data={data}
                        days={days}
                        setDays={setDays}
                        syncing={syncing}
                        syncReplies={syncReplies}
                        syncMessage={syncMessage}
                    />
                )}
                {activeTab === 'pipeline' && (
                    <PipelineTab 
                        pipeline={pipeline}
                        loading={pipelineLoading}
                        onStageChange={handleStageChange}
                        onManualTrack={handleManualTrack}
                    />
                )}
                {activeTab === 'contacts' && (
                    <ContactsTab />
                )}
            </main>
        </div>
    )
}
