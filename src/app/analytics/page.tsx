'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
    BarChart3, TrendingUp, Mail, Users, MousePointer,
    MessageSquare, AlertTriangle, ArrowUp, ArrowDown,
    ChevronRight, Activity, Flame, Clock
} from 'lucide-react'

// Types
interface AnalyticsData {
    totals: {
        total_campaigns: number
        total_contacts: number
        total_emails_sent: number
        total_opens: number
        total_clicks: number
        total_replies: number
        total_bounces: number
    }
    rates: {
        open_rate: number
        click_rate: number
        reply_rate: number
        bounce_rate: number
    }
    daily_trends: Array<{
        date: string
        sent: number
        opened: number
        clicked: number
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

// Stat card component
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
    trend?: 'up' | 'down' | 'neutral'
    color?: 'brand' | 'green' | 'yellow' | 'red'
}) {
    const colorClasses = {
        brand: 'bg-brand-50 text-brand-600',
        green: 'bg-green-50 text-green-600',
        yellow: 'bg-yellow-50 text-yellow-600',
        red: 'bg-red-50 text-red-600'
    }

    return (
        <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
                    <Icon className="h-6 w-6" />
                </div>
                {trend && (
                    <div className={`flex items-center text-sm ${trend === 'up' ? 'text-green-600' :
                            trend === 'down' ? 'text-red-600' : 'text-gray-500'
                        }`}>
                        {trend === 'up' && <ArrowUp className="h-4 w-4 mr-1" />}
                        {trend === 'down' && <ArrowDown className="h-4 w-4 mr-1" />}
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

// Simple bar chart component
function SimpleBarChart({ data, height = 200 }: { data: any[], height?: number }) {
    if (!data || data.length === 0) {
        return (
            <div className="h-[200px] flex items-center justify-center text-gray-400">
                No data yet
            </div>
        )
    }

    const maxValue = Math.max(...data.map(d => d.sent || 0), 1)

    return (
        <div className="flex items-end gap-1 h-[200px] px-4">
            {data.slice(-14).map((day, i) => {
                const sentHeight = ((day.sent || 0) / maxValue) * 160
                const openedHeight = ((day.opened || 0) / maxValue) * 160

                return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full flex gap-0.5" style={{ height: 160 }}>
                            <div
                                className="flex-1 bg-brand-200 rounded-t transition-all"
                                style={{ height: sentHeight, marginTop: 160 - sentHeight }}
                                title={`Sent: ${day.sent || 0}`}
                            />
                            <div
                                className="flex-1 bg-green-400 rounded-t transition-all"
                                style={{ height: openedHeight, marginTop: 160 - openedHeight }}
                                title={`Opened: ${day.opened || 0}`}
                            />
                        </div>
                        <span className="text-xs text-gray-400">
                            {new Date(day.date).toLocaleDateString('en-US', { day: 'numeric' })}
                        </span>
                    </div>
                )
            })}
        </div>
    )
}

// Event type icon and color
function getEventDisplay(eventType: string) {
    switch (eventType) {
        case 'sent': return { icon: Mail, color: 'text-blue-500', label: 'Sent' }
        case 'delivered': return { icon: Mail, color: 'text-green-500', label: 'Delivered' }
        case 'opened': return { icon: Activity, color: 'text-purple-500', label: 'Opened' }
        case 'clicked': return { icon: MousePointer, color: 'text-orange-500', label: 'Clicked' }
        case 'replied': return { icon: MessageSquare, color: 'text-green-600', label: 'Replied' }
        case 'bounced': return { icon: AlertTriangle, color: 'text-red-500', label: 'Bounced' }
        default: return { icon: Activity, color: 'text-gray-500', label: eventType }
    }
}

export default function AnalyticsPage() {
    const [data, setData] = useState<AnalyticsData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [days, setDays] = useState(30)

    useEffect(() => {
        async function fetchAnalytics() {
            setLoading(true)
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
            } finally {
                setLoading(false)
            }
        }

        fetchAnalytics()
    }, [days])

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-brand-600 border-t-transparent"></div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                    <p className="text-gray-600">{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-4 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700"
                    >
                        Retry
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 py-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                                <BarChart3 className="h-7 w-7 mr-3 text-brand-600" />
                                Analytics Dashboard
                            </h1>
                            <p className="text-gray-500 mt-1">Track email performance and engagement</p>
                        </div>

                        {/* Time range selector */}
                        <div className="flex items-center gap-2">
                            {[7, 30, 90].map(d => (
                                <button
                                    key={d}
                                    onClick={() => setDays(d)}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${days === d
                                            ? 'bg-brand-600 text-white'
                                            : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                                        }`}
                                >
                                    {d}d
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-8">
                {/* Summary Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <StatCard
                        icon={Mail}
                        label="Emails Sent"
                        value={data?.totals.total_emails_sent || 0}
                        subValue={`${data?.totals.total_campaigns || 0} campaigns`}
                        color="brand"
                    />
                    <StatCard
                        icon={Activity}
                        label="Open Rate"
                        value={`${data?.rates.open_rate || 0}%`}
                        subValue={`${data?.totals.total_opens || 0} opens`}
                        color="green"
                    />
                    <StatCard
                        icon={MousePointer}
                        label="Click Rate"
                        value={`${data?.rates.click_rate || 0}%`}
                        subValue={`${data?.totals.total_clicks || 0} clicks`}
                        color="yellow"
                    />
                    <StatCard
                        icon={MessageSquare}
                        label="Reply Rate"
                        value={`${data?.rates.reply_rate || 0}%`}
                        subValue={`${data?.totals.total_replies || 0} replies`}
                        color="brand"
                    />
                </div>

                {/* Charts and Tables */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                    {/* Daily Trend Chart */}
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
                                <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                                    <div>
                                        <p className="font-medium text-gray-900">
                                            {hc.contact?.first_name} {hc.contact?.last_name}
                                        </p>
                                        <p className="text-xs text-gray-500">{hc.contact?.firm}</p>
                                    </div>
                                    <div className="text-right">
                                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${hc.tier === 'hot' ? 'bg-orange-100 text-orange-700' :
                                                hc.tier === 'warm' ? 'bg-yellow-100 text-yellow-700' :
                                                    hc.tier === 'cool' ? 'bg-blue-100 text-blue-700' :
                                                        'bg-gray-100 text-gray-700'
                                            }`}>
                                            {hc.engagement_score}
                                        </span>
                                    </div>
                                </div>
                            )) || (
                                    <p className="text-gray-400 text-sm py-4 text-center">No engagement data yet</p>
                                )}
                        </div>
                    </div>
                </div>

                {/* Top Campaigns & Recent Activity */}
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
                                    <tr className="text-left text-xs text-gray-500 uppercase">
                                        <th className="pb-3">Campaign</th>
                                        <th className="pb-3 text-right">Sent</th>
                                        <th className="pb-3 text-right">Open</th>
                                        <th className="pb-3 text-right">Reply</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data?.top_campaigns?.map((campaign, i) => (
                                        <tr key={i} className="border-t border-gray-100">
                                            <td className="py-3">
                                                <Link href={`/campaigns/${campaign.id}`} className="text-brand-600 hover:underline">
                                                    {campaign.name}
                                                </Link>
                                            </td>
                                            <td className="py-3 text-right text-gray-900">{campaign.sent}</td>
                                            <td className="py-3 text-right text-green-600">{campaign.open_rate}%</td>
                                            <td className="py-3 text-right text-brand-600">{campaign.reply_rate}%</td>
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
                        <div className="space-y-4">
                            {data?.recent_activity?.slice(0, 8).map((activity, i) => {
                                const event = getEventDisplay(activity.event_type)
                                const Icon = event.icon
                                const contact = activity.email?.contact_campaign?.contact

                                return (
                                    <div key={i} className="flex items-start gap-3">
                                        <div className={`p-2 rounded-full bg-gray-50 ${event.color}`}>
                                            <Icon className="h-4 w-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-gray-900 truncate">
                                                <span className="font-medium">{contact?.first_name} {contact?.last_name}</span>
                                                {' '}{event.label.toLowerCase()} email
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
            </main>
        </div>
    )
}
