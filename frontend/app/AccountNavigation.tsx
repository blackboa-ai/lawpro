'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function AccountNavigation() {
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return null;

  return (
    <ul aria-label="Workspace" className="flex flex-wrap items-center gap-1 text-sm font-medium sm:gap-3">
      {[
        { href: '/dashboard', name: 'Dashboard' },
        { href: '/legal-intelligence', name: 'Legal Intelligence' },
      ].map(({ href, name }) => (
        <li key={href}>
          <Link
            href={href}
            aria-current={pathname === href ? 'page' : undefined}
            className="inline-flex min-h-11 items-center rounded-lg px-3 text-slate-200 hover:bg-slate-800 aria-[current=page]:bg-slate-800 aria-[current=page]:text-amber-200"
          >
            {name}
          </Link>
        </li>
      ))}
    </ul>
  );
}
