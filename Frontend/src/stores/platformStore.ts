import { create } from "zustand";

export type UserStatus = "active" | "pending" | "suspended";
export type UserRole = "admin" | "business_user";
export type DataMartStatus = "connected" | "syncing" | "error";

export interface PlatformUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  dept: string;
  assignedDataMarts: string[]; // data mart IDs
  lastActive: string;
  registeredAt: string;
}

export interface DataMartColumn {
  name: string;
  type: string;
  nullable: boolean;
  description: string;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
}

export interface DataMartTable {
  name: string;
  description: string;
  columns: DataMartColumn[];
  rowCount: number;
}

export interface DataMart {
  id: string;
  name: string;
  description: string;
  icon: string;
  tables: DataMartTable[];
  status: DataMartStatus;
  users: number;
  lastSync: string;
  dbType: string;
}

export interface AccessRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  dept: string;
  requestedAt: string;
  status: "pending" | "approved" | "rejected";
  note?: string;
}

interface PlatformStore {
  users: PlatformUser[];
  dataMarts: DataMart[];
  accessRequests: AccessRequest[];

  // User actions
  registerUser: (name: string, email: string, password: string, dept: string) => string;
  approveUser: (userId: string) => void;
  rejectUser: (userId: string) => void;
  suspendUser: (userId: string) => void;
  activateUser: (userId: string) => void;

  // Data mart actions
  addDataMart: (name: string, description: string, icon: string, dbType: string) => void;
  updateDataMart: (id: string, name: string, description: string, dbType: string) => void;
  deleteDataMart: (id: string) => void;

  // Data mart assignment
  assignDataMart: (userId: string, dataMartId: string) => void;
  unassignDataMart: (userId: string, dataMartId: string) => void;

  // Access requests
  approveAccessRequest: (requestId: string) => void;
  rejectAccessRequest: (requestId: string) => void;
}

