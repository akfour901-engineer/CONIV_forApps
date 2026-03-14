import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { getDb } from '@/lib/firebase-admin-init';
import type { Estimate, WorkOrder, Invoice, License, Company, UserProfile, AuditContractorActivitiesOutput, AppConfiguration } from '@/types/server-only';
import { AuditContractorActivitiesInputSchema, AuditAIModelOutputSchema, AuditContractorActivitiesOutputSchema } from '@/types/server-only';
import { logActivity } from '@/lib/activityLog';
import { formatDate, addDays, isBefore, parseISO } from '@/lib/utils';
import { AI_AUDIT_TOOL_BASE_COST } from '@/lib/constants';
import { MODEL_FALLBACK_LIST } from '@/ai/models';

export type { AuditContractorActivitiesInput, AuditContractorActivitiesOutput } from '@/types/server-only';

const auditContractorActivitiesFlow = ai.defineFlow(
  {
    name: 'auditContractorActivitiesFlow_api',
    inputSchema: AuditContractorActivitiesInputSchema,
    outputSchema: AuditContractorActivitiesOutputSchema,
  },
  async (input) => {
      const { 
        companyId, 
        industryBenchmarks, 
        economicData, 
        workOrderStatusFilter, 
        invoiceStatusFilter,
        estimateStatusFilter,
        sdFilter,
        licenseFilter,
        userId,
        actorUid,
        actorName,
      } = input;
      
      const adminDb = getDb();
      let actualCost = AI_AUDIT_TOOL_BASE_COST;
      try {
          const appConfigDocRef = adminDb.collection("appConfiguration").doc("mainConfig");
          const appConfigSnap = await appConfigDocRef.get();
          if (appConfigSnap.exists) {
              const configData = appConfigSnap.data() as AppConfiguration;
              const costConfig = configData.actionCosts?.find((c) => c.key === "AI_AUDIT_TOOL_BASE_COST");
              if (costConfig && typeof costConfig.cost === 'number') {
                  actualCost = costConfig.cost;
              }
          }
      } catch (configError) {
          console.warn(`Error fetching app config for AI_AUDIT_TOOL_BASE_COST, using default: ${AI_AUDIT_TOOL_BASE_COST}`, configError);
      }

      const userProfileRef = adminDb.collection('users').doc(userId);
      const userProfileSnap = await userProfileRef.get();
      if (!userProfileSnap.exists) {
          throw new Error("User profile not found for point deduction.");
      }
      const userProfileData = userProfileSnap.data() as UserProfile;
      const currentPoints = userProfileData.resourcePoints ?? 0;
      if (currentPoints < actualCost) {
          return { auditSummary: 'Insufficient resource points.', suggestedCorrections: "", riskAssessment: "", error: `Insufficient resource points. You need ${actualCost}, but have ${currentPoints}.` };
      }
      
      let companyProfileSummary = "Company Profile: Not found or error fetching.";
      try {
        const companyDocRef = adminDb.collection("companies").doc(companyId);
        const companySnap = await companyDocRef.get();
        if (companySnap.exists) {
          const companyData = companySnap.data() as Company;
          if (companyData.userId !== userId) {
              throw new Error("Access denied. This company does not belong to the requesting user's data scope.");
          }
          companyProfileSummary = `Name: ${companyData.name}\nType: ${companyData.companyType || 'N/A'}\nAddress: ${companyData.address}\nGSTIN: ${companyData.gstin || 'N/A'}\nPAN: ${companyData.panNumber || 'N/A'}\nDescription: ${companyData.description || 'N/A'}`;
        } else {
          throw new Error("Company profile not found.");
        }
      } catch (e: any) {
        console.error("Error fetching company profile for audit:", e);
        throw new Error(`Error fetching company profile: ${e.message}`);
      }

      let estimatesSummary = "Recent Estimates:\nNo recent estimates found or error fetching.";
      try {
        let estQuery = adminDb.collection("estimates").where("companyId", "==", companyId).where("userId", "==", userId);
        const estimatesSnapshot = await estQuery.get();
        let allEstimates = estimatesSnapshot.docs.map(doc => doc.data() as Estimate);
        
        if (estimateStatusFilter) { 
          allEstimates = allEstimates.filter(est => est.status === estimateStatusFilter); 
        }
        
        if (allEstimates.length > 0) {
          estimatesSummary = `Recent Estimates (up to 5${estimateStatusFilter ? `, status: ${estimateStatusFilter}` : ''}):\n`;
          allEstimates.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5).forEach(est => {
            estimatesSummary += `- Est #: ${est.estimateNumber}, To: ${est.organizationName}, Date: ${est.date}, Amount: ${est.grandTotal}, Status: ${est.status}\n`;
          });
        } else {
            estimatesSummary = `No estimates found for company ID ${companyId}${estimateStatusFilter ? ` with status '${estimateStatusFilter}'` : ''}.`;
        }
      } catch (e) { 
        console.error("Error fetching estimates for audit:", e); 
        estimatesSummary = "Recent Estimates: Error fetching details."; 
      }

      let workOrdersSummary = "Recent Work Orders:\nNo recent work orders found or error fetching.";
      let sdSummaryContext: string | undefined = undefined;
      try {
        let woQuery = adminDb.collection("workOrders").where("companyId", "==", companyId).where("userId", "==", userId);
        const workOrdersSnapshot = await woQuery.get();
        let allWorkOrders = workOrdersSnapshot.docs.map(doc => doc.data() as WorkOrder);
        
        if (workOrderStatusFilter) { 
          allWorkOrders = allWorkOrders.filter(wo => wo.status === workOrderStatusFilter); 
        }
        if (sdFilter === 'with_sd') { 
          allWorkOrders = allWorkOrders.filter(wo => (wo.securityDeposit ?? 0) > 0); 
          sdSummaryContext = "Work Orders with a Security Deposit"; 
        }
        else if (sdFilter === 'without_sd') { 
          allWorkOrders = allWorkOrders.filter(wo => (wo.securityDeposit ?? 0) <= 0); 
          sdSummaryContext = "Work Orders without a Security Deposit"; 
        }

        if (allWorkOrders.length > 0) {
          workOrdersSummary = `Recent Work Orders (up to 5${workOrderStatusFilter ? `, status: ${workOrderStatusFilter}` : ''}${sdSummaryContext ? `, ${sdSummaryContext}` : ''}):\n`;
          allWorkOrders.sort((a,b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()).slice(0,5).forEach(wo => {
            workOrdersSummary += `- WO #: ${wo.workOrderNumber}, For: ${wo.organizationName}, Start: ${wo.startDate}, Amount: ${wo.grandTotal}, Status: ${wo.status}, SD: ${wo.securityDeposit ?? 'N/A'}\n`;
          });
        } else {
          workOrdersSummary = `No work orders found for company ID ${companyId} matching filters.`;
        }
      } catch (e) { 
        console.error("Error fetching work orders for audit:", e); 
        workOrdersSummary = "Recent Work Orders: Error fetching details."; 
      }
      
      let invoicesSummary = "Recent Invoices:\nNo recent invoices found or error fetching.";
      try {
        let invQuery = adminDb.collection("invoices").where("companyId", "==", companyId).where("userId", "==", userId);
        const invoicesSnapshot = await invQuery.get();
        let allInvoices = invoicesSnapshot.docs.map(doc => doc.data() as Invoice);
        if (invoiceStatusFilter) { 
          allInvoices = allInvoices.filter(inv => inv.status === invoiceStatusFilter); 
        }
        if (allInvoices.length > 0) {
          invoicesSummary = `Recent Invoices (up to 5${invoiceStatusFilter ? `, status: ${invoiceStatusFilter}` : ''}):\n`;
          allInvoices.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0,5).forEach(inv => {
            invoicesSummary += `- Inv #: ${inv.invoiceNumber}, To: ${inv.organizationName}, Date: ${inv.date}, Amount: ${inv.grandTotal}, Status: ${inv.status}, Due: ${inv.balanceDue}\n`;
          });
        } else {
            invoicesSummary = `No invoices found for company ID ${companyId}${invoiceStatusFilter ? ` with status '${invoiceStatusFilter}'` : ''}.`;
        }
      } catch (e) { 
        console.error("Error fetching invoices for audit:", e); 
        invoicesSummary = "Recent Invoices: Error fetching details."; 
      }

      let licensesSummary = "Licenses:\nNo license data found or error fetching.";
      let licensesFilterContext: string | undefined = undefined;
      try {
        const licensesQuery = adminDb.collection("licenses").where("companyId", "==", companyId).where("userId", "==", userId);
        const licensesSnapshot = await licensesQuery.get();
        let allLicenses = licensesSnapshot.docs.map(d => d.data() as License);
        
        if (licenseFilter === 'expiring_soon') {
          const today = new Date();
          const ninetyDaysFromNow = addDays(today, 90);
          allLicenses = allLicenses.filter(lic => { 
            try { 
              const expiry = parseISO(lic.expiryDate); 
              return isBefore(expiry, ninetyDaysFromNow) && !isBefore(expiry, today); 
            } catch { 
              return false; 
            } 
          });
          licensesFilterContext = "Licenses expiring in the next 90 days";
        } else { 
          licensesFilterContext = "All licenses for the company"; 
        }

        if (allLicenses.length > 0) {
          licensesSummary = `Licenses Summary (${licensesFilterContext}):\nTotal Found: ${allLicenses.length}\n`;
          allLicenses.sort((a,b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime()).slice(0, 5).forEach(lic => { 
            licensesSummary += `- Name: ${lic.licenseName}, Number: ${lic.licenseNumber}, Type: ${lic.licenseType}, Expires: ${formatDate(lic.expiryDate)}\n`; 
          });
          if (allLicenses.length > 5) licensesSummary += "...and more.\n";
        } else { 
          licensesSummary = `Licenses: No licenses found matching filter: ${licensesFilterContext || 'All'}`; 
        }
      } catch (e) { 
        console.error("Error fetching licenses for audit:", e); 
        licensesSummary = "Licenses: Error fetching details."; 
      }
      
      const promptText = `You are an expert auditor specializing in contractor company activities. Your role is to review the provided company data, identify potential errors and inconsistencies, and provide suggestions for corrections based on industry benchmarks and economic data.

Analyze the following information to identify any discrepancies or areas of concern:

Company Profile:
${companyProfileSummary}

${ estimateStatusFilter ? `The estimate summary below is focused on status: '${estimateStatusFilter}'.` : '' }
Recent Estimates Summary:
${estimatesSummary}

${ workOrderStatusFilter ? `The work order summary below reflects a filter for: '${workOrderStatusFilter}'.` : ''}
${ sdSummaryContext ? `The work order summary below reflects a filter for: '${sdSummaryContext}'.`: ''}
Recent Work Orders Summary:
${workOrdersSummary}

${ invoiceStatusFilter ? `The invoice summary below is focused on status: '${invoiceStatusFilter}'.` : ''}
Recent Invoices Summary:
${invoicesSummary}

${ licensesFilterContext ? `The licenses summary below is focused on: '${licensesFilterContext}'.`: ''}
Licenses Summary:
${licensesSummary}

Industry Benchmarks:
${industryBenchmarks}

Economic Data:
${economicData}

Based on your analysis, provide a detailed audit summary, specific suggestions for correcting errors and optimizing business practices, and a risk assessment associated with the identified issues.
Your goal is to help the contractor ensure compliance, optimize their business practices, and mitigate potential risks.
Focus your analysis on the data provided. If specific data points (like labor costs, material specifics) are missing from the summaries, acknowledge that and base your audit on the available information.
If summaries are filtered (e.g., by status or security deposit), consider this context in your analysis.
`;

      let response;
      for (const modelName of MODEL_FALLBACK_LIST) {
        try {
          console.log(`Attempting audit with model: ${modelName}`);
          response = await ai.generate({
            prompt: promptText,
            model: modelName as any,
            output: { schema: AuditAIModelOutputSchema },
          });
          if(response) {
            console.log(`Audit success with model: ${modelName}`);
            break;
          }
        } catch (error: any) {
          console.warn(`Model ${modelName} failed for audit. Error: ${error.message}`);
        }
      }
       
      if (!response || !response.output) {
        throw new Error("AI model did not return an output for the audit after trying all fallbacks.");
      }
      const output = response.output;
      
      const newPoints = Math.round(currentPoints - actualCost);
      await userProfileRef.update({ 
        resourcePoints: newPoints, 
        resourcePointsLastUpdated: new Date().toISOString() 
      });

      await logActivity({
          ownerId: userId,
          actorUid: actorUid || userId,
          actorName: actorName || userProfileData.fullName || "AI User",
          actionType: 'audit_run',
          entityType: 'AI',
          entityName: `AI Audit for Company ID: ${companyId}`,
          details: { 
              filters: `WO Status (${workOrderStatusFilter || 'all'}), Invoice Status (${invoiceStatusFilter || 'all'}), Est Status (${estimateStatusFilter || 'all'}), SD (${sdFilter || 'all'}), Licenses (${licenseFilter || 'all'})`,
              cost: actualCost
          }
      });
      
      return { ...output, newResourcePoints: newPoints };
  }
);

export async function runAudit(input: z.infer<typeof AuditContractorActivitiesInputSchema>): Promise<AuditContractorActivitiesOutput> {
  return await auditContractorActivitiesFlow(input);
}

export const auditContractorActivities = runAudit;
export { auditContractorActivitiesFlow };
