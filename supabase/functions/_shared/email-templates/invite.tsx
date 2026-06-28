/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Head, Html, Preview } from 'npm:@react-email/components@0.0.22'
import { BrandShell } from './_brand.tsx'

interface Props {
  siteName?: string
  siteUrl?: string
  confirmationUrl: string
}

export const InviteEmail = ({ confirmationUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You've been invited to join your team on MiseOS.</Preview>
    <BrandShell
      heading="You've been invited to MiseOS"
      intro="Your team uses MiseOS to keep HACCP records, fridge temperatures, cleaning logs and day sheets all in one place — designed for UK food businesses."
      cta={{ label: 'Accept invite', href: confirmationUrl }}
      secondary="This invite link expires in 7 days. If it expires, ask your team owner to send a new one."
      footnote="Not expecting this invite? You can ignore the email."
    />
  </Html>
)

export default InviteEmail
