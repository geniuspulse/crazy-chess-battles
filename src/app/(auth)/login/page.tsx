import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-ccb-primary flex items-center justify-center">
              <span className="text-white font-bold text-xl">♞</span>
            </div>
          </Link>
          <h1 className="text-2xl font-bold mt-4">Welcome back</h1>
          <p className="text-sm text-ccb-muted mt-1">Log in to continue battling</p>
        </div>

        <form className="card space-y-4" action="/api/auth/callback" method="POST">
          <div>
            <label className="text-sm font-medium block mb-1.5">Email</label>
            <input type="email" name="email" className="input" placeholder="you@example.com" required />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Password</label>
            <input type="password" name="password" className="input" placeholder="••••••••" required />
          </div>
          <button type="submit" className="btn-primary w-full">Log in</button>
        </form>

        <p className="text-center text-sm text-ccb-muted mt-6">
          New to CCB?{" "}
          <Link href="/signup" className="text-ccb-primary hover:underline">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
