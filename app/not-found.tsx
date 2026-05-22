import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-slate-950/80 p-12 text-center shadow-xl shadow-slate-950/20 backdrop-blur-md">
      <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Page not found</p>
      <h1 className="mt-4 text-4xl font-semibold text-white">We couldn’t find that room.</h1>
      <p className="mt-4 text-sm leading-6 text-slate-300">The room you’re looking for may have been removed or the link is incorrect.</p>
      <Link
        href="/"
        className="mt-8 inline-flex rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
      >
        Return home
      </Link>
    </div>
  );
}
