
import type { LucideIcon } from 'lucide-react';

export interface WorkflowStep {
  step: string;
  title: string;
  icon: string; // Use string for icon name
  color: string;
  description: string;
  steps: string[];
}

export const workflowData: WorkflowStep[] = [
  {
    step: "1",
    title: "Setup & Configuration",
    icon: "Settings",
    color: "text-gray-500",
    description: "The foundational elements of your business. Set these up first to streamline all future operations. These are generally one-time setups.",
    steps: [
      "**Profile & E-Signature:** \n1. Click your avatar in the top-right corner, then select `Profile`.\n2. Fill in your `Full Name`, `Phone Number`, and `Address`.\n3. Click `Upload Profile Picture` to select an image from your device.\n4. Click `Upload Signature` to add an e-signature image (transparent PNG recommended).\n5. Enter `Signature Phrase 1 & 2` to appear below your signature on documents.\n6. Click `Save Profile Changes`.",
      "**Companies:** \n1. Navigate to `Resource Management` > `Companies` from the sidebar.\n2. Click the `Add New Company` button.\n3. Enter all required company details like `Name`, `Address`, `GSTIN`, and `PAN`.\n4. Upload a company logo if available.\n5. Click `Save Company`. You will use this company profile on all your documents.",
      "**Bank Accounts:** \n1. Navigate to `Resource Management` > `Bank Accounts`.\n2. Click `Add New Account`.\n3. Fill in all bank details accurately.\n4. Check `Set as default bank account` if this is your primary account for invoices.\n5. Click `Save Account`. This account can be automatically displayed on invoices.",
      "**Team Management:** \n1. Navigate to `Account & Settings` > `Manage Team`.\n2. Click `Invite New Member`.\n3. Enter the member's `Name` and invite them via `Email` or `Phone`.\n4. Assign specific permissions for each module by checking the relevant boxes.\n5. Click `Log Invitation`. They will be able to join your team and access data based on the permissions you've set.",
    ],
  },
  {
    step: "2",
    title: "Resource Management",
    icon: "Package",
    color: "text-lime-500",
    description: "Define the core assets, materials, and rates you will use in your projects to speed up document creation.",
    steps: [
      "**Client Organizations:** \n1. Go to `Resource Management` > `Organizations`.\n2. Click `Add New Organization` to build your client list.\n3. Enter the client's `Name`, `Contact Details`, and `Address`.\n4. Choose `Private` visibility (default) or `Public` if the client should be visible to all users.",
      "**Subcontractors:** \n1. Go to `Resource Management` > `Subcontractors`.\n2. Click `Add New Subcontractor`.\n3. Enter their `Name`, `Specialization`, and contact details.\n4. This creates a directory of your trusted partners for easy reference.",
      "**Schedule of Rates (SOR):** \n1. Go to `Resource Management` > `SOR Rates`.\n2. Click `Add New SOR Rate`.\n3. Enter a unique `Item Code`, `Description`, `Unit`, and `Rate`.\n4. Optionally, associate it with a specific `Organization` or make it `Public`.\n5. Click `Save Item`. These rates can be quickly searched and added when creating Estimates or Invoices.",
      "**Inventory Management:** \n1. Navigate to `Resource Management` > `Inventory`.\n2. Click `Add New Item` to define a material or service.\n3. Enter `Item Name`, `Unit`, `Selling Price`, and optional details like `SKU` and `Purchase Price`.\n4. To track stock, enter `Quantity on Hand` and `Low Stock Threshold`.\n5. Click `Issue` or `Receive` buttons on an item to log stock movements. Issuing stock against a `Work Order` automatically logs it as an expense.",
      "**Labour Register & Payments:** \n1. Go to `Resource Management` > `Labour Register` and click `Add New Labourer`.\n2. **Crucially, select the `Work Order` this labourer will be associated with.**\n3. Enter the `Worker Name`, `Role`, and `Daily Wage`.\n4. From the `Labour Register` screen, click `Record Payment` to log advances or salaries. This also creates an expense entry automatically.",
    ],
  },
    {
    step: "3",
    title: "Core Operations",
    icon: "Construction",
    color: "text-orange-500",
    description: "The main workflow from initial proposal to final payment for a project.",
    steps: [
      "**Estimates:** \n1. Navigate to `Core Operations` > `Estimates` and click `Create New Estimate`.\n2. Select your `Company` and the `Client Organization`.\n3. Enter the `Estimate Number`, `Date`, and other details.\n4. Add line items by clicking `Add Item`. You can search your `SOR` library to auto-fill details or enter them manually.\n5. Adjust `Tax Rate`, add `Terms & Conditions` and `Notes`.\n6. Save as `Draft` or change status to `Submitted`.",
      "**Work Orders:** \n1. Create a new Work Order from scratch via `Core Operations` > `Work Orders`, or convert an `Approved` Estimate with one click from the Estimates page.\n2. Fill in the `Work Order Number`, `Start Date`, `End Date`, and `Scope of Work`.\n3. Verify or add items to be executed.\n4. Set `Status` to `Approved` or `In-Progress` to begin work.\n5. Click `Save Work Order`.",
      "**Daily Progress Reports (DPR):** \n1. Navigate to `Core Operations` > `Daily Progress Reports`.\n2. Click `Log New DPR`.\n3. Select the `Work Order` and `Report Date`.\n4. Fill in all progress fields, from previous day's work to today's completion.\n5. Rate the day's work and optionally upload site photos.",
      "**Service Visit Reports (SVR):** \n1. Go to `Core Operations` > `Service Visit Reports`.\n2. Click `Log New SVR`.\n3. Select the `Work Order` and `Visit Date`.\n4. Detail the `Purpose of Visit` and `Actions Taken`.\n5. Rate the visit and click `Save SVR`.",
    ],
  },
  {
    step: "4",
    title: "Financials",
    icon: "IndianRupee",
    color: "text-green-500",
    description: "Manage all financial aspects of your business, from procurement to billing and payments.",
    steps: [
      "**Purchase Orders:** \n1. Go to `Financials` > `Purchase Orders` and click `New PO`.\n2. Select your `Company` (Issuer) and the `Supplier` organization.\n3. **Interlink:** Optionally link to a `Work Order` to track project-specific procurement.\n4. Add items to be procured.\n5. Fill in `Shipping/Billing` details and `Payment Terms`.\n6. Click `Create Purchase Order`.",
      "**Expense Tracking:** \n1. Go to `Financials` > `Expense Tracking` and click `New Expense`.\n2. Enter the `Date`, `Category`, `Description`, and `Amount`.\n3. **Interlink:** Optionally, link the expense to a `Company` and `Work Order` to track project costs.\n4. Upload a receipt image if available.\n5. Click `Save Expense`.",
      "**Invoices:** \n1. Go to `Financials` > `Invoices` and click `Create New Invoice`.\n2. Select your `Company` and `Client`.\n3. Enter `Invoice Number`, `Date`, and `Due Date`.\n4. **Interlink:** Optionally, link to a `Work Order` to auto-fill items and details.\n5. Add/modify items and set the `Tax Rate`.\n6. Update `Amount Paid` to reflect payments received.\n7. Change status from `Draft` to `Sent` and finally to `Paid`.",
      "**Coins & Payments:** \n1. Go to `Account & Settings` > `Coins & Payments`.\n2. View your current `Resource Point` balance.\n3. See a breakdown of costs for various app features.\n4. Review your `Payment History` and `Usage History`.\n5. Click `Buy More Points` to select a package and complete the secure payment process.",
    ]
  },
  {
    step: "5",
    title: "Reporting & Analytics",
    icon: "BarChart3",
    color: "text-blue-500",
    description: "Analyze your business performance with powerful, data-driven reports.",
    steps: [
      "**Financial Summary:** \n1. Navigate to `Reporting` > `Financial Summary`.\n2. Get an at-a-glance view of your total `Revenue`, `Expenses`, and `Net Profit/Loss`.\n3. Analyze interactive charts for `Monthly Income vs. Expenses`, `Expense Categories`, and `Work Order Profitability`.\n4. Review detailed breakdowns of financial performance.",
      "**Work Order Profitability:** \n1. Go to `Reporting` > `WO Profitability`.\n2. This report compares the `Project Value` of each work order against its `Total Revenue` (from paid invoices) and `Total Costs`.\n3. Quickly identify which projects are most profitable and which are running at a loss.",
      "**Labour Cost Analysis:** \n1. Navigate to `Reporting` > `Labour Cost Analysis`.\n2. See a breakdown of `Actual Labour Costs` versus the `Project Budget` for each work order.\n3. Monitor variances to control labour-related expenses effectively.",
      "**Materials Consumption:** \n1. Go to `Reporting` > `Materials Consumption`.\n2. Select a `Company` and a `Date Range` to generate the report.\n3. View an aggregated list of all materials consumed as logged in your `Daily Progress Reports (DPRs)`.",
      "**DPR Summary:** \n1. Navigate to `Reporting` > `DPR Summary`.\n2. Select a `Work Order` and a `Month/Year`.\n3. Generate a consolidated report of all DPRs for that period, perfect for client submissions or internal reviews.",
    ]
  },
  {
    step: "6",
    title: "Advanced Tools & AI",
    icon: "Sparkles",
    color: "text-rose-500",
    description: "Leverage artificial intelligence and advanced tools to gain insights and efficiency.",
    steps: [
      "**Time Tracking (for Labour):** \n1. Go to `Advanced Tools` > `Time Tracking`.\n2. Select a `Work Order` to view its registered labourers.\n3. Click any cell in the grid to open a popover.\n4. Mark attendance by selecting `Full Day`, `Half Day`, `Absent`, or entering custom hours.\n5. Click `Save Changes` to log the attendance.",
      "**Gantt Charts:** \n1. Navigate to `Advanced Tools` > `Gantt Charts`.\n2. Select a `Work Order` to visualize its project timeline.\n3. Use the `AI Project Scheduler` to automatically create an initial set of tasks based on the Work Order's items and scope.\n4. Manually `Add`, `Edit`, or `Delete` tasks as needed to refine the schedule.",
      "**Letter & Certificate Generation:** \n1. Go to `Advanced Tools` > `Letter/Certificate Generation`.\n2. Click `Create New`.\n3. Provide the `Recipient`, `Subject`, and the main `Context` for your document.\n4. Use the AI to generate professional content, then review and save it.",
      "**AI Audit & Analysis Suite:** \n1. Explore the `Advanced Tools` menu for a suite of AI auditors.\n2. Use the `AI Audit Tool` to review company-wide activities for inconsistencies.\n3. Use the `AI Financial Health Check` for an overview of your financial status.\n4. Use other specific analyzers like `Labor`, `Work Order`, `Fraud`, and `Cash Flow` for targeted insights."
    ],
  },
  {
    step: "7",
    title: "Marketing & Community",
    icon: "Megaphone",
    color: "text-cyan-500",
    description: "Tools for managing client relationships, networking, and engaging with the community.",
    steps: [
      "**Follow-ups:** \n1. Navigate to `Core Operations` > `Follow-ups`.\n2. Log interactions with clients, including `Visit Date`, `Contact Person`, and `Notes` from your discussion.\n3. Set a future `Reminder Date` to ensure you never miss a follow-up.",
      "**Mailing Lists & Contacts:** \n1. Go to `Marketing & Outreach` > `Mailing Lists`.\n2. Click `New List` to create categories for your contacts (e.g., 'Past Clients', 'Leads').\n3. Click `Add Contact` to manually add new people to your database and assign them to one or more lists.",
      "**AI Content Generation:** \n1. Navigate to `Marketing & Outreach` > `Content`.\n2. Click `Generate New Content`.\n3. Provide the AI with a `Name`, `Prompt/Instructions`, and optional product details.\n4. The AI will generate a professional email subject and body, which is then saved for use in campaigns.",
      "**Campaigns:** \n1. After creating content and lists, go to the `Create & Send a Campaign` section.\n2. Give your campaign a name.\n3. Select your pre-generated `Email Content` and the `Target Mailing Lists`.\n4. Click `Send Campaign` to dispatch the emails.",
      "**Public Portfolios & Digital Cards:** \n1. Go to `Advanced Tools` > `AI Portfolio Generator` to create a public webpage showcasing your projects.\n2. Go to `Advanced Tools` > `QR Business Card` and click `Create New Card`. Fill in your details to generate a shareable digital contact card with a QR code.",
      "**Buy/Sell/Exchange Marketplace:** \n1. Navigate to `Advanced Tools` > `Buy/Sell/Exchange`.\n2. Browse listings or click `Create New Listing` to post your own items for sale, purchase, or exchange.",
    ],
  },
  {
    step: "8",
    title: "Compliance & Support",
    icon: "ShieldCheck",
    color: "text-teal-500",
    description: "Manage essential documents and licenses to stay compliant and organized.",
    steps: [
      "**Document Repository:** \n1. Navigate to `Resource Management` > `Documents`.\n2. Click `Add New Document`, give it a name, and select a `Type`.\n3. **Interlink:** Link to a `Work Order` for better organization and upload the file.",
      "**License Management:** \n1. Go to `Resource Management` > `Licenses`.\n2. Click `Add New License` and enter all details, including `Issue Date` and `Expiry Date` to enable renewal alerts.",
      "**Help & Support:** \n1. Navigate to `Account & Settings` > `Help & Support`.\n2. Select a `Submission Type` (e.g., Query, Bug Report).\n3. Provide a clear `Subject` and a detailed `Description` of your issue to create a support ticket.",
    ],
  },
];
