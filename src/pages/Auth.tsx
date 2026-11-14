import { api } from "@/convex/_generated/api";
import { CartNestMark } from "@/components/shop/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { DEMO_ACCOUNT } from "@/lib/shop";
import { cn } from "@/lib/utils";
import { useMutation } from "convex/react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Heart,
  Loader2,
  Mail,
  Package,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  UserRound,
} from "lucide-react";
import { Suspense, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";

type Mode = "signin" | "register";

function resolveRedirect(returnTo: string | null, fallback = "/account") {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) return returnTo;
  return fallback;
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function Auth({ redirectAfterAuth = "/account" }: { redirectAfterAuth?: string }) {
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirect(searchParams.get("returnTo"), redirectAfterAuth);
  const [mode, setMode] = useState<Mode>(
    searchParams.get("mode") === "register" ? "register" : "signin",
  );
  const [step, setStep] = useState<"form" | "code">("form");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [pendingSignup, setPendingSignup] = useState<{ name: string; phone: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const manualRedirect = useRef(false);
  const saveSignupDetails = useMutation(api.profiles.saveSignupDetails);
  const ensureDemoProfile = useMutation(api.profiles.ensureDemoProfile);
  const claimDemoStaff = useMutation(api.profiles.claimDemoStaff);

  useEffect(() => {
    if (!authLoading && isAuthenticated && !manualRedirect.current) {
      navigate(redirect, { replace: true });
    }
  }, [authLoading, isAuthenticated, navigate, redirect]);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setStep("form");
    setOtp("");
    setPendingSignup(null);
  }

  async function handleRequestCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const emailValue = String(data.get("email") ?? "").trim();

    if (mode === "register") {
      const name = String(data.get("full_name") ?? "").trim();
      const phone = String(data.get("phone") ?? "").trim();
      if (name.length < 3) {
        setError("Enter your full name (at least 3 characters).");
        return;
      }
      if (!/^(\+91[\s-]?)?[6-9]\d{9}$/.test(phone.replace(/[\s-]/g, ""))) {
        setError("Enter a valid 10-digit Indian mobile number.");
        return;
      }
      setPendingSignup({ name, phone });
    }

    setLoading(true);
    setError(null);
    try {
      const payload = new FormData();
      payload.set("email", emailValue);
      await signIn("email-otp", payload);
      setEmail(emailValue);
      setStep("code");
      toast.success("Verification code sent", {
        description: `Check ${emailValue} for a 6-digit demo sign-in code.`,
      });
    } catch (signInError) {
      setError(
        signInError instanceof Error
          ? signInError.message
          : "Could not send the verification code. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (otp.length !== 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload = new FormData();
      payload.set("email", email);
      payload.set("code", otp);
      manualRedirect.current = true;
      await signIn("email-otp", payload);

      if (pendingSignup) {
        for (let attempt = 0; attempt < 4; attempt++) {
          try {
            await saveSignupDetails(pendingSignup);
            break;
          } catch {
            await sleep(450);
          }
        }
        setPendingSignup(null);
      }

      toast.success("Welcome to CartNest", { description: "You are signed in." });
      navigate(redirect, { replace: true });
    } catch {
      setError("That code did not work. Check the latest email and try again.");
      setOtp("");
    } finally {
      setLoading(false);
    }
  }

  async function handleStaffLogin() {
    setLoading(true);
    setError(null);
    try {
      manualRedirect.current = true;
      await signIn("anonymous");

      let enabled = false;
      for (let attempt = 0; attempt < 4 && !enabled; attempt++) {
        try {
          await claimDemoStaff({});
          enabled = true;
        } catch {
          await sleep(450);
        }
      }

      toast.success("Staff workspace ready", {
        description: enabled
          ? "Administrator access is enabled for this demo session."
          : "Signed in. Open the staff workspace to enable access.",
      });
      navigate("/admin", { replace: true });
    } catch (staffError) {
      setError(
        staffError instanceof Error
          ? staffError.message
          : "Could not open the staff workspace. Please try again.",
      );
      setLoading(false);
    }
  }

  async function handleDemoLogin() {
    setLoading(true);
    setError(null);
    try {
      manualRedirect.current = true;
      await signIn("anonymous");

      let seeded = false;
      for (let attempt = 0; attempt < 4 && !seeded; attempt++) {
        try {
          await ensureDemoProfile({});
          seeded = true;
        } catch {
          await sleep(450);
        }
      }

      toast.success("Demo account ready", {
        description: seeded
          ? "Synthetic profile, saved addresses and sample orders loaded."
          : "Signed in as a demo guest. You can still shop and check out.",
      });
      navigate(redirect, { replace: true });
    } catch (demoError) {
      setError(
        demoError instanceof Error
          ? demoError.message
          : "Could not open the demo account. Please try again.",
      );
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[0.95fr_1.05fr]">
      <aside className="relative hidden overflow-hidden bg-[oklch(0.235_0.035_264)] p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute -right-24 top-1/4 size-[420px] rounded-full bg-[oklch(0.6_0.15_280)] opacity-25 blur-3xl"
          aria-hidden="true"
        />
        <Link to="/" className="relative flex items-center gap-2.5" aria-label="CartNest home">
          <CartNestMark className="size-9" />
          <span className="text-[19px] font-extrabold tracking-[-0.03em]">CartNest</span>
        </Link>

        <div className="relative max-w-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">
            Everything you love, all in one place
          </p>
          <p className="display-serif mt-4 text-[38px] leading-[1.12]">
            Considered essentials,{" "}
            <span className="italic text-[oklch(0.85_0.09_285)]">delivered with care</span>.
          </p>
          <ul className="mt-7 space-y-3 text-sm text-white/70">
            {[
              { icon: Package, copy: "30 curated products across five departments" },
              { icon: ShoppingBag, copy: "A cart and coupon flow that actually works" },
              { icon: Heart, copy: "Wishlist and saved addresses in one place" },
              { icon: ShieldCheck, copy: "Demo payments only — no card details, ever" },
            ].map(({ icon: Icon, copy }) => (
              <li key={copy} className="flex items-start gap-2.5">
                <Icon className="mt-0.5 size-4 shrink-0 text-[oklch(0.82_0.08_285)]" aria-hidden="true" />
                {copy}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/45">
            Synthetic demo customer
          </p>
          <p className="mt-1.5 text-sm font-semibold">{DEMO_ACCOUNT.name}</p>
          <p className="text-[11px] text-white/55">{DEMO_ACCOUNT.email}</p>
          <p className="text-[11px] text-white/55">{DEMO_ACCOUNT.phone}</p>
          <p className="mt-2 text-[10px] leading-4 text-white/40">
            One click loads this profile with two saved addresses and three sample orders.
          </p>
        </div>
      </aside>

      <main className="flex min-h-screen flex-col">
        <div className="flex items-center justify-between px-5 py-4 sm:px-8">
          <Link to="/" className="flex items-center gap-2" aria-label="CartNest home">
            <CartNestMark className="size-8" />
            <span className="text-base font-extrabold tracking-[-0.03em] lg:hidden">
              Cart<span className="text-primary">Nest</span>
            </span>
          </Link>
          <Link
            to="/shop"
            className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" /> Continue browsing
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center px-5 pb-12 pt-4 sm:px-8">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="w-full max-w-[420px]"
          >
            <div className="rounded-3xl border border-border/80 bg-card p-6 sm:p-7">
              {step === "form" ? (
                <>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-accent-foreground">
                    <Sparkles className="size-3" aria-hidden="true" />
                    {mode === "signin" ? "Welcome back" : "New customer"}
                  </span>
                  <h1 className="mt-3 text-[26px] font-bold leading-tight tracking-tight">
                    {mode === "signin" ? "Sign in to CartNest" : "Create your account"}
                  </h1>
                  <p className="mt-1.5 text-[12.5px] leading-5 text-muted-foreground">
                    {mode === "signin"
                      ? "We email you a 6-digit code — there is no password to remember or store."
                      : "We verify your email with a 6-digit code, then save your demo profile."}
                  </p>

                  <div
                    className="mt-5 grid grid-cols-2 gap-1 rounded-full bg-secondary p-1"
                    role="tablist"
                    aria-label="Sign in or register"
                  >
                    {(["signin", "register"] as const).map((option) => (
                      <button
                        key={option}
                        type="button"
                        role="tab"
                        aria-selected={mode === option}
                        data-testid={`auth-mode-${option}`}
                        onClick={() => switchMode(option)}
                        className={cn(
                          "rounded-full px-3 py-2 text-xs font-semibold transition-colors",
                          mode === option
                            ? "bg-card text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {option === "signin" ? "Sign in" : "Create account"}
                      </button>
                    ))}
                  </div>

                  <form onSubmit={handleRequestCode} className="mt-5 space-y-4" data-testid="auth-form">
                    {mode === "register" && (
                      <>
                        <div>
                          <Label htmlFor="full_name" className="text-xs font-semibold">
                            Full name
                          </Label>
                          <Input
                            id="full_name"
                            name="full_name"
                            autoComplete="name"
                            data-testid="register-name"
                            placeholder="Ananya Deshpande"
                            className="mt-1.5 h-10"
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="phone" className="text-xs font-semibold">
                            Phone number
                          </Label>
                          <Input
                            id="phone"
                            name="phone"
                            type="tel"
                            autoComplete="tel"
                            data-testid="register-phone"
                            placeholder="+91 98200 45512"
                            className="mt-1.5 h-10"
                            required
                          />
                          <p className="mt-1 text-[10.5px] text-muted-foreground">
                            Demo profiles use synthetic Indian mobile numbers.
                          </p>
                        </div>
                      </>
                    )}

                    <div>
                      <Label htmlFor="email" className="text-xs font-semibold">
                        Email address
                      </Label>
                      <div className="relative mt-1.5">
                        <Mail
                          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          autoComplete="email"
                          data-testid="auth-email"
                          placeholder="you@example.com"
                          className="h-10 pl-9"
                          required
                        />
                      </div>
                    </div>

                    {error && (
                      <p
                        role="alert"
                        data-testid="auth-error"
                        className="rounded-lg bg-destructive/5 px-3 py-2 text-xs font-medium text-destructive"
                      >
                        {error}
                      </p>
                    )}

                    <Button
                      type="submit"
                      disabled={loading}
                      className="h-11 w-full rounded-full"
                      data-testid="auth-submit"
                    >
                      {loading ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      ) : null}
                      {mode === "signin" ? "Send sign-in code" : "Create account & send code"}
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </Button>
                  </form>

                  <div className="my-5 flex items-center gap-3">
                    <span className="h-px flex-1 bg-border" />
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      or
                    </span>
                    <span className="h-px flex-1 bg-border" />
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full rounded-full bg-card"
                    onClick={() => void handleDemoLogin()}
                    disabled={loading}
                    data-testid="demo-login"
                  >
                    <UserRound className="size-4" aria-hidden="true" />
                    Continue with demo account
                  </Button>
                  <p className="mt-2 text-center text-[10.5px] text-muted-foreground">
                    Loads {DEMO_ACCOUNT.name} with synthetic orders and addresses.
                  </p>

                  <button
                    type="button"
                    onClick={() => void handleStaffLogin()}
                    disabled={loading}
                    data-testid="staff-login"
                    className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                  >
                    <ShieldCheck className="size-3.5" aria-hidden="true" />
                    Open the demo staff workspace
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setStep("form");
                      setError(null);
                      setOtp("");
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                  >
                    <ArrowLeft className="size-3.5" aria-hidden="true" /> Change email
                  </button>
                  <h1 className="mt-3 text-[26px] font-bold leading-tight tracking-tight">
                    Check your email
                  </h1>
                  <p className="mt-1.5 text-[12.5px] leading-5 text-muted-foreground">
                    We sent a 6-digit code to{" "}
                    <span className="font-semibold text-foreground">{email}</span>. It expires in 15
                    minutes.
                  </p>

                  <form onSubmit={handleVerifyCode} className="mt-6" data-testid="otp-form">
                    <input type="hidden" name="email" value={email} />
                    <input type="hidden" name="code" value={otp} />
                    <div className="flex justify-center">
                      <InputOTP
                        value={otp}
                        onChange={setOtp}
                        maxLength={6}
                        disabled={loading}
                        aria-label="Six digit verification code"
                      >
                        <InputOTPGroup>
                          {Array.from({ length: 6 }).map((_, index) => (
                            <InputOTPSlot key={index} index={index} />
                          ))}
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                    {error && (
                      <p
                        role="alert"
                        className="mt-3 text-center text-xs font-medium text-destructive"
                      >
                        {error}
                      </p>
                    )}
                    <Button
                      type="submit"
                      disabled={loading || otp.length !== 6}
                      className="mt-5 h-11 w-full rounded-full"
                      data-testid="verify-code"
                    >
                      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                      Verify and continue
                    </Button>
                  </form>

                  <div className="mt-4 rounded-xl bg-secondary/70 px-3.5 py-3 text-[11px] leading-5 text-muted-foreground">
                    Demo tip: email delivery depends on the demo gateway. If you don't receive a
                    code, use{" "}
                    <button
                      type="button"
                      onClick={() => void handleDemoLogin()}
                      className="font-semibold text-primary underline-offset-2 hover:underline"
                    >
                      the one-click demo account
                    </button>{" "}
                    instead.
                  </div>
                </>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[10.5px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="size-3.5 text-emerald-600" aria-hidden="true" /> No passwords
                stored
              </span>
              <span className="inline-flex items-center gap-1">
                <Check className="size-3.5 text-emerald-600" aria-hidden="true" /> Demo data only
              </span>
            </div>
            <p className="mt-3 text-center text-[10px] leading-4 text-muted-foreground">
              By continuing you agree to the{" "}
              <Link to="/terms" className="underline underline-offset-2 hover:text-foreground">
                demo terms
              </Link>{" "}
              and{" "}
              <Link to="/privacy" className="underline underline-offset-2 hover:text-foreground">
                privacy policy
              </Link>
              .
            </p>
          </motion.div>
        </div>
      </main>
    </div>
  );
}

export default function AuthPage(props: { redirectAfterAuth?: string }) {
  return (
    <Suspense>
      <Auth {...props} />
    </Suspense>
  );
}
