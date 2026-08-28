// Server-only wrapper around the managed send helper that also keeps the
// project's own email_send_log audit rows up to date (the app's Cloud → Emails
// history is Lovable-side; this log powers in-app/staff views).
import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  sendTemplateEmail,
  type SendTemplateEmailOptions,
  type SendTemplateEmailResult,
} from './transactional-email-templates/send-email.ts'
import { TEMPLATES } from './transactional-email-templates/registry.ts'

function serviceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
}

async function log(
  row: {
    recipient_email: string
    template_name: string
    status: 'sent' | 'suppressed' | 'failed'
    organisation_id?: string | null
    error_message?: string | null
  },
) {
  try {
    const { error } = await serviceClient().from('email_send_log').insert({
      recipient_email: row.recipient_email,
      template_name: row.template_name,
      status: row.status,
      organisation_id: row.organisation_id ?? null,
      error_message: row.error_message ?? null,
    })
    if (error) {
      console.error('[send-app-email] log insert failed', {
        code: error.code,
        message: error.message,
      })
    }
  } catch (e) {
    console.error('[send-app-email] log insert threw', e)
  }
}

export interface SendAppEmailOptions extends SendTemplateEmailOptions {
  organisationId?: string | null
}

/**
 * Sends a registered template through Lovable's managed email API and records
 * the outcome in email_send_log. Suppressed recipients resolve normally.
 */
export async function sendAppEmail(
  templateName: string,
  to: string,
  options: SendAppEmailOptions = {},
): Promise<SendTemplateEmailResult> {
  const { organisationId, ...sendOptions } = options
  const recipient = TEMPLATES[templateName]?.to || to

  try {
    const result = await sendTemplateEmail(templateName, to, sendOptions)
    await log({
      recipient_email: recipient,
      template_name: templateName,
      status: result.sent ? 'sent' : 'suppressed',
      organisation_id: organisationId,
      error_message: result.sent ? null : 'Recipient suppressed',
    })
    return result
  } catch (e) {
    await log({
      recipient_email: recipient,
      template_name: templateName,
      status: 'failed',
      organisation_id: organisationId,
      error_message: e instanceof Error ? e.message : String(e),
    })
    throw e
  }
}
