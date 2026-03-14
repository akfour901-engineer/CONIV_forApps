
import { NextResponse } from 'next/server';
import { getAuth, getDb } from '@/lib/firebase-admin-init';
import type { UserProfile, Expense, Invoice as AppInvoice, WorkOrder, AppConfiguration, Estimate, PurchaseOrder, LabourRegister, InventoryItem, Organization, Company, Subcontractor, FollowUp, TeamMember, TeamInvitation, UserSubmission, ListingItem, LabourAdvance, DailyProgressReport, ServiceVisitReport } from '@/types/server-only';
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { logActivity } from '@/lib/activityLog';
import * as admin from 'firebase-admin';
import { MODEL_FALLBACK_LIST } from '@/ai/models';
export const dynamic = 'force-dynamic';
const QAndAInputSchema = z.object({
  userId: z.string(),
  query: z.string().min(3, "Query must be at least 3 characters long."),
  actorUid: z.string().optional(),
  actorName: z.string().optional(),
});
type QAndAInput = z.infer<typeof QAndAInputSchema>;

const AIQAndAOutputSchema = z.object({
  answer: z.string().describe("A clear, concise, and accurate answer to the user's question, based on the provided data context. The answer should be in markdown format."),
});

const QAndAOutputSchema = AIQAndAOutputSchema.extend({
  newResourcePoints: z.number().optional(),
  error: z.string().optional(),
});
type QAndAOutput = z.infer<typeof QAndAOutputSchema>;

