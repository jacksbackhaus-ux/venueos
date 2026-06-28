/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body,
  Button,
  Container,
  Heading,
  Hr,
  Link,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

// MiseOS brand tokens for emails. Pure inline styles, no @import.
export const BRAND = {
  primary: '#2563eb',
  primaryHover: '#1d4ed8',
  primaryForeground: '#ffffff',
  text: '#0f172a',
  muted: '#475569',
  subtle: '#94a3b8',
  border: '#e5e7eb',
  bg: '#ffffff',
  pageBg: '#f6f7fb',
  radius: '10px',
  fontStack:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, 'Helvetica Neue', Arial, sans-serif",
}

export const styles = {
  page: {
    backgroundColor: BRAND.bg,
    fontFamily: BRAND.fontStack,
    margin: 0,
    padding: '24px 0',
  } as React.CSSProperties,
  container: {
    backgroundColor: '#ffffff',
    maxWidth: '560px',
    margin: '0 auto',
    borderRadius: '14px',
    padding: '32px 36px',
    border: `1px solid ${BRAND.border}`,
  } as React.CSSProperties,
  brandRow: {
    textAlign: 'left' as const,
    marginBottom: '24px',
  } as React.CSSProperties,
  brandMark: {
    fontSize: '18px',
    fontWeight: 700,
    letterSpacing: '-0.01em',
    color: BRAND.text,
    margin: 0,
  } as React.CSSProperties,
  h1: {
    fontSize: '22px',
    fontWeight: 700,
    color: BRAND.text,
    margin: '0 0 12px',
    lineHeight: '1.3',
  } as React.CSSProperties,
  p: {
    fontSize: '15px',
    color: BRAND.text,
    lineHeight: '1.6',
    margin: '0 0 16px',
  } as React.CSSProperties,
  pMuted: {
    fontSize: '13px',
    color: BRAND.muted,
    lineHeight: '1.6',
    margin: '0 0 16px',
  } as React.CSSProperties,
  button: {
    backgroundColor: BRAND.primary,
    color: BRAND.primaryForeground,
    fontSize: '15px',
    fontWeight: 600,
    borderRadius: BRAND.radius,
    padding: '12px 22px',
    textDecoration: 'none',
    display: 'inline-block',
  } as React.CSSProperties,
  hr: {
    borderColor: BRAND.border,
    margin: '28px 0 18px',
  } as React.CSSProperties,
  footer: {
    fontSize: '12px',
    color: BRAND.subtle,
    lineHeight: '1.6',
    margin: '0 0 6px',
  } as React.CSSProperties,
  footerTagline: {
    fontSize: '12px',
    color: BRAND.muted,
    fontStyle: 'italic' as const,
    margin: '0 0 10px',
  } as React.CSSProperties,
  link: {
    color: BRAND.primary,
    textDecoration: 'underline',
  } as React.CSSProperties,
  smallNote: {
    fontSize: '12px',
    color: BRAND.subtle,
    lineHeight: '1.55',
    margin: '20px 0 0',
  } as React.CSSProperties,
}

export interface ShellProps {
  preview?: string
  heading: string
  intro?: React.ReactNode
  cta?: { label: string; href: string } | null
  body?: React.ReactNode
  secondary?: React.ReactNode
  /** When true, includes an unsubscribe note (marketing-style). Transactional emails omit it. */
  showUnsubscribe?: boolean
  footnote?: React.ReactNode
}

export function BrandShell({
  heading,
  intro,
  cta,
  body,
  secondary,
  showUnsubscribe = false,
  footnote,
}: ShellProps) {
  return (
    <Body style={styles.page}>
      <Container style={styles.container}>
        <Section style={styles.brandRow}>
          <Text style={styles.brandMark}>MiseOS</Text>
        </Section>

        <Heading as="h1" style={styles.h1}>
          {heading}
        </Heading>

        {intro ? <Text style={styles.p}>{intro}</Text> : null}

        {cta ? (
          <Section style={{ margin: '8px 0 24px' }}>
            <Button style={styles.button} href={cta.href}>
              {cta.label}
            </Button>
          </Section>
        ) : null}

        {body}

        {secondary ? <Text style={styles.pMuted}>{secondary}</Text> : null}

        {footnote ? <Text style={styles.smallNote}>{footnote}</Text> : null}

        <Hr style={styles.hr} />

        <Text style={styles.footerTagline}>
          Built for the people who make the food.
        </Text>
        <Text style={styles.footer}>
          MiseOS — Digital HACCP &amp; food safety for UK food businesses.
        </Text>
        <Text style={styles.footer}>
          Questions? Email{' '}
          <Link href="mailto:hello@mise-os.app" style={styles.link}>
            hello@mise-os.app
          </Link>
          .
        </Text>
        <Text style={styles.footer}>
          🌱 5% of every MiseOS subscription supports certified carbon removal via Stripe Climate.
        </Text>
        {showUnsubscribe ? (
          <Text style={styles.footer}>
            Don&apos;t want these updates? You can unsubscribe at any time from the link in your account settings.
          </Text>
        ) : null}
      </Container>
    </Body>
  )
}

export { Body, Container, Heading, Hr, Link, Section, Text, Button }
