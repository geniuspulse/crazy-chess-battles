import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="text-5xl sm:text-6xl mb-4">♞</div>
        <h1 className="text-xl sm:text-2xl font-bold mb-2">404 — Off the board</h1>
        <p className="text-sm text-ccb-muted mb-6">This page doesn&apos;t exist. Maybe it was captured.</p>
        <Link href="/" className="btn-primary text-sm px-6 py-2.5">Back to Home</Link>
      </div>
    </div>
  );
}