const initialDataMarts: DataMart[] = [
  {
    id: "1",
    name: "Retail Banking",
    description: "Core retail banking operations including deposits, loans, and branch activities",
    icon: "🏦",
    tables: [
      {
        name: "branches",
        description: "All XYZ Bank branch information and locations",
        rowCount: 1842,
        columns: [
          { name: "branch_id", type: "UUID", nullable: false, description: "Unique branch identifier", isPrimaryKey: true },
          { name: "branch_name", type: "VARCHAR(255)", nullable: false, description: "Official branch name" },
          { name: "region", type: "VARCHAR(100)", nullable: false, description: "Geographic region" },
          { name: "city", type: "VARCHAR(100)", nullable: false, description: "City location" },
          { name: "total_deposits", type: "DECIMAL(18,2)", nullable: true, description: "Total deposit amount in ETB" },
          { name: "total_loans", type: "DECIMAL(18,2)", nullable: true, description: "Total outstanding loans in ETB" },
          { name: "employee_count", type: "INTEGER", nullable: true, description: "Number of employees" },
          { name: "opened_date", type: "DATE", nullable: false, description: "Branch opening date" },
          { name: "is_active", type: "BOOLEAN", nullable: false, description: "Whether branch is currently active" },
        ],
      },
      {
        name: "deposits",
        description: "Customer deposit accounts and balances",
        rowCount: 2450000,
        columns: [
          { name: "deposit_id", type: "UUID", nullable: false, description: "Unique deposit ID", isPrimaryKey: true },
          { name: "account_number", type: "VARCHAR(20)", nullable: false, description: "Customer account number" },
          { name: "customer_id", type: "UUID", nullable: false, description: "Reference to customer", isForeignKey: true },
          { name: "branch_id", type: "UUID", nullable: false, description: "Reference to branch", isForeignKey: true },
          { name: "deposit_type", type: "VARCHAR(50)", nullable: false, description: "Type: savings, checking, time_deposit" },
          { name: "balance", type: "DECIMAL(18,2)", nullable: false, description: "Current balance in ETB" },
          { name: "interest_rate", type: "DECIMAL(5,4)", nullable: true, description: "Annual interest rate" },
          { name: "opened_date", type: "DATE", nullable: false, description: "Account opening date" },
          { name: "status", type: "VARCHAR(20)", nullable: false, description: "Account status: active, dormant, closed" },
        ],
      },
      {
        name: "loans",
        description: "Retail loan products and repayment tracking",
        rowCount: 890000,
        columns: [
          { name: "loan_id", type: "UUID", nullable: false, description: "Unique loan identifier", isPrimaryKey: true },
          { name: "customer_id", type: "UUID", nullable: false, description: "Reference to customer", isForeignKey: true },
          { name: "branch_id", type: "UUID", nullable: false, description: "Originating branch", isForeignKey: true },
          { name: "loan_type", type: "VARCHAR(50)", nullable: false, description: "Type: personal, business, mortgage, agricultural" },
          { name: "principal_amount", type: "DECIMAL(18,2)", nullable: false, description: "Original loan amount in ETB" },
          { name: "outstanding_balance", type: "DECIMAL(18,2)", nullable: false, description: "Remaining balance" },
          { name: "interest_rate", type: "DECIMAL(5,4)", nullable: false, description: "Annual interest rate" },
          { name: "disbursement_date", type: "DATE", nullable: false, description: "Date loan was disbursed" },
          { name: "maturity_date", type: "DATE", nullable: false, description: "Loan maturity date" },
          { name: "status", type: "VARCHAR(20)", nullable: false, description: "Status: active, defaulted, paid_off" },
        ],
      },
      {
        name: "customers",
        description: "Retail banking customer profiles",
        rowCount: 3200000,
        columns: [
          { name: "customer_id", type: "UUID", nullable: false, description: "Unique customer ID", isPrimaryKey: true },
          { name: "full_name", type: "VARCHAR(255)", nullable: false, description: "Customer full name" },
          { name: "customer_type", type: "VARCHAR(20)", nullable: false, description: "individual or business" },
          { name: "phone", type: "VARCHAR(20)", nullable: true, description: "Primary phone number" },
          { name: "email", type: "VARCHAR(255)", nullable: true, description: "Email address" },
          { name: "region", type: "VARCHAR(100)", nullable: true, description: "Customer region" },
          { name: "registration_date", type: "DATE", nullable: false, description: "Date of registration" },
          { name: "kyc_status", type: "VARCHAR(20)", nullable: false, description: "KYC verification status" },
        ],
      },
    ],
    status: "connected",
    users: 45,
    lastSync: "5 min ago",
    dbType: "PostgreSQL",
  },
  {
    id: "2",
    name: "Digital Banking",
    description: "Mobile and internet banking transactions, user registrations, and digital channel metrics",
    icon: "📱",
    tables: [
      {
        name: "mobile_users",
        description: "Mobile banking registered users",
        rowCount: 12500000,
        columns: [
          { name: "user_id", type: "UUID", nullable: false, description: "Unique mobile user ID", isPrimaryKey: true },
          { name: "customer_id", type: "UUID", nullable: false, description: "Link to core customer", isForeignKey: true },
          { name: "device_type", type: "VARCHAR(20)", nullable: false, description: "android, ios, ussd" },
          { name: "registered_at", type: "TIMESTAMP", nullable: false, description: "Registration timestamp" },
          { name: "last_login", type: "TIMESTAMP", nullable: true, description: "Last successful login" },
          { name: "is_active", type: "BOOLEAN", nullable: false, description: "Whether account is active" },
        ],
      },
      {
        name: "digital_transactions",
        description: "All digital channel transactions",
        rowCount: 48000000,
        columns: [
          { name: "txn_id", type: "UUID", nullable: false, description: "Unique transaction ID", isPrimaryKey: true },
          { name: "user_id", type: "UUID", nullable: false, description: "Mobile user reference", isForeignKey: true },
          { name: "txn_type", type: "VARCHAR(50)", nullable: false, description: "transfer, payment, withdrawal, deposit" },
          { name: "amount", type: "DECIMAL(18,2)", nullable: false, description: "Transaction amount in ETB" },
          { name: "channel", type: "VARCHAR(20)", nullable: false, description: "mobile_app, internet_banking, ussd" },
          { name: "status", type: "VARCHAR(20)", nullable: false, description: "success, failed, pending" },
          { name: "created_at", type: "TIMESTAMP", nullable: false, description: "Transaction timestamp" },
        ],
      },
      {
        name: "app_sessions",
        description: "Mobile app usage sessions",
        rowCount: 85000000,
        columns: [
          { name: "session_id", type: "UUID", nullable: false, description: "Session identifier", isPrimaryKey: true },
          { name: "user_id", type: "UUID", nullable: false, description: "User reference", isForeignKey: true },
          { name: "start_time", type: "TIMESTAMP", nullable: false, description: "Session start" },
          { name: "end_time", type: "TIMESTAMP", nullable: true, description: "Session end" },
          { name: "pages_viewed", type: "INTEGER", nullable: true, description: "Number of pages viewed" },
          { name: "platform", type: "VARCHAR(20)", nullable: false, description: "android or ios" },
        ],
      },
    ],
    status: "connected",
    users: 32,
    lastSync: "12 min ago",
    dbType: "PostgreSQL",
  },
  {
    id: "3",
    name: "Loan Portfolio",
    description: "All lending products including personal, business, and mortgage loans",
    icon: "💰",
    tables: [
      {
        name: "loan_applications",
        description: "Loan application submissions and processing",
        rowCount: 450000,
        columns: [
          { name: "application_id", type: "UUID", nullable: false, description: "Application ID", isPrimaryKey: true },
          { name: "customer_id", type: "UUID", nullable: false, description: "Applicant reference", isForeignKey: true },
          { name: "loan_product", type: "VARCHAR(50)", nullable: false, description: "Product type applied for" },
          { name: "requested_amount", type: "DECIMAL(18,2)", nullable: false, description: "Amount requested in ETB" },
          { name: "approved_amount", type: "DECIMAL(18,2)", nullable: true, description: "Approved amount" },
          { name: "decision", type: "VARCHAR(20)", nullable: true, description: "approved, rejected, pending" },
          { name: "submitted_at", type: "TIMESTAMP", nullable: false, description: "Submission timestamp" },
        ],
      },
      {
        name: "repayment_schedule",
        description: "Loan repayment schedules and payments",
        rowCount: 5600000,
        columns: [
          { name: "schedule_id", type: "UUID", nullable: false, description: "Schedule ID", isPrimaryKey: true },
          { name: "loan_id", type: "UUID", nullable: false, description: "Loan reference", isForeignKey: true },
          { name: "due_date", type: "DATE", nullable: false, description: "Payment due date" },
          { name: "amount_due", type: "DECIMAL(18,2)", nullable: false, description: "Amount due" },
          { name: "amount_paid", type: "DECIMAL(18,2)", nullable: true, description: "Amount actually paid" },
          { name: "paid_date", type: "DATE", nullable: true, description: "Actual payment date" },
          { name: "status", type: "VARCHAR(20)", nullable: false, description: "paid, overdue, upcoming" },
        ],
      },
    ],
    status: "connected",
    users: 28,
    lastSync: "8 min ago",
    dbType: "Oracle",
  },
  {
    id: "4",
    name: "Customer Analytics",
    description: "Customer demographics, segmentation, and behavioral data",
    icon: "👥",
    tables: [
      {
        name: "customer_segments",
        description: "Customer segmentation and tier classification",
        rowCount: 3200000,
        columns: [
          { name: "customer_id", type: "UUID", nullable: false, description: "Customer reference", isPrimaryKey: true },
          { name: "segment", type: "VARCHAR(50)", nullable: false, description: "premium, standard, basic" },
          { name: "lifetime_value", type: "DECIMAL(18,2)", nullable: true, description: "Estimated CLV in ETB" },
          { name: "risk_score", type: "DECIMAL(5,2)", nullable: true, description: "Credit risk score 0-100" },
          { name: "churn_probability", type: "DECIMAL(5,4)", nullable: true, description: "Predicted churn probability" },
          { name: "last_updated", type: "TIMESTAMP", nullable: false, description: "Last calculation date" },
        ],
      },
    ],
    status: "syncing",
    users: 18,
    lastSync: "Syncing...",
    dbType: "PostgreSQL",
  },
  {
    id: "5",
    name: "Transaction Data",
    description: "Real-time and historical transaction records across all channels",
    icon: "💳",
    tables: [
      {
        name: "transactions",
        description: "All banking transactions",
        rowCount: 120000000,
        columns: [
          { name: "txn_id", type: "UUID", nullable: false, description: "Transaction ID", isPrimaryKey: true },
          { name: "account_id", type: "UUID", nullable: false, description: "Account reference", isForeignKey: true },
          { name: "txn_type", type: "VARCHAR(30)", nullable: false, description: "debit, credit, transfer" },
          { name: "amount", type: "DECIMAL(18,2)", nullable: false, description: "Transaction amount" },
          { name: "currency", type: "VARCHAR(3)", nullable: false, description: "Currency code" },
          { name: "channel", type: "VARCHAR(30)", nullable: false, description: "branch, atm, mobile, pos" },
          { name: "created_at", type: "TIMESTAMP", nullable: false, description: "Transaction timestamp" },
        ],
      },
    ],
    status: "error",
    users: 15,
    lastSync: "Failed 2 hrs ago",
    dbType: "MySQL",
  },
  {
    id: "6",
    name: "Risk & Compliance",
    description: "Regulatory reporting, AML alerts, and risk assessment data",
    icon: "🛡️",
    tables: [
      {
        name: "aml_alerts",
        description: "Anti-money laundering alerts and investigations",
        rowCount: 34000,
        columns: [
          { name: "alert_id", type: "UUID", nullable: false, description: "Alert ID", isPrimaryKey: true },
          { name: "customer_id", type: "UUID", nullable: false, description: "Flagged customer", isForeignKey: true },
          { name: "alert_type", type: "VARCHAR(50)", nullable: false, description: "Alert category" },
          { name: "severity", type: "VARCHAR(20)", nullable: false, description: "high, medium, low" },
          { name: "status", type: "VARCHAR(20)", nullable: false, description: "open, investigating, closed" },
          { name: "created_at", type: "TIMESTAMP", nullable: false, description: "Alert timestamp" },
        ],
      },
    ],
    status: "connected",
    users: 8,
    lastSync: "30 min ago",
    dbType: "PostgreSQL",
  },
];

