/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Head, Html, Preview, Text } from 'npm:@react-email/components@0.0.22'
import { BrandShell, styles, BRAND } from './_brand.tsx'

interface Props {
  token: string
}

export const ReauthenticationEmail = ({ token }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your MiseOS verification code.</Preview>
    <BrandShell
      heading="Your MiseOS verification code"
      intro="Use the code below to confirm it's really you. This code expires in 10 minutes."
      body={
        <Text
          style={{
            ...styles.p,
            fontSize: '32px',
            fontWeight: 700,
            letterSpacing: '0.18em',
            color: BRAND.primary,
            textAlign: 'center',
            margin: '8px 0 24px',
          }}
        >
          {token}
        </Text>
      }
      footnote="If you didn't request this code, you can safely ignore this email."
    />
  </Html>
)

export default ReauthenticationEmail
