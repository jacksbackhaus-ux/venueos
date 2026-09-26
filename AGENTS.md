# Project Architecture Rules

- Keep the three-year fitness-to-work anonymisation as a service-only database function with a separate dry-run function; do not schedule or invoke it until the owner explicitly approves the dry run.