/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Head, Html, Preview } from 'npm:@react-email/components@0.0.22'
import { BrandShell } from './_brand.tsx'

interface Props {
  siteName?: string
  siteUrl?: string
  recipient?: string
  confirmationUrl: string
}

export const SignupEmail = ({ confirmationUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Confirm your email to start your 14-day MiseOS HACCP trial.</Preview>
    <BrandShell
      heading="Confirm your email to start your free MiseOS trial"
      intro="Welcome to MiseOS — the simple way to replace paper, stay inspection-ready, and log everything from your phone."
      cta={{ label: 'Confirm email & start trial', href: confirmationUrl }}
      secondary="Your 14-day free trial of MiseOS HACCP begins as soon as you confirm. No charge during the trial. Cancel anytime."
      footnote="If you didn't create a MiseOS account, you can safely ignore this email."
    />
  </Html>
)

export default SignupEmail
