# CALQULUS RMS Architecture Diagrams

## System Overview

```mermaid
graph TB
    subgraph "Frontend"
        A[React 19 App]
        B[TypeScript 6]
        C[Vite 8]
        D[Tailwind CSS 3]
        E[React Router 7]
    end
    
    subgraph "Backend"
        F[Supabase Database]
        G[Supabase Auth]
        H[Supabase Storage]
        I[Edge Functions]
    end
    
    subgraph "External Services"
        J[M-Pesa API]
        K[Stripe API]
        L[Resend Email]
        M[Twilio SMS]
        N[Sentry Monitoring]
    end
    
    A --> F
    A --> G
    A --> H
    A --> I
    I --> J
    I --> K
    I --> L
    I --> M
    A --> N
```

## Role-Based Access Control

```mermaid
graph TB
    subgraph "Platform Ownership"
        WA[Webhost Owner]
        WB[Webhost Business]
        WC[Webhost Admin]
    end
    
    subgraph "Property Management"
        MA[Manager]
        MB[Submanager]
        AC[Agency]
    end
    
    subgraph "Property Owners"
        LD[Landlord]
    end
    
    subgraph "Tenants"
        TN[Tenant]
    end
    
    WA --> WB
    WA --> WC
    WB --> WC
    WA --> MA
    WB --> MA
    MA --> MB
    MA --> LD
    AC --> LD
    MA --> TN
    LD --> TN
    
    style WA fill:#e74c3c
    style WB fill:#e67e22
    style WC fill:#f39c12
    style MA fill:#3498db
    style MB fill:#9b59b6
    style AC fill:#1abc9c
    style LD fill:#2ecc71
    style TN fill:#95a5a6
```

## Data Flow: Tenant Registration

```mermaid
sequenceDiagram
    participant M as Manager
    participant F as Frontend
    participant DB as Database
    participant EF as Edge Functions
    participant Email as Email Service
    participant SMS as SMS Service
    
    M->>F: Create tenant invitation
    F->>DB: Insert tenant_invitation
    F->>EF: send-tenant-invitation
    EF->>Email: Send invitation email
    Email->>TN: Invitation link
    TN->>F: Click invitation link
    F->>EF: validate_invitation_token
    EF->>DB: Check token validity
    DB-->>EF: Token valid
    TN->>F: Complete signup
    F->>DB: Create auth user
    F->>DB: Insert user_roles (tenant)
    F->>EF: notify-manager-tenant-signup
    EF->>Email: Notify manager
    EF->>SMS: Send welcome SMS
```

## Data Flow: Payment Processing

```mermaid
sequenceDiagram
    participant T as Tenant
    participant F as Frontend
    participant EF as Edge Functions
    participant MP as M-Pesa API
    participant DB as Database
    participant Email as Email Service
    participant SMS as SMS Service
    
    T->>F: Initiate payment
    F->>EF: mpesa-stk-push
    EF->>MP: STK Push request
    MP-->>T: Push notification
    T->>MP: Enter PIN
    MP-->>EF: Callback
    EF->>DB: Insert payment record
    EF->>DB: Update invoice status
    EF->>EF: log-activity
    EF->>Email: Send receipt email
    EF->>SMS: Send receipt SMS
    EF-->>F: Payment success
    F-->>T: Confirmation
```

## Database Schema Relationships

```mermaid
erDiagram
    users ||--o{ user_roles : "has"
    user_roles }o--|| properties : "manages"
    user_roles }o--|| tenants : "is"
    properties ||--o{ units : "contains"
    units ||--o{ tenants : "occupies"
    units ||--o{ invoices : "billed for"
    tenants ||--o{ invoices : "receives"
    invoices ||--o| payments : "paid by"
    properties ||--o{ property_landlords : "owned by"
    users ||--o{ property_landlords : "owns"
    users ||--o{ platform_admins : "is"
    properties ||--o{ maintenance_requests : "has"
    users ||--o{ maintenance_requests : "submits"
```

## Component Architecture

