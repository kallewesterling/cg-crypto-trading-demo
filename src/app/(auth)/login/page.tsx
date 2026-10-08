import { isDevLoginEnabled, listTestAccounts } from "@/lib/dev-login";
import LoginForm from "./login-form";

export default async function LoginPage() {
  const devLoginEnabled = isDevLoginEnabled();
  const testAccounts = await listTestAccounts();

  return (
    <LoginForm devLoginEnabled={devLoginEnabled} testAccounts={testAccounts} />
  );
}
