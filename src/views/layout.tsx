// Every page is wrapped in <Layout>. Keep these props.
import { AsyncLocalStorage } from "node:async_hooks";
import type { Child } from "hono/jsx";

/** Set per request in app.ts, so Layout knows whether to show the signed-in nav without a prop. */
export const signedIn = new AsyncLocalStorage<boolean>();

export function Layout({ title, children }: { title: string; children?: Child }) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title} - NullVoid</title>
        <link rel="stylesheet" href="/static/oat/oat.min.css" />
        <link rel="stylesheet" href="/static/css/style.css" />
        <script src="/static/oat/oat.min.js" defer></script>
        <script type="module" src="/static/js/a11y.js"></script>
      </head>
      <body class="container">
        <a class="skip-link" href="#main">Skip to main content</a>
        <header class="site-header">
          <a class="brand" href="/">NullVoid</a>
          {signedIn.getStore() && (
            <nav aria-label="Main">
              <a href="/account">Account</a>
              <form method="post" action="/logout">
                <button type="submit">Sign out</button>
              </form>
            </nav>
          )}
        </header>
        <div id="status" role="status" aria-live="polite"></div>
        <main id="main">
          <h1>{title}</h1>
          {children}
        </main>
        <footer class="site-footer">
          <p>NullVoid: sign-in built for screen reader and keyboard use.</p>
        </footer>
      </body>
    </html>
  );
}
