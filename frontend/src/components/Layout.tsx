import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const isReviewRoute = location.pathname.startsWith('/review');

  return (
    <div className="min-h-screen bg-background dark">
      {/* Main Content - No header */}
      <main className={`container mx-auto px-4 ${isReviewRoute ? 'py-0' : 'py-8'}`}>{children}</main>
    </div>
  );
}