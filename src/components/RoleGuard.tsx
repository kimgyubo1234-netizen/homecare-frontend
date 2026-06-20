import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore, useIsAuthenticated } from '@/lib/auth-store';
import type { UserRole } from '@/types/api';

interface Props {
  children: ReactNode;
  role: UserRole;
}

export default function RoleGuard({ children, role }: Props) {
  const isAuthenticated = useIsAuthenticated();
  const user = useAuthStore((s) => s.user);

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role !== role) {
    return <Navigate to={user?.role === 'admin' ? '/admin' : '/dashboard'} replace />;
  }
  return <>{children}</>;
}
