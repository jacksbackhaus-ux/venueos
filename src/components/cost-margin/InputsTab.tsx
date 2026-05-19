import StartingCashCard from "./StartingCashCard";
import OverheadsTab from "./OverheadsTab";
import ChannelsSettings from "./ChannelsSettings";
import CashflowAdjustments from "./CashflowAdjustments";
import TaxSettingsCard from "./TaxSettingsCard";

export default function InputsTab({ siteId, orgId }: { siteId: string | null; orgId: string | null }) {
  return (
    <div className="space-y-4">
      <TaxSettingsCard siteId={siteId} orgId={orgId} />
      <StartingCashCard siteId={siteId} orgId={orgId} />
      <OverheadsTab siteId={siteId} orgId={orgId} />
      <ChannelsSettings siteId={siteId} orgId={orgId} />
      <CashflowAdjustments siteId={siteId} orgId={orgId} />
    </div>
  );
}
