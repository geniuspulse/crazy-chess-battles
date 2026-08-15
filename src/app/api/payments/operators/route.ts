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
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: "Failed to fetch operators" }, { status: 500 });
  }
}
