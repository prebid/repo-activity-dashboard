'use client';
export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <h1>The application could not load</h1>
        <button onClick={reset}>Try again</button>
      </body>
    </html>
  );
}
