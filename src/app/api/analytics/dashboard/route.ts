import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ============================================
// ANALYTICS DASHBOARD API
// Returns summary metrics for dashboard display
// ============================================

export async function GET(request: NextRequest) {
    console.log('[ANALYTICS] Fetching dashboard metrics')

    try {
        const supabase = createClient()
        const { searchParams } = new URL(request.url)

        // Optional filters
        const campaignId = searchParams.get('campaign_id')
        const days = parseInt(searchParams.get('days') || '30')

        const startDate = new Date()
        startDate.setDate(startDate.getDate() - days)
        const startDateStr = startDate.toISOString().split('T')[0]

        // Get overall summary
        const { data: summary, error: summaryError } = await supabase
            .from('campaign_analytics')
            .select('*')

        if (summaryError) {
            console.error('[ANALYTICS] Summary error:', summaryError)
        }

        // Aggregate totals
        const totals = {
            total_campaigns: summary?.length || 0,
            total_contacts: summary?.reduce((sum, c) => sum + (c.total_contacts || 0), 0) || 0,
            total_emails_sent: summary?.reduce((sum, c) => sum + (c.sent_emails || 0), 0) || 0,
            total_opens: summary?.reduce((sum, c) => sum + (c.opened_emails || 0), 0) || 0,
            total_clicks: summary?.reduce((sum, c) => sum + (c.clicked_emails || 0), 0) || 0,
            total_replies: summary?.reduce((sum, c) => sum + (c.replied_contacts || 0), 0) || 0,
            total_bounces: summary?.reduce((sum, c) => sum + (c.bounced_emails || 0), 0) || 0,
        }

        // Calculate rates
        const rates = {
            open_rate: totals.total_emails_sent > 0
                ? Math.round((totals.total_opens / totals.total_emails_sent) * 1000) / 10
                : 0,
            click_rate: totals.total_emails_sent > 0
                ? Math.round((totals.total_clicks / totals.total_emails_sent) * 1000) / 10
                : 0,
            reply_rate: totals.total_emails_sent > 0
                ? Math.round((totals.total_replies / totals.total_emails_sent) * 1000) / 10
                : 0,
            bounce_rate: totals.total_emails_sent > 0
                ? Math.round((totals.total_bounces / totals.total_emails_sent) * 1000) / 10
                : 0,
        }

        // Get daily trends
        let dailyQuery = supabase
            .from('analytics_daily')
            .select('*')
            .gte('date', startDateStr)
            .order('date', { ascending: true })

        if (campaignId) {
            dailyQuery = dailyQuery.eq('campaign_id', campaignId)
        }

        const { data: dailyData, error: dailyError } = await dailyQuery

        if (dailyError) {
            console.error('[ANALYTICS] Daily data error:', dailyError)
        }

        // Aggregate daily data by date
        const dailyTrends: Record<string, any> = {}
        dailyData?.forEach(row => {
            if (!dailyTrends[row.date]) {
                dailyTrends[row.date] = {
                    date: row.date,
                    sent: 0,
                    delivered: 0,
                    opened: 0,
                    clicked: 0,
                    replied: 0,
                    bounced: 0
                }
            }
            dailyTrends[row.date].sent += row.emails_sent || 0
            dailyTrends[row.date].delivered += row.emails_delivered || 0
            dailyTrends[row.date].opened += row.emails_opened || 0
            dailyTrends[row.date].clicked += row.emails_clicked || 0
            dailyTrends[row.date].replied += row.emails_replied || 0
            dailyTrends[row.date].bounced += row.emails_bounced || 0
        })

        // Get top performing campaigns
        const topCampaigns = summary
            ?.filter(c => c.sent_emails > 0)
            .sort((a, b) => b.open_rate - a.open_rate)
            .slice(0, 5)
            .map(c => ({
                id: c.id,
                name: c.name,
                sent: c.sent_emails,
                open_rate: c.open_rate,
                click_rate: c.click_rate,
                reply_rate: c.reply_rate
            })) || []

        // Get hot contacts
        const { data: hotContacts } = await supabase
            .from('contact_engagement')
            .select(`
        engagement_score,
        tier,
        total_opens,
        total_clicks,
        total_replies,
        last_open_at,
        contact:contacts (
          id,
          first_name,
          last_name,
          email,
          firm
        )
      `)
            .order('engagement_score', { ascending: false })
            .limit(10)

        // Recent activity
        const { data: recentActivity } = await supabase
            .from('engagement_events')
            .select(`
        id,
        event_type,
        timestamp,
        email:emails (
          subject,
          contact_campaign:contact_campaigns (
            contact:contacts (
              first_name,
              last_name,
              firm
            )
          )
        )
      `)
            .order('timestamp', { ascending: false })
            .limit(20)

        return NextResponse.json({
            success: true,
            data: {
                totals,
                rates,
                daily_trends: Object.values(dailyTrends),
                top_campaigns: topCampaigns,
                hot_contacts: hotContacts || [],
                recent_activity: recentActivity || [],
                period: {
                    days,
                    start_date: startDateStr,
                    end_date: new Date().toISOString().split('T')[0]
                }
            }
        })

    } catch (error: any) {
        console.error('[ANALYTICS] Error:', error)
        return NextResponse.json(
            { success: false, error: error.message || 'Failed to fetch analytics' },
            { status: 500 }
        )
    }
}
