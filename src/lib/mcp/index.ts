import { auth, defineMcp } from "@lovable.dev/mcp-js";

// Sites and temperatures
import listSites from "./tools/list-sites";
import listTemperatureUnits from "./tools/list-temperature-units";
import listTemperatureLogs from "./tools/list-temperature-logs";
import logTemperature from "./tools/log-temperature";
import logProbeCalibration from "./tools/log-probe-calibration";

// Daily records
import listCleaningTasks from "./tools/list-cleaning-tasks";
import completeCleaningTask from "./tools/complete-cleaning-task";
import getDaySheet from "./tools/get-day-sheet";
import completeDaySheetItems from "./tools/complete-day-sheet-items";
import startProductionDay from "./tools/start-production-day";
import finishProductionDay from "./tools/finish-production-day";

// Incidents
import listIncidents from "./tools/list-incidents";
import createIncident from "./tools/create-incident";
import updateIncident from "./tools/update-incident";

// Batches and traceability
import listBatches from "./tools/list-batches";
import createBatch from "./tools/create-batch";
import updateBatch from "./tools/update-batch";
import markBatchUsed from "./tools/mark-batch-used";
import disposeBatch from "./tools/dispose-batch";
import extendBatchUseBy from "./tools/extend-batch-use-by";

// Suppliers and deliveries
import listSuppliers from "./tools/list-suppliers";
import upsertSupplier from "./tools/upsert-supplier";
import recordDelivery from "./tools/record-delivery";

// Compliance
import completePeriodicReview from "./tools/complete-periodic-review";
import listStaff from "./tools/list-staff";
import addTrainingRecord from "./tools/add-training-record";
import recordFitnessToWork from "./tools/record-fitness-to-work";

// Reporting
import listOutstandingActions from "./tools/list-outstanding-actions";
import getComplianceSummary from "./tools/get-compliance-summary";
import summariseIncidents from "./tools/summarise-incidents";
import listRecentRecords from "./tools/list-recent-records";
import generateInspectionPack from "./tools/generate-inspection-pack";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "miseos",
  title: "MiseOS",
  version: "0.2.0",
  instructions: [
    "Food safety and HACCP tools for MiseOS, a UK food safety app.",
    "Start with `list_sites` to get a site id, then read or record checks for that site.",
    "All tools act as the signed-in MiseOS user and respect their site access: staff can record daily checks, managers and owners can also record compliance and generate the Inspection Pack, and read-only accounts cannot write at all.",
    "Compliance is measured differently by site. On a `scheduled` site every calendar day counts unless it is a declared closed day. On an `on_demand` site (home kitchens, market traders, bake-to-order units) only declared PRODUCTION DAYS count — use `start_production_day` before recording that day's work, and never tell the user something is overdue on a day with no production day.",
    "Nothing is ever deleted. Disposing of a batch, extending a use-by date and closing an incident all stay on the permanent record, so confirm with the user before doing any of them.",
  ].join(" "),
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    // Sites and temperatures
    listSites,
    listTemperatureUnits,
    listTemperatureLogs,
    logTemperature,
    logProbeCalibration,
    // Daily records
    listCleaningTasks,
    completeCleaningTask,
    getDaySheet,
    completeDaySheetItems,
    startProductionDay,
    finishProductionDay,
    // Incidents
    listIncidents,
    createIncident,
    updateIncident,
    // Batches and traceability
    listBatches,
    createBatch,
    updateBatch,
    markBatchUsed,
    disposeBatch,
    extendBatchUseBy,
    // Suppliers and deliveries
    listSuppliers,
    upsertSupplier,
    recordDelivery,
    // Compliance
    completePeriodicReview,
    listStaff,
    addTrainingRecord,
    recordFitnessToWork,
    // Reporting
    listOutstandingActions,
    getComplianceSummary,
    summariseIncidents,
    listRecentRecords,
    generateInspectionPack,
  ],
});
