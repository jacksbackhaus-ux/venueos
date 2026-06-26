import * as React from 'npm:react@18.3.1'
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

export interface FeedbackInternalNotificationProps {
  type: string
  title: string
  description: string
  organisation_name?: string | null
  user_name?: string | null
  user_email?: string | null
  page?: string | null
  browser_info?: string | null
  screenshot_url?: string | null
  inbox_url: string
  feedback_id: string
  created_at: string
}

const wrap: React.CSSProperties = {
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif",
  backgroundColor: '#f6f7fb',
  padding: '24px 0',
}

const container: React.CSSProperties = {
  backgroundColor: '#ffffff',
  maxWidth: '560px',
  margin: '0 auto',
  borderRadius: '12px',
  padding: '28px 32px',
  border: '1px solid #e5e7eb',
}

const labelStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: '#6b7280',
  margin: '0 0 4px',
}

const valueStyle: React.CSSProperties = {
  fontSize: '14px',
  color: '#111827',
  margin: '0 0 14px',
  lineHeight: '1.5',
  whiteSpace: 'pre-wrap',
}

export function FeedbackInternalNotificationEmail({
  type,
  title,
  description,
  organisation_name,
  user_name,
  user_email,
  page,
  browser_info,
  screenshot_url,
  inbox_url,
  feedback_id,
  created_at,
}: FeedbackInternalNotificationProps) {
  const typeLabel =
    {
      feedback: 'Feedback',
      bug: 'Bug report',
      feature: 'Feature request',
      other: 'Other',
    }[type] || type

  return (
    <Html>
      <Head />
      <Preview>{`[${typeLabel}] ${title}`}</Preview>
      <Body style={wrap}>
        <Container style={container}>
          <Heading
            as="h2"
            style={{ fontSize: '18px', margin: '0 0 4px', color: '#111827' }}
          >
            New MiseOS feedback
          </Heading>
          <Text style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 20px' }}>
            {typeLabel} · {new Date(created_at).toLocaleString('en-GB')}
          </Text>

          <Section>
            <Text style={labelStyle}>Title</Text>
            <Text style={{ ...valueStyle, fontWeight: 600, fontSize: '15px' }}>{title}</Text>

            <Text style={labelStyle}>Description</Text>
            <Text style={valueStyle}>{description}</Text>

            <Hr style={{ borderColor: '#e5e7eb', margin: '8px 0 16px' }} />

            <Text style={labelStyle}>Organisation</Text>
            <Text style={valueStyle}>{organisation_name || '—'}</Text>

            <Text style={labelStyle}>Submitted by</Text>
            <Text style={valueStyle}>
              {user_name || 'Unknown user'}
              {user_email ? ` · ${user_email}` : ''}
            </Text>

            <Text style={labelStyle}>Page</Text>
            <Text style={valueStyle}>{page || '—'}</Text>

            <Text style={labelStyle}>Browser</Text>
            <Text style={{ ...valueStyle, fontSize: '12px', color: '#4b5563' }}>
              {browser_info || '—'}
            </Text>

            {screenshot_url ? (
              <>
                <Text style={labelStyle}>Screenshot</Text>
                <Text style={valueStyle}>
                  <Link href={screenshot_url} style={{ color: '#2563eb' }}>
                    View attachment
                  </Link>
                </Text>
              </>
            ) : null}
          </Section>

          <Hr style={{ borderColor: '#e5e7eb', margin: '16px 0' }} />

          <Section style={{ textAlign: 'center' }}>
            <Link
              href={inbox_url}
              style={{
                backgroundColor: '#111827',
                color: '#ffffff',
                padding: '10px 18px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              Open in Staff Console
            </Link>
            <Text style={{ fontSize: '11px', color: '#9ca3af', margin: '12px 0 0' }}>
              Feedback ID: {feedback_id}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default FeedbackInternalNotificationEmail
