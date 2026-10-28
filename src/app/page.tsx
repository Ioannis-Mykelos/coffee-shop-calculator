import { HomePage } from "@/components/home/HomePage";
import { auth } from "@/lib/server/auth";
import { authMode } from "@/lib/server/config";

// Accounts or local mode is read when the page is requested, never fixed at build time.
export const dynamic = "force-dynamic";

export default async function Home() {
  // Accounts mode: "Start free" signs up, or opens Crema for someone already logged in. Local mode has no accounts, so
  // it goes straight to the calculator.
  if (authMode() !== "accounts") return <HomePage links={{ start: "/app", login: null, signedIn: false }} />;
  const signedIn = !!(await auth())?.user?.id;
  return <HomePage links={{ start: signedIn ? "/app" : "/login?mode=join", login: "/login", signedIn }} />;
}
