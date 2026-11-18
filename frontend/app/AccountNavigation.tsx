'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function AccountNavigation() {
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return null;

  return (
    <ul aria-label="Workspace" className="workspace-nav-links flex flex-wrap items-center gap-1">
      {[
        { href: '/dashboard', name: 'Dashboard' },
        { href: '/legal-intelligence', name: 'Legal Intelligence' },
      ].map(({ href, name }) => (
        <li key={href}>
          <Link
            href={href}
            aria-current={pathname === href ? 'page' : undefined}
            className="workspace-nav-link"
          >
            {name}
          </Link>
        </li>
      ))}
    </ul>
  );
}