```mermaid
graph TB
    subgraph "App"
        A[App.tsx]
    end
    
    subgraph "Auth"
        B[AuthContext.tsx]
        C[Auth.tsx]
        D[LandlordAuth.tsx]
        E[TenantAuth.tsx]
        F[WebhostAuth.tsx]
        G[AgencyAuth.tsx]
    end
    
    subgraph "Dashboards"
        H[Dashboard.tsx]
        I[TenantPortal.tsx]
        J[LandlordDashboard.tsx]
        K[WebhostDashboard.tsx]
        L[AgencyDashboard.tsx]
    end
    
    subgraph "Features"
        M[Properties]
        N[Tenants]
        O[Billing]
        P[Maintenance]
        Q[Contracts]
        R[Reports]
        S[Settings]
    end
    
    subgraph "Shared"
        T[useActivityLog]
        U[errorLogger]
        V[validations]
        W[useRBAC]
    end
    
    A --> B
    A --> C
    A --> D
    A --> E
    A --> F
    A --> G
    B --> H
    B --> I
    B --> J
    B --> K
    B --> L
    H --> M
    H --> N
    H --> O
    H --> P
    H --> Q
    H --> R
    H --> S
    M --> T
    N --> T
    O --> T
    P --> T
    M --> U
    N --> U
    O --> U
    M --> V
    N --> V
    O --> V
    M --> W
    N --> W
    O --> W
```

## Deployment Architecture

```mermaid
graph TB
    subgraph "Development"
        A[Local Machine]
        B[Supabase Local]
    end
    
    subgraph "Staging"
        C[Vercel Staging]
        D[Supabase Staging]
    end
    
    subgraph "Production"
        E[Vercel Production]
        F[Supabase Production]
        G[Sentry]
    end
    
    A --> B
    C --> D
    E --> F
    E --> G
    A --> C
    C --> E
    B --> D
    D --> F
    
    style A fill:#95a5a6
    style B fill:#95a5a6
    style C fill:#f39c12
    style D fill:#f39c12
    style E fill:#2ecc71
    style F fill:#2ecc71
    style G fill:#e74c3c
```

## Security Layers

```mermaid
graph TB
    subgraph "Client Security"
        A[HTTPS/TLS]
        B[CSP Headers]
        C[XSS Protection]
    end
    
    subgraph "Authentication"
        D[Supabase Auth]
        E[JWT Tokens]
        F[Session Management]
    end
    
    subgraph "Authorization"
        G[RBAC System]
        H[RLS Policies]
        I[Permission Hooks]
    end
    
    subgraph "Data Security"
        J[Encrypted Secrets]
        K[Webhook Validation]
        L[Audit Logging]
    end
    
    A --> D
    B --> D
    C --> D
    D --> E
    E --> F
    F --> G
    G --> H
    H --> I
    I --> J
    J --> K
    K --> L
```

## Payment Flow Architecture

```mermaid
graph TB
    subgraph "Payment Methods"
        A[M-Pesa STK Push]
        B[M-Pesa Paybill]
        C[Stripe]
        D[Bank Transfer]
        E[Cash]
    end
    
    subgraph "Processing"
        F[Edge Functions]
        G[Database]
        H[Activity Logs]
    end
    
    subgraph "Notifications"
        I[Email Receipt]
        J[SMS Receipt]
        K[Manager Notification]
    end
    
    A --> F
    B --> F
    C --> F
    D --> F
    E --> F
    F --> G
    F --> H
    F --> I
    F --> J
    F --> K
```

## Multi-Portal Architecture

```mermaid
graph TB
    subgraph "Portals"
        WA[/webhost]
        MA[/]
        AC[/agency]
        LD[/landlord/dashboard]
        TN[/portal]
    end
    
    subgraph "Authentication"
        AUTH[AuthContext]
        ROLE[Role Picker]
        PERM[Permission System]
    end
    
    subgraph "Shared Components"
        UI[UI Components]
        HOOKS[Custom Hooks]
        UTILS[Utilities]
    end
    
    WA --> AUTH
    MA --> AUTH
    AC --> AUTH
    LD --> AUTH
    TN --> AUTH
    AUTH --> ROLE
    ROLE --> PERM
    WA --> UI
    MA --> UI
    AC --> UI
    LD --> UI
    TN --> UI
    UI --> HOOKS
    HOOKS --> UTILS
```

## Real-time Data Flow

```mermaid
graph LR
    A[Database Change] --> B[PostgreSQL WAL]
    B --> C[Supabase Realtime]
    C --> D[WebSocket Connection]
    D --> E[Client Subscription]
    E --> F[UI Update]
    
    style A fill:#3498db
    style B fill:#3498db
    style C fill:#3498db
    style D fill:#9b59b6
    style E fill:#9b59b6
    style F fill:#2ecc71
```

## Error Handling Flow

