'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated: isLoggedIn } = useAuth();

  useEffect(() => {
    if (isLoggedIn) {
      router.push('/dashboard');
    }
  }, [isLoggedIn, router]);

  if (isLoggedIn) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">Redirecting to dashboard...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl rounded-3xl bg-slate-900 px-6 py-12 text-white sm:px-12 sm:py-16">
      <h1 className="max-w-xl text-4xl font-semibold tracking-tight sm:text-6xl">
        Keep track of cases and hearing dates.
      </h1>
      <p className="mt-5 max-w-lg text-base text-slate-300 sm:text-lg">
        LawPro gives Indian lawyers one place to see case statuses and upcoming hearings.
      </p>
      
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/login"
          className="rounded-lg bg-amber-300 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-amber-200"
        >
          Sign In
        </Link>
        <Link
          href="/register"
          className="rounded-lg border border-slate-500 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Register
        </Link>
      </div>
    </div>
  );
}
