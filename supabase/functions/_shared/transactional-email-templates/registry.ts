// Registry of transactional email templates.
// Each entry maps a template name to its React component, resolved subject,
// and an optional fixed recipient address.

import * as React from 'npm:react@18.3.1'
import { FeedbackInternalNotificationEmail } from './feedback-internal-notification.tsx'

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
}
