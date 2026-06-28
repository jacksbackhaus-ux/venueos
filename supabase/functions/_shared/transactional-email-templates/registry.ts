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
}

export const TEMPLATES: Record<string, TemplateDefinition> = {
  'feedback-internal-notification': {
    component: FeedbackInternalNotificationEmail,
    subject: (data) =>
      `[MiseOS Feedback] [${(data?.type || 'feedback').toUpperCase()}] — ${data?.title || 'New submission'}`,
    to: 'MiseOS@outlook.com',
  },
  'welcome-trial-start': {
    component: WelcomeTrialStartEmail,
    subject: 'Welcome to MiseOS — your trial has started',
  },
  'trial-reminder': {
    component: TrialReminderEmail,
    subject: 'Your MiseOS HACCP trial ends in 3 days',
  },
  'subscription-active': {
    component: SubscriptionActiveEmail,
    subject: 'Your MiseOS subscription is now active',
  },
  'payment-failed': {
    component: PaymentFailedEmail,
    subject: 'Action needed — your MiseOS payment failed',
  },
  'subscription-canceled': {
    component: SubscriptionCanceledEmail,
    subject: 'Your MiseOS subscription has been cancelled',
  },
  'inspection-pack-ready': {
    component: InspectionPackReadyEmail,
    subject: 'Your MiseOS Inspection Pack is ready',
  },
  'staff-invited': {
    component: StaffInvitedEmail,
    subject: (data) =>
      `You've been invited to ${data?.organisation_name || 'your team'} on MiseOS`,
  },
  'staff-deactivated': {
    component: StaffDeactivatedEmail,
    subject: 'Your MiseOS account has been deactivated',
  },
  'compliance-reminder': {
    component: ComplianceReminderEmail,
    subject: 'Quick check — anything outstanding today?',
  },
}
