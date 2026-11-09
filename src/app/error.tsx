"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="error-page">
      <h1>The workspace couldn’t load.</h1>
      <p>
        Check the Supabase connection and database migration, then try again.
      </p>
      <button className="button primary" onClick={reset}>
        Try again
      </button>
      <a href="/login">Back to sign in</a>
    </main>
  );
}
