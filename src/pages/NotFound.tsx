import type { ReactNode } from "react";
import { Link, isRouteErrorResponse, useRouteError } from "react-router-dom";
import { Logo } from "@/components/ui";
import { buttonClass } from "@/lib/cx";

function Shell({ code, title, body, children }: { code: string; title: string; body: string; children?: ReactNode }) {
  return (
    <main id="main" className="grid min-h-[100dvh] place-items-center bg-canvas px-6">
      <div className="max-w-md text-center">
        <Link to="/" className="inline-block rounded-md">
          <Logo />
        </Link>
        <p className="mt-10 text-sm font-semibold text-accent">{code}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-fg">{title}</h1>
        <p className="mt-3 text-muted">{body}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/app" className={buttonClass("primary")}>Go to dashboard</Link>
          <Link to="/" className={buttonClass("secondary")}>Home</Link>
        </div>
        {children}
      </div>
    </main>
  );
}

export default function NotFound() {
  return <Shell code="404" title="Page not found" body="This page doesn't exist. It may have moved, or the link was mistyped." />;
}

/** Route-level error screen: a page crashed or failed to download (for example after a redeploy). */
export function RouteError() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFound />;
  const message = error instanceof Error ? error.message : String(error);
  const chunkFailed = /dynamically imported module|Failed to fetch|Importing a module script failed/i.test(message);
  return (
    <Shell
      code="Error"
      title="Something went wrong"
      body={chunkFailed ? "Part of the app couldn't be downloaded. Check your connection, or reload to get the latest version." : "This page hit an unexpected error. Reloading usually fixes it."}
    >
      <button type="button" onClick={() => window.location.reload()} className={buttonClass("ghost", "sm", "mt-4")}>
        Reload page
      </button>
      <details className="mt-6 text-left text-sm text-muted">
        <summary className="cursor-pointer">Technical details</summary>
        <pre className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-subtle p-3 text-xs">{message}</pre>
      </details>
    </Shell>
  );
}
