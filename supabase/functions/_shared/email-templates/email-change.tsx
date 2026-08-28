/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Head, Html, Preview } from 'npm:@react-email/components@0.0.22'
import { BrandShell } from './_brand.tsx'

interface Props {
  siteName?: string
  oldEmail?: string
  newEmail?: string
  email?: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({ newEmail, email, confirmationUrl }: Props) => {
  const to = newEmail || email
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Confirm your new MiseOS email address.</Preview>
      <BrandShell
        heading="Confirm your new MiseOS email"
        intro={
          to
            ? `Please confirm that ${to} is the new email address for your MiseOS account.`
            : 'Please confirm the new email address for your MiseOS account.'
        }
        cta={{ label: 'Confirm new email', href: confirmationUrl }}
        secondary="Your account email won't change until you confirm."
        footnote={
          <>
            Didn't request this change? Email{' '}
            <a href="mailto:hello@mise-os.app" style={{ color: '#2563eb' }}>
              hello@mise-os.app
            </a>{' '}
            straight away so we can secure your account.
          </>
        }
      />
    </Html>
  )
}

export default EmailChangeEmail
