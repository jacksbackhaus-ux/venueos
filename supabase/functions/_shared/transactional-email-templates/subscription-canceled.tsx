/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Head, Html, Preview } from 'npm:@react-email/components@0.0.22'
import { BrandShell } from '../email-templates/_brand.tsx'

export interface SubscriptionCanceledProps {
  first_name?: string | null
  organisation_name?: string | null
  ends_on?: string | null
  reactivate_url: string
}

export function SubscriptionCanceledEmail({ first_name, organisation_name, ends_on, reactivate_url }: SubscriptionCanceledProps) {
  const name = first_name?.trim() || 'there'
  let formatted = ends_on
  if (ends_on) {
    try {
      formatted = new Date(ends_on).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    } catch {
      /* keep raw */
    }
  }
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Your MiseOS subscription has been cancelled.</Preview>
      <BrandShell
        heading="Your MiseOS subscription has been cancelled"
        intro={
          <>
            Hi {name}, we've cancelled the MiseOS subscription{organisation_name ? <> for <strong>{organisation_name}</strong></> : null}. You'll keep full access until {formatted ? <strong>{formatted}</strong> : <>the end of your current billing period</>}.
          </>
        }
        cta={{ label: 'Reactivate any time', href: reactivate_url }}
        secondary="We hold on to your HACCP records for 7 years — the retention period an EHO expects. They're not deleted when you cancel, so if you come back, everything is still there."
        footnote="If there's something we could have done better, hit reply — we read every message."
      />
    </Html>
  )
}

export default SubscriptionCanceledEmail
