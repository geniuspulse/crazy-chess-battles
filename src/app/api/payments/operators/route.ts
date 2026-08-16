import { NextResponse } from "next/server";

export async function GET() {
  try {
    const res = await fetch("https://api.paychangu.com/mobile-money", {
      headers: {
        Authorization: `Bearer ${process.env.PAYCHANGU_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      return NextResponse.json({ error: "Unable to load payment operators. Please try again." }, { status: 502 });
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed to fetch operators. Please try again." }, { status: 500 });
  }
}
