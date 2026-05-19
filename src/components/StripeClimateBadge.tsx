/**
 * Stripe Climate badge — renders the official iframe.
 * MiseOS contributes 5% of every subscription to certified carbon removal
 * via Stripe Climate.
 */
export function StripeClimateBadge({ className }: { className?: string }) {
  return (
    <div className={className}>
      <iframe
        title="Stripe Climate — Member"
        src="https://climate.stripe.com/badge/Zd5W2t?theme=light&size=small&locale=en-GB"
        width={380}
        height={38}
        style={{ border: 0, maxWidth: "100%" }}
        loading="lazy"
      />
    </div>
  );
}

export function ClimatePledge({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center gap-2 text-center ${className}`}>
      <p className="text-sm text-muted-foreground">
        🌱 5% of every subscription goes towards carbon removal via Stripe Climate.
      </p>
      <StripeClimateBadge />
    </div>
  );
}
