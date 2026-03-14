
'use server';
/**
 * @fileOverview A flow to fetch tender information from the GeM portal.
 *
 * This flow acts as a server-side proxy to communicate with the GeM API.
 * It is designed to be called by an internal API route, not directly from the client.
 */
import { z } from 'genkit';
import { ai } from '@/ai/genkit';

export const TenderSchema = z.object({
  id: z.string().describe("The unique identifier for the tender."),
  title: z.string().describe("The title or name of the tender."),
  category: z.string().describe("The category of the tender."),
  organisation: z.string().describe("The name of the organization that floated the tender."),
  endDate: z.string().describe("The closing date for the tender submission in ISO format."),
  url: z.string().url().describe("The direct URL to the tender on the GeM portal."),
});
export type Tender = z.infer<typeof TenderSchema>;

export const FetchGemTendersOutputSchema = z.array(TenderSchema);
export type FetchGemTendersOutput = z.infer<typeof FetchGemTendersOutputSchema>;

export const FetchGemTendersInputSchema = z.object({
  // Future parameters like keywords or categories can be added here
});
export type FetchGemTendersInput = z.infer<typeof FetchGemTendersInputSchema>;


// This is a placeholder function to simulate fetching data from the GeM portal API.
// In a real implementation, this function would make a secure HTTP request to the GeM API endpoint.
async function fetchFromGemApi(): Promise<any[]> {
    // In a real-world scenario, you would use 'fetch' with an API key stored in environment variables.
    // Example:
    // const apiKey = process.env.GEM_API_KEY;
    // const response = await fetch('https://api.gem.gov.in/v1/tenders?days=15', {
    //   headers: { 'Authorization': `Bearer ${apiKey}` }
    // });
    // if (!response.ok) throw new Error('Failed to fetch from GeM API');
    // return response.json();
    
    // For demonstration purposes, we return mock data.
    console.log("Simulating API call to GeM portal...");
    const today = new Date();
    
    const subDays = (date: Date, days: number) => {
        const newDate = new Date(date);
        newDate.setDate(date.getDate() - days);
        return newDate;
    };

    return [
        { bid_id: 'GEM/2024/B/12345', title: 'Supply of Office Stationery', category: 'Stationery', organisation_name: 'Ministry of Education', bid_end_date: subDays(today, 2).toISOString() },
        { bid_id: 'GEM/2024/B/67890', title: 'Security Services for Delhi Office', category: 'Services', organisation_name: 'Ministry of Health', bid_end_date: subDays(today, 5).toISOString() },
        { bid_id: 'GEM/2024/B/11223', title: 'Procurement of Laptops', category: 'IT Hardware', organisation_name: 'Ministry of Finance', bid_end_date: subDays(today, 10).toISOString() },
        { bid_id: 'GEM/2024/B/44556', title: 'Catering Services for Annual Event', category: 'Services', organisation_name: 'Ministry of External Affairs', bid_end_date: subDays(today, 14).toISOString() },
        { bid_id: 'GEM/2024/B/77889', title: 'Construction of Boundary Wall', category: 'Civil Works', organisation_name: 'Ministry of Defence', bid_end_date: subDays(today, 1).toISOString() },
    ];
}


const fetchGemTendersFlow = ai.defineFlow(
    {
      name: 'fetchGemTendersFlow',
      inputSchema: FetchGemTendersInputSchema,
      outputSchema: FetchGemTendersOutputSchema,
    },
    async (input) => {
      
      const rawTenders = await fetchFromGemApi();
      const fifteenDaysAgo = new Date();
      fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

      const processedTenders = rawTenders
        .map(tender => {
          try {
              // Basic validation to ensure required fields exist before parsing
              if (!tender.bid_id || !tender.title || !tender.category || !tender.organisation_name || !tender.bid_end_date) {
                  throw new Error('Missing required tender fields.');
              }
              const endDate = new Date(tender.bid_end_date);
              // After parsing, we create the full object.
              const tenderObject: Tender = {
                  id: tender.bid_id,
                  title: tender.title,
                  category: tender.category,
                  organisation: tender.organisation_name,
                  endDate: endDate.toISOString(),
                  url: `https://bidplus.gem.gov.in/bid_details/${tender.bid_id}` // Example URL structure
              };
              return tenderObject;
          } catch(e) {
              console.error("Error parsing tender data:", tender, e);
              return null;
          }
        })
        .filter((tender): tender is Tender => !!tender) // Simplified and correct type predicate
        .filter(tender => {
          // The API call itself should filter by date, but we double-check here.
          const endDate = new Date(tender.endDate);
          return endDate >= fifteenDaysAgo;
        });

      return processedTenders;
    }
);

export async function fetchGemTenders(input: FetchGemTendersInput): Promise<FetchGemTendersOutput> {
    return await fetchGemTendersFlow(input);
}
