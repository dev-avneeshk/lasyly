'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

export default function AppError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-20">
      <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-slate-950/80 p-10 text-center shadow-xl backdrop-blur-md">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10">
          <svg className="h-7 w-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-white">Something went wrong</h2>
        <p className="mt-2 text-sm text-slate-400">
          An unexpected error occurred while loading this page.
        </p>
        {error.digest && (
          <p className="mt-2 text-xs text-slate-500">Error ID: {error.digest}</p>
        )}
        <button
          onClick={() => unstable_retry()}
          className="mt-6 inline-flex rounded-full bg-[var(--color-lime)] px-6 py-2.5 text-sm font-semibold text-slate-950 transition hover:opacity-90"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
