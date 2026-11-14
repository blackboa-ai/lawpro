'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/lib/api';
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
    <div className="max-w-2xl mx-auto text-center">
      <h1 className="text-4xl font-bold mb-6 text-gray-900">
        Welcome to LawPro
      </h1>
      <p className="text-lg text-gray-600 mb-8">
        Your professional hearing date tracker
      </p>
      
      <div className="space-y-4">
        <a 
          href="/login"
          className="inline-block w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Sign In
        </a>
        <a
          href="/register"
          className="inline-block w-full border border-blue-600 text-blue-600 py-3 px-6 rounded-lg hover:bg-blue-50 transition-colors"
        >
          Register
        </a>
      </div>
    </div>
  );
}