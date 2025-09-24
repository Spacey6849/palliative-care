export default function HomePage() {
  return (
    <section className="px-6 sm:px-8 pt-24 pb-16 max-w-5xl mx-auto">
      <header className="text-center mb-10">
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 bg-clip-text text-transparent">Welcome to BinLink AI</h1>
        <p className="mt-3 text-gray-600 dark:text-gray-300 text-base sm:text-lg">Monitor bin fill levels, get alerts, and plan collections smarter — all in one place.</p>
      </header>

      <div className="grid sm:grid-cols-2 gap-5">
        <div className="rounded-2xl border p-5 bg-white/70 dark:bg-neutral-900/60">
          <h2 className="text-lg font-semibold">How it works</h2>
          <ul className="mt-3 list-disc list-inside text-sm text-gray-600 dark:text-gray-300 space-y-1">
            <li>IoT sensors send bin metrics (fill %, lid status) to the cloud.</li>
            <li>Live map shows your bins and status in real time.</li>
            <li>Email alerts notify you if lids stay open or bins reach thresholds.</li>
            <li>AI assistant answers questions about any bin.</li>
          </ul>
        </div>
        <div className="rounded-2xl border p-5 bg-white/70 dark:bg-neutral-900/60">
          <h2 className="text-lg font-semibold">Key features</h2>
          <ul className="mt-3 list-disc list-inside text-sm text-gray-600 dark:text-gray-300 space-y-1">
            <li>Interactive map with popups and filters (Private/Public).</li>
            <li>Realtime updates without page reloads.</li>
            <li>Predictive fill charts using recent history.</li>
            <li>Admin tools to send manual reports.</li>
          </ul>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3 justify-center">
        <a href="/maps" className="inline-flex items-center px-5 py-3 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500">Open Map</a>
        <a href="/auth?mode=signup" className="inline-flex items-center px-5 py-3 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-500">Create Account</a>
        <a href="/auth?mode=login" className="inline-flex items-center px-5 py-3 rounded-xl border text-sm font-medium">Sign In</a>
      </div>
    </section>
  );
}
