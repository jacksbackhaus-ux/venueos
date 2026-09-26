# Project Architecture Rules

- Keep the three-year fitness-to-work anonymisation as a service-only database function with a separate dry-run function; do not schedule or invoke it until the owner explicitly approves the dry run.- Extra sites are added only via the add-haccp-site function (quantity +1 on the existing subscription, pending_if_incomplete, site created only after Stripe confirms payment); never via a new checkout — prevents free sites and duplicate subscriptions.
- During an active move (transfer with a new site) the old site isn't billed (billableSiteCount); cancelling a move archives the new site — keeps the 14-day overlap free and prevents unbilled sites.
