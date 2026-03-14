# CONIV Application Blueprint

## 1. Introduction

**CONIV** is a comprehensive, all-in-one web application designed for contractors and construction businesses. It aims to streamline the entire project lifecycle, from initial client engagement and estimation to project execution, financial tracking, and team management. The platform integrates powerful AI tools to provide data-driven insights, automate tedious tasks, and improve overall business efficiency.

## 2. Technology Stack

The application is built on a modern, robust, and scalable technology stack:

-   **Frontend Framework**: [Next.js](https://nextjs.org/) with React (using the App Router).
-   **Language**: [TypeScript](https://www.typescriptlang.org/) for type safety and improved developer experience.
-   **UI Components**: [ShadCN UI](https://ui.shadcn.com/) for a set of reusable and accessible components.
-   **Styling**: [Tailwind CSS](https://tailwindcss.com/) for a utility-first CSS framework.
-   **Backend & Database**: [Firebase](https://firebase.google.com/) for authentication, Firestore (database), and Storage.
-   **Generative AI**: [Google AI & Genkit](https://firebase.google.com/docs/genkit) for all AI-powered features, including document analysis, suggestions, and reporting.

## 3. Core Features & Modules

### 3.1. Setup & Configuration
-   **User Profile**: Manage personal details, e-signature, and security settings.
-   **Company Profiles**: Register and manage multiple business entities.
-   **Bank Accounts**: Store bank details for inclusion in invoices.
-   **Team Management**: Invite members, assign granular permissions, and manage access.

### 3.2. Resource Management
-   **Organizations & Clients**: A CRM to manage client details and track leads.
-   **Schedule of Rates (SOR)**: A centralized library of items and rates for quick use in estimates and invoices.
-   **Inventory**: Track materials, products, and services with stock levels and pricing.
-   **Labour Register**: Manage workforce details, documents, and associate them with projects.
-   **Subcontractors**: A directory of subcontractors and their specializations.

### 3.3. Project Lifecycle
-   **Estimates**: Create, send, and track professional project estimates.
-   **Work Orders**: Convert estimates into actionable work orders to manage project execution.
-   **Purchase Orders**: Manage procurement of materials and services from suppliers.
-   **Expense Tracking**: Log all project-related and general business expenses.
-   **Invoices**: Generate and manage client invoices, and track payment status.

### 3.4. Compliance & Documentation
-   **Document Repository**: Upload and link important documents to specific projects.
-   **License Management**: Track business and professional licenses with expiry date alerts.
-   **On-Site Reporting**: Log Daily Progress Reports (DPRs) and Service Visit Reports (SVRs).

### 3.5. AI & Advanced Tools
-   **AI-Powered Generation**: Create estimates, marketing content, and professional letters using AI.
-   **AI Analysis & Audits**: Tools for risk assessment, document OCR, financial health checks, and fraud detection.
-   **Time Tracking & Gantt Charts**: Log labour hours and visualize project timelines.
-   **Marketing & Community**: Digital business cards, a marketplace, and a follow-up system.

## 4. Firestore Data Structure

The Firestore database is structured around the `users` collection, with most other data collections linked back to a `userId`.

-   `/users/{userId}`: Stores user profile information, settings, and team ownership details.
    -   `/users/{userId}/teamMembers/{memberId}`: Subcollection storing details of team members belonging to the user.
-   `/companies/{companyId}`: Stores company profiles created by users. `(userId)`
-   `/organizations/{organizationId}`: Stores client/organization details. Can be private (`userId`) or public.
-   `/estimates/{estimateId}`: Stores estimate documents. `(userId, companyId, organizationId)`
-   `/workOrders/{workOrderId}`: Stores work order documents. `(userId, companyId, organizationId)`
-   `/invoices/{invoiceId}`: Stores invoice documents. `(userId, companyId, organizationId, workOrderId)`
-   `/purchaseOrders/{poId}`: Stores purchase orders. `(userId, companyId, supplierOrganizationId, workOrderId)`
-   `/expenses/{expenseId}`: Logs individual expense entries. `(userId, workOrderId)`
-   `/labourRegisters/{labourerId}`: Stores details of individual laborers. `(userId, workOrderId)`
-   `/documents/{docId}`: A repository for uploaded files. `(userId, workOrderId)`
-   `/sorRates/{sorId}`: Schedule of Rates items. Can be private (`userId`) or public.
-   `/activityLogs/{logId}`: Audit trail of all significant actions in the system. `(ownerId)`
-   ...and other collections for licenses, inventory, team invitations, etc.

## 5. High-Level Workflow

The primary business workflow is designed to be sequential and intuitive:

1.  **Setup**: The user first sets up their **Profile**, **Companies**, and **Bank Accounts**.
2.  **Pre-Project**: The user adds **Clients (Organizations)** and defines their standard rates in the **SOR**.
3.  **Bidding**: A user creates an **Estimate** for a client, pulling data from their company profile and SOR.
4.  **Execution**: Once the estimate is approved, it's converted into a **Work Order**. During execution, **Expenses** are logged, **Purchase Orders** are created, **Labour** is managed, and progress is tracked via **DPRs/SVRs**.
5.  **Billing**: An **Invoice** is generated from the Work Order, sent to the client, and its payment is tracked.
6.  **Analysis**: Throughout the process, **Financial Reports** and **AI Tools** can be used to analyze profitability, assess risk, and gain insights.

This blueprint provides a snapshot of the CONIV application's structure and is intended to guide its development and evolution.