```mermaid
graph TB
    A[Error Occurs] --> B{Error Type?}
    B -->|Network| C[Retry Logic]
    B -->|Validation| D[User Feedback]
    B -->|Auth| E[Redirect to Login]
    B -->|Server| F[Log to Sentry]
    B -->|Unknown| G[Generic Error Message]
    
    C --> H{Success?}
    H -->|Yes| I[Continue]
    H -->|No| J[Show Error]
    
    F --> K[Error Logger]
    K --> L[Activity Log]
    K --> M[Sentry Dashboard]
    
    D --> N[Toast Notification]
    J --> N
    G --> N
```

## State Management Architecture

```mermaid
graph TB
    subgraph "React Query"
        A[Query Cache]
        B[Mutation Cache]
    end
    
    subgraph "Auth Context"
        C[User State]
        D[Session State]
        E[Role State]
    end
    
    subgraph "Local State"
        F[useState]
        G[useReducer]
    end
    
    subgraph "Server State"
        H[Supabase Queries]
        I[RPC Calls]
    end
    
    A --> C
    B --> C
    C --> D
    D --> E
    E --> F
    F --> G
    A --> H
    B --> I
    H --> A
    I --> B
```

## File Upload Flow

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant S as Supabase Storage
    participant DB as Database
    participant EF as Edge Functions
    
    U->>F: Select file
    F->>F: Validate file type/size
    F->>S: Upload to bucket
    S-->>F: File URL
    F->>DB: Update record with URL
    F->>EF: log-activity
    F-->>U: Upload complete
```

## Monitoring & Observability

```mermaid
graph TB
    subgraph "Frontend"
        A[Error Logger]
        B[Performance Metrics]
        C[User Actions]
    end
    
    subgraph "Backend"
        D[Edge Function Logs]
        E[Database Logs]
        F[Activity Logs]
    end
    
    subgraph "Monitoring"
        G[Sentry]
        H[Supabase Dashboard]
        I[Vercel Analytics]
    end
    
    A --> G
    B --> G
    C --> G
    D --> H
    E --> H
    F --> H
    A --> I
    B --> I
```

## Migration Strategy

```mermaid
graph TB
    subgraph "Current State"
        A[Legacy System]
        B[Manual Processes]
    end
    
    subgraph "Migration"
        C[Data Export]
        D[Data Transformation]
        E[Data Import]
        F[Validation]
    end
    
    subgraph "Target State"
        G[CALQULUS RMS Platform]
        H[Automated Workflows]
    end
    
    A --> C
    B --> C
    C --> D
    D --> E
    E --> F
    F --> G
    G --> H
```

## Backup & Recovery

```mermaid
graph TB
    subgraph "Primary"
        A[Supabase Production]
    end
    
    subgraph "Backups"
        B[Daily Backups]
        C[Point-in-Time Recovery]
        D[Storage Backups]
    end
    
    subgraph "Disaster Recovery"
        E[Failover Region]
        F[RTO: 1 hour]
        G[RPO: 5 minutes]
    end
    
    A --> B
    A --> C
    A --> D
    B --> E
    C --> E
    D --> E
```

## API Rate Limiting

```mermaid
graph TB
    subgraph "Request"
        A[Incoming Request]
    end
    
    subgraph "Rate Limiter"
        B[Check Rate Limit]
        C{Within Limit?}
    end
    
    subgraph "Response"
        D[Process Request]
        E[Return 429]
    end
    
    A --> B
    B --> C
    C -->|Yes| D
    C -->|No| E
```

## Cache Strategy

```mermaid
graph TB
    subgraph "Client"
        A[React Query Cache]
        B[Browser Cache]
    end
    
    subgraph "CDN"
        C[Vercel Edge Network]
        D[Asset Caching]
    end
    
    subgraph "Server"
        E[Supabase Cache]
    end
    
    A --> B
    B --> C
    C --> D
    D --> E
```

## Third-Party Integrations

```mermaid
graph TB
    subgraph "Payment"
        A[M-Pesa]
        B[Stripe]
        C[Paystack]
    end
    
    subgraph "Communication"
        D[Resend Email]
        E[Twilio SMS]
        F[Africa's Talking]
    end
    
    subgraph "Monitoring"
        G[Sentry]
    end
    
    subgraph "CALQULUS RMS"
        H[Edge Functions]
    end
    
    A --> H
    B --> H
    C --> H
    D --> H
    E --> H
    F --> H
    H --> G
```
