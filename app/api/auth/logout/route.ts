import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

export async function POST() {
  const res = NextResponse.json({ success: true });
  // Sprint 6 Batch 2 · B3-c: match flags med login-cookien, så browseren
  // reelt overskriver den. secure:false kun under test.
  const isTest = process.env.NODE_ENV === "test";
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "strict",
    secure: !isTest,
    maxAge: 0,
    path: "/",
  });
  return res;
}
