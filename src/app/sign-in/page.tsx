import type { Metadata } from "next";
import { Suspense } from "react";
import SignInForm from "@/components/auth/SignInForm";

export const metadata: Metadata = {
  title: "Sign In",
  description:
    "Sign in to your FixMate account to book repairs, track job progress and connect with verified technicians for devices and home appliances.",
};

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh]" aria-hidden="true" />}>
      <SignInForm />
    </Suspense>
  );
}
