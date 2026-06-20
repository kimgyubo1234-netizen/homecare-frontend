import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useIsAuthenticated } from '@/lib/auth-store';

interface Props {
  children: ReactNode;
}

export default function AuthGuard({ children }: Props) {
  const isAuthenticated = useIsAuthenticated();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
