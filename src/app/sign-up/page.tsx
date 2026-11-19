import type { Metadata } from "next";
import SignUpForm from "@/components/auth/SignUpForm";

export const metadata: Metadata = {
  title: "Sign Up",
  description:
    "Create your FixMate account to book verified technicians, track repair jobs and manage devices and home appliances — all in one place.",
};

export default function SignUpPage() {
  return <SignUpForm />;
}