const initialUsers: PlatformUser[] = [
  { id: "1", name: "Abebe Kebede", email: "abebe.k@cbe.com.et", role: "admin", status: "active", dept: "IT", assignedDataMarts: ["1", "2", "3", "4", "5", "6"], lastActive: "2 min ago", registeredAt: "2024-01-15" },
  { id: "2", name: "Tigist Haile", email: "tigist.h@cbe.com.et", role: "business_user", status: "active", dept: "Retail Banking", assignedDataMarts: ["1", "3"], lastActive: "15 min ago", registeredAt: "2024-03-10" },
  { id: "3", name: "Solomon Tadesse", email: "solomon.t@cbe.com.et", role: "business_user", status: "active", dept: "Digital Banking", assignedDataMarts: ["2", "4"], lastActive: "1 hr ago", registeredAt: "2024-02-20" },
  { id: "4", name: "Meron Assefa", email: "meron.a@cbe.com.et", role: "business_user", status: "pending", dept: "Risk", assignedDataMarts: [], lastActive: "Never", registeredAt: "2025-03-12" },
  { id: "5", name: "Dawit Gebre", email: "dawit.g@cbe.com.et", role: "business_user", status: "active", dept: "Finance", assignedDataMarts: ["1", "5"], lastActive: "3 hrs ago", registeredAt: "2024-06-05" },
  { id: "6", name: "Hana Mengistu", email: "hana.m@cbe.com.et", role: "business_user", status: "suspended", dept: "Operations", assignedDataMarts: ["2"], lastActive: "1 week ago", registeredAt: "2024-04-18" },
];

