// Registry of transactional email templates.
// Each entry maps a template name to its React component, resolved subject,
// and an optional fixed recipient address.

import * as React from 'npm:react@18.3.1'
import { FeedbackInternalNotificationEmail } from './feedback-internal-notification.tsx'
import { WelcomeTrialStartEmail } from './welcome-trial-start.tsx'
import { TrialReminderEmail } from './trial-reminder.tsx'
import { SubscriptionActiveEmail } from './subscription-active.tsx'
import { PaymentFailedEmail } from './payment-failed.tsx'
import { SubscriptionCanceledEmail } from './subscription-canceled.tsx'
import { InspectionPackReadyEmail } from './inspection-pack-ready.tsx'
import { StaffInvitedEmail } from './staff-invited.tsx'
import { StaffDeactivatedEmail } from './staff-deactivated.tsx'
import { ComplianceReminderEmail } from './compliance-reminder.tsx'

export interface TemplateDefinition {
  // Component must accept a record of template data props.
  component: React.ComponentType<any>
  // Subject line — either static or derived from template data.
  subject: string | ((data: Record<string, any>) => string)
  // Optional fixed recipient that overrides any caller-provided address.
  to?: string
  // Sample data used by the Lovable email dashboard to render previews.
  previewData?: Record<string, any>
}

// Shared sample values — kept consistent across previews so the dashboard
// reads like a single coherent demo organisation.
const APP_URL = 'https://mise-os.app/login/jack-s-backhaus-limited'
const BILLING_URL = 'https://mise-os.app/account'
const INSPECTION_PACK_URL = 'https://mise-os.app/example-inspection-pack.pdf'
const STAFF_INBOX_URL = 'https://mise-os.app/staff/feedback'

export const TEMPLATES: Record<string, TemplateDefinition> = {
  'feedback-internal-notification': {
    component: FeedbackInternalNotificationEmail,
    subject: (data) =>
      `[MiseOS Feedback] [${(data?.type || 'feedback').toUpperCase()}] — ${data?.title || 'New submission'}`,
    to: 'MiseOS@outlook.com',
    previewData: {
      type: 'Bug',
      title: 'Temperature log not saving',
      description: "Sometimes when I tap save it doesn't update the log.",
      organisation_name: "Jack's BackHaus Ltd",
      user_name: 'Jack',
      user_email: 'jack@example.com',
      page: '/temperatures',
      browser_info: 'Chrome on iPhone 15',
      screenshot_url: null,
      inbox_url: STAFF_INBOX_URL,
      feedback_id: 'fb_01HZJACK0001',
    },
  },
  'welcome-trial-start': {
    component: WelcomeTrialStartEmail,
    subject: 'Welcome to MiseOS — your trial has started',
    previewData: {
      first_name: 'Jack',
      organisation_name: "Jack's BackHaus Ltd",
      app_url: APP_URL,
    },
  },
  'trial-reminder': {
    component: TrialReminderEmail,
    subject: 'Your MiseOS HACCP trial ends in 3 days',
    previewData: {
      first_name: 'Jack',
      trial_end_date: 'Friday, 18th July 2026',
      billing_url: BILLING_URL,
    },
  },
  'subscription-active': {
    component: SubscriptionActiveEmail,
    subject: 'Your MiseOS subscription is now active',
    previewData: {
      first_name: 'Jack',
      organisation_name: "Jack's BackHaus Ltd",
      sites: 1,
      users: 2,
      amount_summary: '£5.99 / month',
      billing_url: BILLING_URL,
    },
  },
  'payment-failed': {
    component: PaymentFailedEmail,
    subject: 'Action needed — your MiseOS payment failed',
    previewData: {
      first_name: 'Jack',
      organisation_name: "Jack's BackHaus Ltd",
      billing_url: BILLING_URL,
    },
  },
  'subscription-canceled': {
    component: SubscriptionCanceledEmail,
    subject: 'Your MiseOS subscription has been cancelled',
    previewData: {
      first_name: 'Jack',
      organisation_name: "Jack's BackHaus Ltd",
      ends_on: 'Friday, 4th August 2026',
      reactivate_url: BILLING_URL,
    },
  },
  'inspection-pack-ready': {
    component: InspectionPackReadyEmail,
    subject: 'Your MiseOS Inspection Pack is ready',
    previewData: {
      first_name: 'Jack',
      site_name: "Bishop's Waltham Bakery",
      period_label: 'June 2026',
      download_url: INSPECTION_PACK_URL,
    },
  },
  'staff-invited': {
    component: StaffInvitedEmail,
    subject: (data) =>
      `You've been invited to ${data?.organisation_name || 'your team'} on MiseOS`,
    previewData: {
      first_name: 'Sarah',
      organisation_name: "Jack's BackHaus Ltd",
      inviter_name: 'Jack',
      accept_url: APP_URL,
    },
  },
  'staff-deactivated': {
    component: StaffDeactivatedEmail,
    subject: 'Your MiseOS account has been deactivated',
    previewData: {
      first_name: 'Sarah',
      organisation_name: "Jack's BackHaus Ltd",
    },
  },
  'compliance-reminder': {
    component: ComplianceReminderEmail,
    subject: 'Quick check — anything outstanding today?',
    previewData: {
      first_name: 'Jack',
      site_name: "Bishop's Waltham Bakery",
      outstanding_count: 3,
      items: [
        'PM fridge temps not logged',
        'Closing checks not completed',
        'Cleaning task overdue — Front of house mop',
      ],
      app_url: 'https://mise-os.app/dashboard',
    },
  },
}
