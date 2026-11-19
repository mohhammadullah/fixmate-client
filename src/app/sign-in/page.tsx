import type { Metadata } from "next";
import SignInForm from "@/components/auth/SignInForm";

export const metadata: Metadata = {
  title: "Sign In",
  description:
    "Sign in to your FixMate account to book repairs, track job progress and connect with verified technicians for devices and home appliances.",
};

export default function SignInPage() {
  return <SignInForm />;
}
