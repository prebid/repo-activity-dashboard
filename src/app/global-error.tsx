'use client';
export default function GlobalError() {
  return (
    <html lang="en">
      <body>
        <h1>The application could not load</h1>
        <button onClick={() => window.location.reload()}>Try again</button>
      </body>
    </html>
  );
}
