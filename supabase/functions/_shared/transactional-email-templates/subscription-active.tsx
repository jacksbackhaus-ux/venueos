/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Head, Html, Preview, Text } from 'npm:@react-email/components@0.0.22'
import { BrandShell, styles } from '../email-templates/_brand.tsx'

export interface SubscriptionActiveProps {
  first_name?: string | null
  organisation_name?: string | null
  sites?: number | null
  users?: number | null
  amount_summary?: string | null // e.g. "£6.99 / month"
  billing_url: string
}

export function SubscriptionActiveEmail({ first_name, organisation_name, sites, users, amount_summary, billing_url }: SubscriptionActiveProps) {
  const name = first_name?.trim() || 'there'
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Your MiseOS subscription is now active.</Preview>
      <BrandShell
        heading="Your MiseOS subscription is now active"
        intro={
          <>
            Hi {name}, thank you for backing MiseOS{organisation_name ? <> for <strong>{organisation_name}</strong></> : null}. Your subscription has started and every record you've created stays right where it is.
          </>
        }
        cta={{ label: 'Manage billing', href: billing_url }}
        body={
          <Text style={{ ...styles.pMuted, margin: '0 0 14px' }}>
            {sites != null ? <>Sites: <strong>{sites}</strong> · </> : null}
            {users != null ? <>Users: <strong>{users}</strong> · </> : null}
            {amount_summary ? <>Billed: <strong>{amount_summary}</strong></> : null}
          </Text>
        }
        secondary="Keep an eye on Inspection Pack and the dashboard — they're where your records turn into something an EHO can read in minutes."
        footnote="🌱 5% of every subscription supports certified carbon removal via Stripe Climate. Thanks for being part of it."
      />
    </Html>
  )
}

export default SubscriptionActiveEmail
