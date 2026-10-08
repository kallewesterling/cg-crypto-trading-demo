"use client";

import { signInAsTestAccount } from "@/actions/dev-login";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TestAccount } from "@/lib/dev-login";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const formSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});

export default function LoginForm({
  devLoginEnabled,
  testAccounts,
}: {
  devLoginEnabled: boolean;
  testAccounts: TestAccount[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isDevPending, startDevTransition] = useTransition();
  const [selectedEmail, setSelectedEmail] = useState<string>("");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "", password: "" },
  });

  const selectedAccount = testAccounts.find(
    (account) => account.email === selectedEmail
  );

  async function onSubmit(values: z.infer<typeof formSchema>) {
    startTransition(async () => {
      const result = await signIn("credentials", {
        redirect: false,
        email: values.email,
        password: values.password,
      });

      if (result?.error) {
        toast.error("Login Failed", {
          description: "Please check your email and password.",
        });
      } else {
        toast.success("Login Successful!");
        router.push("/dashboard");
        router.refresh();
      }
    });
  }

  function onDevSignIn() {
    if (!selectedEmail) return;

    startDevTransition(async () => {
      const result = await signInAsTestAccount(selectedEmail);
      if (result?.error) {
        toast.error("Login Failed", { description: result.error });
      }
    });
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-zinc-950">
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle>Welcome Back</CardTitle>
        </CardHeader>
        <CardContent>
          {devLoginEnabled ? (
            <div className="mb-6 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Test account</p>
                <Badge variant="outline">Development</Badge>
              </div>
              {testAccounts.length > 0 ? (
                <>
                  <Select value={selectedEmail} onValueChange={setSelectedEmail}>
                    <SelectTrigger className="w-full" aria-label="Test account">
                      <SelectValue placeholder="Choose an account" />
                    </SelectTrigger>
                    <SelectContent>
                      {testAccounts.map((account) => (
                        <SelectItem key={account.email} value={account.email}>
                          {account.name} · {account.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedAccount ? (
                    <p className="text-xs text-muted-foreground">
                      {selectedAccount.summary}
                    </p>
                  ) : null}
                  <Button
                    type="button"
                    className="w-full"
                    disabled={!selectedEmail || isDevPending}
                    onClick={onDevSignIn}
                  >
                    {isDevPending ? "Signing in..." : "Continue as this account"}
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No test accounts are in the local database yet.
                </p>
              )}
              <div className="flex items-center gap-3 pt-1">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">
                  or use email and password
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>
            </div>
          ) : null}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="you@example.com"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? "Logging in..." : "Login"}
              </Button>
            </form>
          </Form>
          <p className="mt-4 text-center text-sm text-gray-600">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="font-semibold text-primary hover:underline"
            >
              Register
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
