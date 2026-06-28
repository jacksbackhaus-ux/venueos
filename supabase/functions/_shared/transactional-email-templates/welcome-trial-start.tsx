/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Head, Html, Preview, Text } from 'npm:@react-email/components@0.0.22'
import { BrandShell, styles } from '../email-templates/_brand.tsx'

export interface WelcomeTrialStartProps {
  first_name?: string | null
  organisation_name?: string | null
  app_url: string
}

const stepStyle: React.CSSProperties = {
  ...styles.p,
  margin: '0 0 8px',
  paddingLeft: '8px',
}

export function WelcomeTrialStartEmail({ first_name, organisation_name, app_url }: WelcomeTrialStartProps) {
  const name = first_name?.trim() || 'there'
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Your 14-day MiseOS HACCP trial has started.</Preview>
      <BrandShell
        heading="Welcome to MiseOS"
        intro={
          <>
            Hi {name}, your 14-day free trial of MiseOS HACCP
            {organisation_name ? <> for <strong>{organisation_name}</strong></> : null} has started. Everything you need to run a paperless, inspection-ready kitchen is now in your pocket.
          </>
        }
        cta={{ label: 'Open MiseOS', href: app_url }}
        body={
          <>
            <Text style={{ ...styles.p, fontWeight: 600, margin: '4px 0 10px' }}>Three quick wins to get the most from your trial:</Text>
            <Text style={stepStyle}>1. Add your sites and fridges/freezers.</Text>
            <Text style={stepStyle}>2. Set up your team — owners, managers and staff.</Text>
            <Text style={stepStyle}>3. Start logging temperatures, cleaning and your day sheet.</Text>
          </>
        }
        secondary="Cancel anytime during the trial. After 14 days your subscription starts automatically at £4.99 per site / month + £1 per extra user."
      />
    </Html>
  )
}

export default WelcomeTrialStartEmail
