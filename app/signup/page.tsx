import { Suspense } from "react";
import SignupForm from "./SignupForm";

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-paper p-10 text-center text-muted">Indlæser…</div>}>
      <SignupForm />
    </Suspense>
  );
}
