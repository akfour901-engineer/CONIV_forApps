
import FinancialSummaryLoadingSkeleton from '@/app/dashboard/financial-summary/loading';

// Re-using the financial summary loading skeleton as it's a good fit for a loading state for a report page.
export default function WorkOrderProfitabilityLoading() {
  return <FinancialSummaryLoadingSkeleton />;
}
