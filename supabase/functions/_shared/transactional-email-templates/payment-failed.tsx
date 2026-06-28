/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Head, Html, Preview } from 'npm:@react-email/components@0.0.22'
import { BrandShell } from '../email-templates/_brand.tsx'

export interface PaymentFailedProps {
  first_name?: string | null
  organisation_name?: string | null
  billing_url: string
}

export function PaymentFailedEmail({ first_name, organisation_name, billing_url }: PaymentFailedProps) {
  const name = first_name?.trim() || 'there'
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Your MiseOS payment couldn't go through — please update your card.</Preview>
      <BrandShell
        heading="Action needed — your MiseOS payment didn't go through"
        intro={
          <>
            Hi {name}, we tried to charge the card on file for {organisation_name || 'your account'} and it didn't go through. It happens — usually the card has expired or the bank flagged it.
          </>
        }
        cta={{ label: 'Update payment method', href: billing_url }}
        secondary="Your data is safe. All your HACCP records, fridge temps and cleaning logs stay exactly as they are while you sort this out."
        footnote="We'll try the card again automatically. If you need a few extra days, reply to this email and we'll work something out."
      />
    </Html>
  )
}

export default PaymentFailedEmail
