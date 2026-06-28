/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Head, Html, Preview } from 'npm:@react-email/components@0.0.22'
import { BrandShell } from '../email-templates/_brand.tsx'

export interface StaffDeactivatedProps {
  first_name?: string | null
  organisation_name?: string | null
}

export function StaffDeactivatedEmail({ first_name, organisation_name }: StaffDeactivatedProps) {
  const name = first_name?.trim() || 'there'
  const org = organisation_name || 'your team'
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Your MiseOS account has been deactivated.</Preview>
      <BrandShell
        heading="Your MiseOS account has been deactivated"
        intro={
          <>
            Hi {name}, your access to {org} on MiseOS has been deactivated by an owner. You won't be able to sign in until they reactivate your account.
          </>
        }
        secondary="Everything you logged — fridge temps, cleaning, day sheets, allergens, training — stays in the business's records for HACCP compliance. Nothing is deleted."
        footnote="If you think this is a mistake, please get in touch with the owner of your team. They can reactivate your account at any time."
      />
    </Html>
  )
}

export default StaffDeactivatedEmail
