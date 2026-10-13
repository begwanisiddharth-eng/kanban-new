import { AuthForm } from "@/components/AuthForm";

export const metadata = { title: "Create account - Kanban" };

export default function SignUpPage() {
  return <AuthForm mode="signup" />;
}
