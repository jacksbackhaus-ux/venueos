/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Head, Html, Preview } from 'npm:@react-email/components@0.0.22'
import { BrandShell } from './_brand.tsx'

interface Props {
  siteName?: string
  confirmationUrl: string
}

export const RecoveryEmail = ({ confirmationUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Reset your MiseOS password.</Preview>
    <BrandShell
      heading="Reset your MiseOS password"
      intro="We received a request to reset the password on your MiseOS account. Use the button below to set a new one."
      cta={{ label: 'Reset password', href: confirmationUrl }}
      secondary="This link expires in 60 minutes. You'll need to choose a new password — your existing one stays active until you do."
      footnote="If you didn't ask to reset your password, you can ignore this email and your password will stay the same."
    />
  </Html>
)

export default RecoveryEmail
