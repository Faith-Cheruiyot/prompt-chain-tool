import { redirect } from "next/navigation";
import { configured } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { ThemeSwitch } from "@/components/theme-switch";
import {
  ArrowRight,
  GitBranch,
  ShieldCheck,
  Sparkles,
  Image,
  Type,
  Check,
} from "lucide-react";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  let authenticated = false;
  try {
    await requireAdmin();
    authenticated = true;
  } catch {
    /* The sign-in page remains public. */
  }
  if (authenticated) redirect("/");
  const ready = configured();
  return (
    <main className="login-layout">
      <section className="login-story">
        <a href="/" className="brand">
          <span className="brand-icon">
            <GitBranch size={22} />
          </span>
          chain<span className="brand-light">studio</span>
          <span className="brand-dot">.</span>
        </a>
        <div className="story-body">
          <span className="eyebrow">
            <span className="small-dot" /> A LITTLE INPUT. ENDLESS POSSIBILITY.
          </span>
          <h1>
            Great ideas
            <br />
            happen in
            <br />
            <em>sequence.</em>
          </h1>
          <p>
            Connect your prompts. Shape every step.
            <br />
            Turn one idea into something unexpected.
          </p>
          <div className="story-flow">
            <div>
              <span className="flow-icon">
                <Image size={18} />
              </span>
              <span>
                <strong>See the story</strong>
                <small>Image → description</small>
              </span>
              <Check size={16} />
            </div>
            <span className="flow-line" />
            <div>
              <span className="flow-icon">
                <Sparkles size={18} />
              </span>
              <span>
                <strong>Find the funny</strong>
                <small>Description → a new perspective</small>
              </span>
              <Check size={16} />
            </div>
            <span className="flow-line" />
            <div>
              <span className="flow-icon">
                <Type size={18} />
              </span>
              <span>
                <strong>Make it memorable</strong>
                <small>One idea → five great captions</small>
              </span>
              <ArrowRight size={16} />
            </div>
          </div>
        </div>
        <div className="story-footer">
          A workspace for your creative process.<span>01 — ∞</span>
        </div>
      </section>
      <section className="login-main">
        <div className="login-top">
          <span>
            <ShieldCheck size={15} /> Private workspace
          </span>
          <ThemeSwitch />
        </div>
        <div className="login-card">
          <span className="section-kicker">WELCOME TO CHAIN STUDIO</span>
          <h2>
            Your next idea
            <br />
            starts here.
          </h2>
          <p>Sign in to build, manage, and run your prompt chains.</p>
          {error && (
            <div role="alert" className="notice error">
              {error === "access"
                ? "Superadmin access is required. Sign in with the Google account linked to your superadmin profile."
                : "Sign-in could not finish. Please try again. If it continues, check the Supabase Google provider and redirect URL settings."}
            </div>
          )}
          {!ready ? (
            <div className="notice">
              Connect the Supabase environment variables to enable sign-in.
            </div>
          ) : (
            <a href="/auth/login" className="google-button">
              <svg
                width="19"
                height="19"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  fill="currentColor"
                  d="M21.6 12.2c0-.7-.1-1.5-.2-2.2H12v4h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.8 3-4.3 3-7.3ZM12 22c2.7 0 5-.9 6.6-2.5L15.4 17c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.2H3.1v2.6A10 10 0 0 0 12 22ZM6.4 13.8a6 6 0 0 1 0-3.6V7.6H3.1a10 10 0 0 0 0 8.8l3.3-2.6ZM12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.9 5.6l3.3 2.6C7.2 7.8 9.4 6 12 6Z"
                />
              </svg>{" "}
              Continue with Google <ArrowRight size={17} />
            </a>
          )}
          <div className="login-access">
            <ShieldCheck size={17} />
            <p>
              Made for the people behind the prompts.
              <br />
              <span>Access is limited to approved superadmins.</span>
            </p>
          </div>
          {error === "access" && (
            <form action="/auth/logout" method="post">
              <button className="text-button">Sign out of this account</button>
            </form>
          )}
        </div>
        <div className="login-bottom">
          BUILD WITH INTENTION. CREATE WITH CURIOSITY.
        </div>
      </section>
    </main>
  );
}
