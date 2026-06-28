/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Head, Html, Preview } from 'npm:@react-email/components@0.0.22'
import { BrandShell } from '../email-templates/_brand.tsx'

export interface StaffInvitedProps {
  first_name?: string | null
  organisation_name?: string | null
  inviter_name?: string | null
  accept_url: string
}

export function StaffInvitedEmail({ first_name, organisation_name, inviter_name, accept_url }: StaffInvitedProps) {
  const name = first_name?.trim() || 'there'
  const org = organisation_name || 'your team'
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>You've been invited to {org} on MiseOS.</Preview>
      <BrandShell
        heading={`You've been invited to ${org} on MiseOS`}
        intro={
          <>
            Hi {name}, {inviter_name ? <><strong>{inviter_name}</strong> has</> : 'your team has'} added you to {org} on MiseOS — the simple way to keep fridge temps, cleaning, day sheets and HACCP records in one place.
          </>
        }
        cta={{ label: 'Accept invite', href: accept_url }}
        secondary="This invite link expires in 7 days. If it expires, ask your team owner to send a new one."
        footnote="Not expecting this? You can safely ignore the email."
      />
    </Html>
  )
}

export default StaffInvitedEmail