const initialAccessRequests: AccessRequest[] = [
  { id: "ar1", userId: "4", userName: "Meron Assefa", userEmail: "meron.a@cbe.com.et", dept: "Risk", requestedAt: "2025-03-12", status: "pending", note: "Need access for quarterly risk reporting" },
];

export const usePlatformStore = create<PlatformStore>((set) => ({
  users: initialUsers,
  dataMarts: initialDataMarts,
  accessRequests: initialAccessRequests,

  registerUser: (name, email, _password, dept) => {
    const id = `user-${Date.now()}`;
    const newUser: PlatformUser = {
      id,
      name,
      email,
      role: "business_user",
      status: "pending",
      dept,
      assignedDataMarts: [],
      lastActive: "Never",
      registeredAt: new Date().toISOString().split("T")[0],
    };
    const newRequest: AccessRequest = {
      id: `ar-${Date.now()}`,
      userId: id,
      userName: name,
      userEmail: email,
      dept,
      requestedAt: new Date().toISOString().split("T")[0],
      status: "pending",
    };
    set((state) => ({
      users: [...state.users, newUser],
      accessRequests: [...state.accessRequests, newRequest],
    }));
    return id;
  },

  approveUser: (userId) =>
    set((state) => ({
      users: state.users.map((u) => (u.id === userId ? { ...u, status: "active" as UserStatus } : u)),
      accessRequests: state.accessRequests.map((r) =>
        r.userId === userId ? { ...r, status: "approved" as const } : r
      ),
    })),

  rejectUser: (userId) =>
    set((state) => ({
      users: state.users.filter((u) => u.id !== userId),
      accessRequests: state.accessRequests.map((r) =>
        r.userId === userId ? { ...r, status: "rejected" as const } : r
      ),
    })),

  suspendUser: (userId) =>
    set((state) => ({
      users: state.users.map((u) => (u.id === userId ? { ...u, status: "suspended" as UserStatus } : u)),
    })),

  activateUser: (userId) =>
    set((state) => ({
      users: state.users.map((u) => (u.id === userId ? { ...u, status: "active" as UserStatus } : u)),
    })),

  assignDataMart: (userId, dataMartId) =>
    set((state) => ({
      users: state.users.map((u) =>
        u.id === userId && !u.assignedDataMarts.includes(dataMartId)
          ? { ...u, assignedDataMarts: [...u.assignedDataMarts, dataMartId] }
          : u
      ),
    })),

  unassignDataMart: (userId, dataMartId) =>
    set((state) => ({
      users: state.users.map((u) =>
        u.id === userId
          ? { ...u, assignedDataMarts: u.assignedDataMarts.filter((id) => id !== dataMartId) }
          : u
      ),
    })),

  approveAccessRequest: (requestId) =>
    set((state) => {
      const request = state.accessRequests.find((r) => r.id === requestId);
      if (!request) return state;
      return {
        accessRequests: state.accessRequests.map((r) =>
          r.id === requestId ? { ...r, status: "approved" as const } : r
        ),
        users: state.users.map((u) =>
          u.id === request.userId ? { ...u, status: "active" as UserStatus } : u
        ),
      };
    }),

  rejectAccessRequest: (requestId) =>
    set((state) => {
      const request = state.accessRequests.find((r) => r.id === requestId);
      if (!request) return state;
      return {
        accessRequests: state.accessRequests.map((r) =>
          r.id === requestId ? { ...r, status: "rejected" as const } : r
        ),
        users: state.users.filter((u) => u.id !== request.userId),
      };
    }),

  addDataMart: (name, description, icon, dbType) =>
    set((state) => ({
      dataMarts: [
        ...state.dataMarts,
        {
          id: `dm-${Date.now()}`,
          name,
          description,
          icon,
          tables: [],
          status: "connected" as DataMartStatus,
          users: 0,
          lastSync: "Just now",
          dbType,
        },
      ],
    })),

  updateDataMart: (id, name, description, dbType) =>
    set((state) => ({
      dataMarts: state.dataMarts.map((m) =>
        m.id === id ? { ...m, name, description, dbType } : m
      ),
    })),

  deleteDataMart: (id) =>
    set((state) => ({
      dataMarts: state.dataMarts.filter((m) => m.id !== id),
      users: state.users.map((u) => ({
        ...u,
        assignedDataMarts: u.assignedDataMarts.filter((mid) => mid !== id),
      })),
    })),
}));
