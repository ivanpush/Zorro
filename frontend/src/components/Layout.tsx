import { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {

  return (
    <div className="min-h-screen bg-background dark">
      {/* Main Content - No header */}
      <main className="container mx-auto px-4 py-8">{children}</main>
    </div>
  );
}