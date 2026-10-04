import type { Child } from "hono/jsx";

export function Layout({
  title,
  children,
}: {
  title: string;
  children?: Child;
}) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />

        <title>{title} - NullVoid</title>

        <link rel="stylesheet" href="/static/css/style.css" />

        <script
          type="module"
          src="/static/js/a11y.js"
        ></script>
      </head>

      <body>
        <a class="skip-link" href="#main">
          Skip to main content
        </a>

        <header>
          <p class="site-name">NullVoid</p>
        </header>

        <div
          id="status"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        ></div>

        <main id="main">
          <h1>{title}</h1>

          {children}
        </main>
      </body>
    </html>
  );
}