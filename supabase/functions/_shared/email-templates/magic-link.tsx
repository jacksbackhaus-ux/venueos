/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Head, Html, Preview } from 'npm:@react-email/components@0.0.22'
import { BrandShell } from './_brand.tsx'

interface Props {
  siteName?: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({ confirmationUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your MiseOS sign-in link.</Preview>
    <BrandShell
      heading="Your MiseOS sign-in link"
      intro="Tap the button below to sign in. You won't need a password."
      cta={{ label: 'Sign in to MiseOS', href: confirmationUrl }}
      secondary="For your security this link expires in 5 minutes and can only be used once."
      footnote="If you didn't request this, you can safely ignore the email — no action is needed."
    />
  </Html>
)

export default MagicLinkEmail
