# CBE AI Data Analysis Platform

An enterprise-grade AI-powered data analysis and transformation platform for Commercial Bank of Ethiopia. This platform enables business users to query data marts using natural language while providing administrators with comprehensive governance and analytics controls.

## Features

### For Business Users
- **Natural Language Queries**: Ask questions about data using plain English
- **Multiple Data Marts**: Access to assigned data marts (Retail Banking, Digital Banking, etc.)
- **Chat Interface**: Modern ChatGPT-style conversational interface
- **Chat History**: View and manage previous conversations
- **Real-time Results**: Get instant insights from your data queries

### For Administrators
- **User Management**: Approve/reject registrations, manage user status
- **Data Mart Management**: Create and configure data sources
- **Access Control**: Assign users to specific data marts
- **Analytics Dashboard**: Monitor platform usage and query statistics
- **Query Logs**: Audit trail of all queries for security and compliance

## User Roles

### Business User
- Register and request access
- Query assigned data marts
- View chat history
- Access natural language AI assistant

### Administrator
- Full platform management
- Approve/suspend users
- Create and manage data marts
- View analytics and usage statistics
- Manage access permissions

## Technology Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL (via Supabase)
- **Authentication**: Supabase Auth
- **Icons**: Lucide React

## Design System

The platform follows Commercial Bank of Ethiopia's corporate branding guidelines:

### Colors
- **Primary Green**: `#007A3D` - Main actions, buttons, navigation
- **Dark Green**: `#005B2E` - Secondary elements
- **Gold**: `#CFAE3D` - Accent color for highlights
- **Light Gray**: `#F5F7F6` - Background
- **Dark Gray**: `#2E2E2E` - Text

### Typography
- Clean, professional fonts (Inter/Roboto)
- Clear hierarchy
- Professional banking aesthetic

## Getting Started

### Prerequisites
- Node.js 18+
- Supabase account

### Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Set up environment variables in `.env`:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Run the development server:
```bash
npm run dev
```

### Database Setup

The database schema is automatically created through Supabase migrations. It includes:

- **user_profiles**: Extended user information with roles and status
- **data_marts**: Data source definitions
- **user_data_mart_access**: Role-based access control
- **chat_conversations**: Chat sessions
- **chat_messages**: Individual messages
- **query_logs**: Audit trail

### Creating an Admin User

To create the first administrator:

1. Register through the application
2. Use Supabase dashboard to update the user:
   - Set `role` to `'admin'`
   - Set `status` to `'active'`

Or execute SQL in Supabase SQL Editor:
```sql
UPDATE user_profiles
SET role = 'admin', status = 'active'
WHERE email = 'your-email@cbe.com.et';
```

## Usage

### For Business Users

1. **Register**: Create an account with your CBE email
2. **Wait for Approval**: Administrator will approve your account
3. **Select Data Mart**: Choose which data source to query
4. **Ask Questions**: Use natural language to query data
5. **View History**: Access previous conversations

Example queries:
- "Show total retail loan growth for the last 12 months"
- "Compare digital banking users by region"
- "Which branch has the highest deposit growth?"

### For Administrators

1. **Approve Users**: Review pending registrations in User Management
2. **Create Data Marts**: Add data sources in Data Mart Management
3. **Grant Access**: Assign users to specific data marts
4. **Monitor Activity**: View analytics in Admin Dashboard

## Security Features

- **Row-Level Security (RLS)**: Database-level access control
- **Role-Based Access Control (RBAC)**: User and admin permissions
- **Query Logging**: Full audit trail of all queries
- **Session Management**: Secure authentication
- **Status Management**: Pending/Active/Suspended user states

## Architecture

### Frontend
- React components with TypeScript for type safety
- Context API for authentication state
- Hash-based routing for page navigation
- Responsive design for all screen sizes

### Backend
- Supabase PostgreSQL database
- Real-time subscriptions for updates
- Row-level security policies
- Automatic timestamps and triggers

### Database Schema
- Normalized relational design
- Foreign key constraints
- Indexed for performance
- Secure with RLS policies

## Future Enhancements

- Integration with actual AI/LLM for query generation
- Real database connections to CBE data sources
- Advanced analytics and reporting
- Export functionality (CSV, Excel, PDF)
- Scheduled reports
- Multi-language support (English, Amharic)
- Data visualization and charts
- Advanced query builder

## License

Proprietary - Commercial Bank of Ethiopia

## Support

For technical support or questions, contact the platform administrator.
