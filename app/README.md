# Njugush Enterprises POS - Frontend

A modern React-based frontend for the Njugush Enterprises POS & Inventory Management System.

## 🚀 Tech Stack

- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **State Management**: Zustand
- **Data Fetching**: TanStack Query (React Query)
- **Routing**: React Router DOM
- **Charts**: Recharts
- **Date Handling**: date-fns

## 📁 Project Structure

```
src/
├── api/              # API client and endpoints
├── components/       # Reusable UI components
│   ├── layout/       # Layout components (Sidebar, Header)
│   └── ui/           # shadcn/ui components
├── pages/            # Page components
│   ├── auth/         # Authentication pages
│   ├── admin/        # Super Admin pages
│   ├── manager/      # Manager pages
│   └── branch/       # Branch Manager pages
├── store/            # Zustand state management
├── types/            # TypeScript type definitions
├── utils/            # Utility functions
├── App.tsx           # Main app component with routing
└── main.tsx          # Entry point
```

## 🛠️ Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your API URL
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```

The app will be available at `http://localhost:5173`

## 🔐 Authentication Flow

1. User enters email and password
2. System validates credentials
3. If device is not recognized, device authorization is required
4. Admin/Manager provides authorization code
5. User gains access to the system

## 👥 User Roles

### Super Admin (CEO)
- Full access to all features
- User management
- Branch management
- Product management
- Inventory control
- Reports and analytics

### Overall Manager
- Read-only access to all branches
- Device approval
- Reports viewing
- Audit logs access

### Branch Manager
- Limited to assigned branch
- Create sales (cash and invoice)
- View branch inventory
- Request returns
- View sales history

## 📱 Key Features

### POS Interface
- Product grid with categories
- Shopping cart management
- Customer information
- Cash and Invoice sales
- Real-time stock checking

### Inventory Management
- Stock levels per branch
- Low stock alerts
- Cylinder tracking (full/empty)
- Reconciliation reports

### Sales Management
- Daily sales summary
- Sales history
- Return processing
- Invoice management

### Reporting
- Sales reports
- Inventory reports
- User performance
- Cylinder reconciliation

## 🎨 UI Components

The project uses shadcn/ui components:
- Button, Card, Input, Label
- Dialog, Dropdown Menu, Tabs
- Table, Badge, Avatar
- Toast notifications (Sonner)
- And more...

## 🔧 Development

### Available Scripts

```bash
npm run dev        # Start development server
npm run build      # Build for production
npm run preview    # Preview production build
npm run lint       # Run ESLint
```

### Adding New Components

```bash
npx shadcn add <component-name>
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `http://localhost:3000/api` |
| `VITE_APP_NAME` | App name | `Njugush POS` |

## 🚢 Deployment

### Build for Production

```bash
npm run build
```

The build output will be in the `dist/` directory.

### Vercel Deployment

1. Connect your GitHub repository to Vercel
2. Set environment variables
3. Deploy automatically on push

## 📞 Support

For issues or questions, contact the development team.

---

**Njugush Enterprises** - Built with React & Tailwind CSS
