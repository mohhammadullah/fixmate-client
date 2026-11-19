import type { Metadata } from "next";
import { Suspense } from "react";
import SignUpForm from "@/components/auth/SignUpForm";

export const metadata: Metadata = {
  title: "Sign Up",
  description:
    "Create your FixMate account to book verified technicians, track repair jobs and manage devices and home appliances — all in one place.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh]" aria-hidden="true" />}>
      <SignUpForm />
    </Suspense>
  );
}
