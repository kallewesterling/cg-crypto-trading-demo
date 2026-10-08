import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center p-4">
      <h1 className="text-5xl font-extrabold tracking-tight lg:text-6xl">
        Welcome to TradeSim
      </h1>
      <p className="mt-4 max-w-xl text-lg text-muted-foreground">
        Learn the art of crypto trading without any of the risk. Sign up for a
        free demo account and start your journey today.
      </p>
      <div className="mt-8 flex gap-4">
        <Button asChild>
          <Link href="/login">Login</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/register">Create Account</Link>
        </Button>
      </div>
    </div>
  );
}
