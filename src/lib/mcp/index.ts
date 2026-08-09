import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listSites from "./tools/list-sites";
import listTemperatureUnits from "./tools/list-temperature-units";
import listTemperatureLogs from "./tools/list-temperature-logs";
import logTemperature from "./tools/log-temperature";
import listIncidents from "./tools/list-incidents";
import createIncident from "./tools/create-incident";
import listBatches from "./tools/list-batches";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "miseos",
  title: "MiseOS",
  version: "0.1.0",
  instructions:
    "Food safety and HACCP tools for MiseOS. Start with `list_sites` to get a site id, then read or record temperature checks, incidents and production batches for that site. All tools act as the signed-in MiseOS user and respect their site access.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listSites,
    listTemperatureUnits,
    listTemperatureLogs,
    logTemperature,
    listIncidents,
    createIncident,
    listBatches,
  ],
});
