/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Head, Html, Preview } from 'npm:@react-email/components@0.0.22'
import { BrandShell } from '../email-templates/_brand.tsx'

export interface InspectionPackReadyProps {
  first_name?: string | null
  site_name?: string | null
  period_label?: string | null
  download_url: string
}

export function InspectionPackReadyEmail({ first_name, site_name, period_label, download_url }: InspectionPackReadyProps) {
  const name = first_name?.trim() || 'there'
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Your MiseOS Inspection Pack is ready.</Preview>
      <BrandShell
        heading="Your Inspection Pack is ready"
        intro={
          <>
            Hi {name}, your latest Inspection Pack{site_name ? <> for <strong>{site_name}</strong></> : null}{period_label ? <> ({period_label})</> : null} has finished generating.
          </>
        }
        cta={{ label: 'Download Inspection Pack', href: download_url }}
        secondary="Save a copy in your records — this pack covers fridge temperatures, cleaning, day sheets, allergens and more. It's everything an EHO is likely to ask to see."
        footnote="The download link works for 7 days. You can re-generate the pack any time from MiseOS."
      />
    </Html>
  )
}

export default InspectionPackReadyEmail
