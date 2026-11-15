'use client';

import Link from 'next/link';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { CalendarDays, Eye, EyeOff, LoaderCircle } from 'lucide-react';

export const authInputClass =
  'block min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-950 placeholder:text-slate-500 focus:border-indigo-700 focus:outline-2 focus:outline-offset-2 focus:outline-indigo-700 disabled:bg-slate-50';

export function AuthFormLayout({ isRegister = false, children }: {
  isRegister?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby="auth-title"
      className="mx-auto max-w-md overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm md:grid md:max-w-4xl md:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] md:rounded-[2rem]"
    >
      <div className="relative isolate overflow-hidden bg-[#17234a] px-6 py-5 text-white sm:px-8 md:flex md:flex-col md:justify-center md:p-10">
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-32 -z-10 h-72 w-72 rounded-full bg-indigo-500/35 blur-3xl" />
        <div className="flex items-center gap-3 md:block">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-amber-200 md:mb-6 md:size-12">
            <CalendarDays size={21} aria-hidden={true} />
          </span>
          <p className="max-w-[15rem] text-base font-semibold leading-snug tracking-tight md:text-3xl">
            Cases and hearings in one place
          </p>
        </div>
      </div>

      <div className="px-5 py-6 sm:px-8 sm:py-8 md:px-10 md:py-10">
        <h1 id="auth-title" className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
          {isRegister ? 'Create your account' : 'Sign in to LawPro'}
        </h1>
        <div className="mt-6">{children}</div>
        <p className="mt-5 flex flex-wrap items-center gap-x-2 border-t border-slate-200 pt-2 text-sm text-slate-600">
          {isRegister ? 'Already have an account?' : 'New to LawPro?'}
          <Link
            href={isRegister ? '/login' : '/register'}
            className="inline-flex min-h-11 items-center font-semibold text-indigo-800 underline decoration-indigo-300 underline-offset-4 hover:decoration-indigo-800 focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700"
          >
            {isRegister ? 'Sign in' : 'Create an account'}
          </Link>
        </p>
      </div>
    </section>
  );
}

export function AuthPasswordInput(props: Pick<ComponentProps<'input'>, 'autoComplete' | 'value' | 'onChange' | 'minLength' | 'disabled'>) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-slate-800">Password</label>
      <div className="relative">
        <input
          {...props}
          id="password"
          name="password"
          type={visible ? 'text' : 'password'}
          autoCapitalize="none"
          spellCheck={false}
          aria-describedby={props.minLength ? 'password-hint' : undefined}
          className={`${authInputClass} pr-14`}
          required
        />
        <button
          type="button"
          aria-label={visible ? 'Hide password' : 'Show password'}
          onClick={() => setVisible(current => !current)}
          className="absolute end-0.5 top-0.5 inline-flex size-11 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700"
        >
          {visible ? <EyeOff size={18} aria-hidden={true} /> : <Eye size={18} aria-hidden={true} />}
        </button>
      </div>
      {props.minLength && (
        <p id="password-hint" className="mt-1.5 text-sm text-slate-600">Use at least {props.minLength} characters.</p>
      )}
    </div>
  );
}

export function AuthSubmit({ loading, label, pendingLabel }: {
  loading: boolean;
  label: string;
  pendingLabel: string;
}) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-800 px-4 py-2.5 font-semibold text-white hover:bg-indigo-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700 disabled:opacity-70"
    >
      {loading ? pendingLabel : label}
      {loading && <LoaderCircle size={17} className="motion-safe:animate-spin" aria-hidden={true} />}
    </button>
  );
}
