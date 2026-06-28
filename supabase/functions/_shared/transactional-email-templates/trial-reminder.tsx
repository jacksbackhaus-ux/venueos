/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Head, Html, Preview } from 'npm:@react-email/components@0.0.22'
import { BrandShell } from '../email-templates/_brand.tsx'

export interface TrialReminderProps {
  first_name?: string | null
  trial_end_date: string // ISO or already formatted
  billing_url: string
}

export function TrialReminderEmail({ first_name, trial_end_date, billing_url }: TrialReminderProps) {
  const name = first_name?.trim() || 'there'
  let formatted = trial_end_date
  try {
    formatted = new Date(trial_end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    /* keep raw */
  }
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Your MiseOS HACCP trial ends in 3 days.</Preview>
      <BrandShell
        heading="Your MiseOS trial ends in 3 days"
        intro={
          <>
            Hi {name}, just a heads-up — your free MiseOS HACCP trial ends on <strong>{formatted}</strong>. After that your subscription will start automatically so you keep every fridge log, cleaning record and day sheet you've built up.
          </>
        }
        cta={{ label: 'View billing', href: billing_url }}
        secondary="No surprises: you'll be charged £4.99 per site / month + £1 per extra user. Cancel any time before the trial ends and you won't be billed."
        footnote="Need a hand? Reply to this email or write to hello@mise-os.app — a real person will get back to you."
      />
    </Html>
  )
}

export default TrialReminderEmail
