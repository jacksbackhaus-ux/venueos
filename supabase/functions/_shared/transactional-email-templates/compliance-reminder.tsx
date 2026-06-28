/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Head, Html, Preview, Text } from 'npm:@react-email/components@0.0.22'
import { BrandShell, styles } from '../email-templates/_brand.tsx'

export interface ComplianceReminderProps {
  first_name?: string | null
  site_name?: string | null
  outstanding_count: number
  items: string[] // top 3 already trimmed by caller
  app_url: string
}

const itemStyle: React.CSSProperties = {
  ...styles.p,
  margin: '0 0 6px',
}

export function ComplianceReminderEmail({ first_name, site_name, outstanding_count, items, app_url }: ComplianceReminderProps) {
  const name = first_name?.trim() || 'there'
  const top = items.slice(0, 3)
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Quick check — {outstanding_count} thing{outstanding_count === 1 ? '' : 's'} outstanding today.</Preview>
      <BrandShell
        heading="Quick check — anything outstanding today?"
        intro={
          <>
            Hi {name}, a friendly reminder that {site_name ? <strong>{site_name}</strong> : 'your site'} has <strong>{outstanding_count}</strong> item{outstanding_count === 1 ? '' : 's'} outstanding today. Tackling them now keeps you inspection-ready.
          </>
        }
        body={
          top.length > 0 ? (
            <>
              <Text style={{ ...styles.p, fontWeight: 600, margin: '4px 0 10px' }}>Top of the list:</Text>
              {top.map((item, i) => (
                <Text key={i} style={itemStyle}>• {item}</Text>
              ))}
            </>
          ) : null
        }
        cta={{ label: 'Open MiseOS dashboard', href: app_url }}
        footnote="We only send this when there's something genuinely outstanding — never just to nag."
      />
    </Html>
  )
}

export default ComplianceReminderEmail
