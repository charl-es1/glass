# Glass Cutting Price Calculator & Management System

An enterprise-grade, full-stack Next.js web application for a glass cutting business. It allows staff (users) to perform real-time cut pricing calculations using a dynamic 2D visualizer, and grants administrators full CRUD management over pricing, user roles, and global audit history.

## Features

### 1. Authentication & Role-Based Access Control
* **JWT Cookie Session**: Secure session management using HTTP-only cookies.
* **Middleware Guarding**: Automatic server-side routing guards protect `/admin` and `/dashboard` screens based on roles.
* **Role separation**:
  * **Admin**: Access to business analytics, user management, glass pricing settings, global quote audits, and CSV export.
  * **User (Staff)**: Access to the pricing calculator, dynamic visualizer, quote saver, and PDF export.

### 2. User (Staff) Dashboard
* **Dynamic Calculator**: Inputs for length (m), width (m), and glass types (Clear, Frosted, Tinted, etc.). Real-time math for Area (m²), Unit Price, and Total Cost.
* **Live 2D SVG Visualizer**: Auto-scaling blueprint representation of the glass sheet, rendering exact proportions, glare highlight accents, dimension text labels with arrows, ticks, and name watermark.
* **History Log**: Paginated search and filters for personal quote logs.
* **PDF Export**: Generate professional formatted quote summary receipts in a single click (using `jsPDF`).

### 3. Admin Dashboard
* **KPI Metrics**: Total estimates logged and aggregate revenue summaries.
* **Usage Breakdown**: Stats showing which glass types are popular and activity summaries per staff member.
* **Glass Types CRUD**: Register new glass configurations and update pricing per m² in real time.
* **User Accounts Manager**: Add staff accounts, update roles, toggle active/inactive status (deactivate access), and override/reset passwords.
* **Audit Logs**: Query and sort all system quotes by price, area, or date, and export filter lists directly as a CSV spreadsheet.

---

## Tech Stack

* **Frontend & Backend**: Next.js (App Router, TypeScript)
* **Database**: SQLite
* **ORM**: Prisma ORM (v7.8.0)
* **Driver Adapter**: `better-sqlite3` & `@prisma/adapter-better-sqlite3`
* **Cryptography**: `bcryptjs` & `jsonwebtoken`
* **PDF Engine**: `jsPDF`
* **Styling**: Vanilla CSS (CSS Modules)

---

## Getting Started

### 1. Prerequisites
Ensure you have **Node.js LTS** (v24+) installed on your machine.

### 2. Install Dependencies
Initialize npm packages in the project directory:
```bash
npm install
```

### 3. Set Up Database
Generate the Prisma Client and sync the database schema with your local SQLite database:
```bash
npx prisma db push
```
*(This creates the database file at `prisma/dev.db`)*

### 4. Seed Database
Seeding populates the database with default glass configurations and pre-configured logins:
```bash
npx tsx prisma/seed.ts
```

### 5. Run Development Server
Start the Next.js local server:
```bash
npm run dev
```
Open your browser and navigate to [http://localhost:3000](http://localhost:3000).

---

## Default Seeded Accounts

Use the following logins to test the respective role dashboards:

* **Administrator Account**
  * **Email**: `admin@glasscutting.com`
  * **Password**: `admin123`

* **Staff User Account**
  * **Email**: `staff@glasscutting.com`
  * **Password**: `staff123`

---

## Initial Seeded Pricing (GHS)

* **Clear Float (5mm)**: 200.00 GHS/m²
* **Frosted Glass (6mm)**: 350.00 GHS/m²
* **Tinted Glass (Bronze/Grey)**: 400.00 GHS/m²
* **Tempered Safety Glass**: 500.00 GHS/m²
* **Laminated Glass (Double)**: 650.00 GHS/m²
