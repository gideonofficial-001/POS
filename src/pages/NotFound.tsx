import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Home } from 'lucide-react'

const NotFound = () => {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center space-y-4">
        <h1 className="text-6xl font-bold text-primary">404</h1>
        <h2 className="text-2xl font-semibold">Page Not Found</h2>
        <p className="text-muted-foreground max-w-md">
          The page you are looking for does not exist or you do not have permission to access it.
        </p>
        <Button asChild>
          <Link to="/" className="flex items-center gap-2">
            <Home className="w-4 h-4" />
            Go Home
          </Link>
        </Button>
      </div>
    </div>
  )
}

export default NotFound