const qAndAFlow = ai.defineFlow(
  {
    name: 'qAndAFlow_api',
    inputSchema: QAndAInputSchema,
    outputSchema: QAndAOutputSchema,
  },
  async (input) => {
      const adminDb = getDb();
      const { userId, query, actorUid, actorName } = input;
      
      const DEFAULT_COST = 35;
      let actualCost = DEFAULT_COST;
      try {
        const configDoc = await adminDb.collection('appConfiguration').doc('mainConfig').get();
        if(configDoc.exists) {
            const config = configDoc.data() as AppConfiguration;
            const costConfig = config.actionCosts?.find((c: any) => c.key === 'AI_AUDIT_TOOL_Q_AND_A_COST');
            if(costConfig?.cost !== undefined) actualCost = costConfig.cost;
        }
      } catch(e) { console.warn("Could not fetch cost config for Q&A Auditor."); }

      const userProfileRef = adminDb.collection('users').doc(userId);
      const userProfileSnap = await userProfileRef.get();
      if (!userProfileSnap.exists) throw new Error("User profile not found for billing.");
      const userProfileData = userProfileSnap.data() as UserProfile;
      if ((userProfileData.resourcePoints ?? 0) < actualCost) {
        throw new Error(`Insufficient resource points. You need ${actualCost}.`);
      }
      
      const [
          estimatesSnap, workOrdersSnap, invoicesSnap, expensesSnap, poSnap,
          labourSnap, inventorySnap, orgsSnap, companiesSnap, subcontractorsSnap,
          followUpsSnap, dprSnap, svrSnap, teamMembersSnap, teamInvitationsSnap,
          userSubmissionsSnap, listingsSnap, labourAdvancesSnap
      ] = await Promise.all([
          adminDb.collection('estimates').where('userId', '==', userId).limit(200).get(),
          adminDb.collection('workOrders').where('userId', '==', userId).limit(100).get(),
          adminDb.collection('invoices').where('userId', '==', userId).limit(300).get(),
          adminDb.collection('expenses').where('userId', '==', userId).limit(500).get(),
          adminDb.collection('purchaseOrders').where('userId', '==', userId).limit(200).get(),
          adminDb.collection('labourRegisters').where('userId', '==', userId).limit(300).get(),
          adminDb.collection('inventoryItems').where('userId', '==', userId).limit(500).get(),
          adminDb.collection('organizations').where('userId', '==', userId).limit(200).get(),
          adminDb.collection('companies').where('userId', '==', userId).limit(50).get(),
          adminDb.collection('subcontractors').where('userId', '==', userId).limit(100).get(),
          adminDb.collection('followUps').where('userId', '==', userId).limit(100).get(),
          adminDb.collection('dailyProgressReports').where('userId', '==', userId).limit(300).get(),
          adminDb.collection('serviceVisitReports').where('userId', '==', userId).limit(200).get(),
          adminDb.collection('users').doc(userId).collection('teamMembers').limit(50).get(),
          adminDb.collection('teamInvitations').where('ownerId', '==', userId).limit(50).get(),
          adminDb.collection('userSubmissions').where('userId', '==', userId).limit(50).get(),
          adminDb.collection('listingItems').where('userId', '==', userId).limit(100).get(),
          adminDb.collection('labourAdvances').where('userId', '==', userId).get(),
      ]);

      const createSummary = (snap: admin.firestore.QuerySnapshot, name: string, formatter: (doc: any) => string) => {
          if (snap.empty) return `No ${name} data found.`;
          return `${name} Summary:\n` + snap.docs.map(doc => formatter(doc.data())).join('\n');
      }

      // --- Data Enrichment Step ---
      const allExpenses = expensesSnap.docs.map(doc => doc.data() as Expense);
      const allPOs = poSnap.docs.map(doc => doc.data() as PurchaseOrder);
      const allLabourAdvances = labourAdvancesSnap.docs.map(doc => doc.data() as LabourAdvance);

      const workOrdersWithCosts = workOrdersSnap.docs.map(doc => {
          const wo = { id: doc.id, ...doc.data() } as WorkOrder;
          const linkedExpenses = allExpenses.filter(e => e.workOrderId === wo.id);
          const linkedPOs = allPOs.filter(po => po.workOrderId === wo.id && po.status !== 'cancelled');
          const linkedLabourAdvances = allLabourAdvances.filter(adv => adv.workOrderId === wo.id);
          
          const totalExpenseCost = linkedExpenses.reduce((sum, exp) => sum + exp.amount, 0);
          const totalPoCost = linkedPOs.reduce((sum, po) => sum + po.grandTotal, 0);
          const totalLabourCost = linkedLabourAdvances.reduce((sum, adv) => sum + adv.amount, 0);

          const totalCost = totalExpenseCost + totalPoCost + totalLabourCost;
          return {
              ...wo,
              totalExpenseCost,
              totalPoCost,
              totalLabourCost,
              totalCost,
          };
      });

      const workOrdersSummary = workOrdersWithCosts.length > 0
        ? `Work Orders Summary:\n` + workOrdersWithCosts.map(d => `- WO #${d.workOrderNumber} for ${d.organizationName}, Value: ${d.grandTotal}, Status: ${d.status}, Total Recorded Cost: ${d.totalCost}, Total Labor Cost: ${d.totalLabourCost}, Security Deposit: ${d.securityDeposit ?? 0}, Deposit Period: ${d.depositPeriod ?? 'N/A'} months`).join('\n')
        : "No work orders found.";
      // --- End Data Enrichment ---


      const contextData = `
        **CONTEXT DATA START**
        ${createSummary(companiesSnap, 'My Companies', (d: Company) => `- Company: ${d.name}`)}
        ${createSummary(orgsSnap, 'Organizations/Clients', (d: Organization) => `- Client/Org: ${d.name}, Type: ${d.type || 'N/A'}, Status: ${d.organizationStatus || 'N/A'}`)}
        ${createSummary(subcontractorsSnap, 'Subcontractors', (d: Subcontractor) => `- Subcontractor: ${d.name}, Specialization: ${d.specialization}`)}
        ${createSummary(estimatesSnap, 'Estimates', (d: Estimate) => `- Est #${d.estimateNumber} for ${d.organizationName}, Value: ${d.grandTotal}, Status: ${d.status}`)}
        ${workOrdersSummary}
        ${createSummary(invoicesSnap, 'Invoices', (d: AppInvoice) => `- Inv #${d.invoiceNumber} for ${d.organizationName}, Value: ${d.grandTotal}, Status: ${d.status}, Due: ${d.dueDate}, Balance: ${d.balanceDue}`)}
        ${createSummary(poSnap, 'Purchase Orders', (d: PurchaseOrder) => `- PO #${d.poNumber} to ${d.supplierOrganizationName}, Value: ${d.grandTotal}, Status: ${d.status}`)}
        ${createSummary(expensesSnap, 'Expenses', (d: Expense) => `- Expense: ${d.amount} on ${d.date} for "${d.description}" in category ${d.category}. Linked WO: ${d.workOrderNumber || 'N/A'}`)}
        ${createSummary(labourSnap, 'Labour', (d: LabourRegister) => `- Labourer: ${d.workerName}, Role: ${d.role}, Daily Wage: ${d.dailyWage}, Linked WO: ${d.workOrderNumber}`)}
        ${createSummary(inventorySnap, 'Inventory', (d: InventoryItem) => `- Item: ${d.name}, Qty: ${d.quantityOnHand || 0} ${d.unitOfMeasure}, Price: ${d.sellingPrice}`)}
        ${createSummary(followUpsSnap, 'Follow-ups', (d: FollowUp) => `- Follow-up for ${d.organizationName} on ${d.visitDate}. Status: ${d.status}. Reminder: ${d.reminderDate}`)}
        ${createSummary(dprSnap, 'Daily Progress Reports', (d: DailyProgressReport) => `- DPR for WO #${d.workOrderNumber} on ${d.reportDate}. Rating: ${d.workRating}/10`)}
        ${createSummary(svrSnap, 'Service Visit Reports', (d: ServiceVisitReport) => `- SVR for WO #${d.workOrderNumber} on ${d.visitDate}. Purpose: ${d.purposeOfVisit}`)}
        ${createSummary(teamMembersSnap, 'Team Members', (d: TeamMember) => `- Member: ${d.name}, Email: ${d.email}, Status: ${d.status}`)}
        ${createSummary(teamInvitationsSnap, 'Team Invitations', (d: TeamInvitation) => `- Invitation to ${d.invitedMemberName} (${d.invitedEmail || d.invitedPhoneNumber}). Status: ${d.status}`)}
        ${createSummary(userSubmissionsSnap, 'Support Tickets', (d: UserSubmission) => `- Ticket: ${d.subject}, Type: ${d.submissionType}, Status: ${d.status}`)}
        ${createSummary(listingsSnap, 'Marketplace Listings', (d: ListingItem) => `- Listing: ${d.title}, Type: ${d.itemType}, Price: ${d.price || 'N/A'}`)}
        **CONTEXT DATA END**
      `;

      const prompt = `You are a universal business data analyst for a contracting business. Your task is to answer questions based *only* on the comprehensive data context provided below. Cross-reference data between different sections to provide insightful answers. If the answer cannot be determined from the context, state that clearly and explain what data might be missing.

        **CRITICAL CONVERSATION RULE:** If the user's query is short and simple, like "yes", "correct", or "ok", first consider if it's a direct answer to a clarifying question you just asked. For example, if you asked, "By 'lossful', do you mean when expenses exceed the work order value?", and the user replies "yes", you MUST interpret this as confirmation and proceed with the analysis based on that definition. DO NOT state that "yes" is not a question. Instead, perform the requested task.

        **Example Analysis for answering complex questions:**
        - To find work orders in a 'loss', you must compare the 'Value' of the work order with its 'Total Recorded Cost'. If Total Recorded Cost > Value, it is a lossful work order. The 'Total Recorded Cost' and 'Total Labor Cost' fields are provided for each work order in the context.
        - To find work orders for which an invoice needs to be submitted, you must first look for all work orders with a 'completed' status. Then, for each of those completed work orders, you must check the provided invoices data to see if an invoice with a matching 'workOrderNumber' already exists. If a completed work order has no matching invoice, it needs to have an invoice submitted.
        - To calculate 'total collection from last month', you must identify all invoices with a status of 'paid' or 'partially-paid'. For each of those, calculate the collected amount, which is 'grandTotal' minus 'balanceDue'. Sum these collected amounts for all relevant invoices within the requested timeframe. If a timeframe isn't given, assume the last 30 days.
        - To find work orders for which you need to "apply for SD (Security Deposit)": You must find all work orders that are 'completed', have a 'Security Deposit' amount greater than 0, and a 'Deposit Period' in months. You should then calculate when the deposit is due for return by adding the 'Deposit Period' to the 'End Date' of the work order.

        ${contextData}

        ---

        **User's Question:**
        "${query}"

        ---

        Based *only* on the data provided, formulate a clear and accurate answer. Present lists or tables in markdown format for readability.
      `;
      
      let response;
      const schema = AIQAndAOutputSchema;
      for (const modelName of MODEL_FALLBACK_LIST) {
        try {
          console.log(`Attempting to generate with model: ${modelName}`);
          const { output } = await ai.generate({
            prompt: prompt,
            model: modelName as any,
          });
          if (output) {
            response = schema.parse(output);
            console.log(`Success with model: ${modelName}`);
            break;
          }
        } catch (error: any) {
          console.warn(`Model ${modelName} failed for Q&A. Error: ${error.message}`);
        }
      }

      if (!response) {
        throw new Error("AI model did not return a valid answer after trying all fallbacks.");
      }
      const output = response;

      const newResourcePoints = Math.round((userProfileData.resourcePoints ?? 0) - actualCost);
      await userProfileRef.update({ resourcePoints: newResourcePoints, resourcePointsLastUpdated: new Date().toISOString() });
      
      await logActivity({
          ownerId: userId,
          actorUid: actorUid || userId,
          actorName: actorName || userProfileData.fullName || userProfileData.email || "User",
          actionType: 'audit_run',
          entityType: 'AI',
          entityName: `AI Q&A: ${query.substring(0, 30)}...`,
          details: { cost: actualCost }
      });
      
      return { ...output, newResourcePoints };
  }
);


export async function POST(request: Request) {
  const authAdmin = getAuth();
  const adminDb = getDb();
  try {
    const authorizationHeader = request.headers.get('Authorization');
    if (!authorizationHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const idToken = authorizationHeader.split('Bearer ')[1];
    
    let decodedToken;
    try {
        decodedToken = await authAdmin.verifyIdToken(idToken);
    } catch(e:any) {
        return NextResponse.json({ error: 'Unauthorized: Invalid Token' }, { status: 401 });
    }
    
    const inputBody: QAndAInput = await request.json();

    const authenticatedUserUid = decodedToken.uid;
    const requestedDataOwnerId = inputBody.userId;
    
    let canAccess = false;
    if (authenticatedUserUid === requestedDataOwnerId) {
        canAccess = true;
    } else {
        const actorProfileDoc = await adminDb.collection('users').doc(authenticatedUserUid).get();
        if(actorProfileDoc.exists && (actorProfileDoc.data() as UserProfile).ownerId === requestedDataOwnerId) {
            const teamMemberDoc = await adminDb.collection('users').doc(requestedDataOwnerId).collection('teamMembers').doc(authenticatedUserUid).get();
            if(teamMemberDoc.exists && (teamMemberDoc.data() as TeamMember).permissions.canRunAudits) {
                canAccess = true;
            }
        }
    }
    
    if (!canAccess) {
        return NextResponse.json({ error: 'Forbidden: You do not have permission to run this tool for the specified account.' }, { status: 403 });
    }

    const actorProfileSnap = await adminDb.collection('users').doc(authenticatedUserUid).get();
    if (!actorProfileSnap.exists) {
        return NextResponse.json({ error: 'Actor profile not found' }, { status: 404 });
    }
    const actorProfile = actorProfileSnap.data() as UserProfile;

    const flowInput: QAndAInput = {
      ...inputBody,
      actorUid: authenticatedUserUid,
      actorName: actorProfile.fullName || actorProfile.email || 'User',
    };
    
    const result = await qAndAFlow(flowInput);

    return NextResponse.json(result, { status: 200 });

  } catch (error: any) {
    console.error(`Error in /api/ai/q-and-a-auditor:`, error);
    return NextResponse.json({ error: error.message || 'An unexpected error occurred.', details: error.message }, { status: 500 });
  }
}
