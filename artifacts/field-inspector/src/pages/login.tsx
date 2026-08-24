import { useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "@/lib/auth";

import {
  MapPinned,
  Cloud,
  FileCheck,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

function Feature({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex gap-4 items-start">
      <div className="h-10 w-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div>
        <h3 className="font-semibold">{title}</h3>

        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}
export default function LoginPage() {
  const auth = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("https://infrastruc.onrender.com/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
      }),
    });
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-6xl rounded-2xl border border-border overflow-hidden shadow-2xl bg-card">
        <div className="grid lg:grid-cols-2">
          {/* LEFT SIDE */}

          <div className="relative overflow-hidden bg-gradient-to-br from-background via-background to-secondary/20 p-12 flex flex-col justify-center">
            {/* Background Image */}
            <div className="absolute inset-0">
              <img
                src="/crane2.jpg"
                alt=""
                className="absolute inset-0 h-full w-full object-cover brightness-75 contrast-110 opacity-40"
              />
            </div>

            {/* Dark Overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/70 to-black/55" />
            <div className="relative z-10">
              <div className="mb-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="relative h-12 w-12 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/40">
                    <div className="absolute inset-0 rounded-xl bg-primary blur-xl opacity-40"></div>

                    <ShieldCheck className="relative h-7 w-7 text-primary-foreground" />
                  </div>

                  <div>
                    <div className="font-bold tracking-widest text-primary">
                      AUDITOR
                    </div>

                    <div className="text-xs text-muted-foreground">
                      Infrastructure Monitoring Platform
                    </div>
                  </div>
                </div>

                <h1 className="text-5xl lg:text-5xl font-black leading-none tracking-normal">
                  INFRASTRUCTURE
                  <br />
                  <span className="text-primary">INTELLIGENCE</span>
                </h1>

                <p className="mt-4 text-muted-foreground max-w-md">
                  Intelligent Field Inspection & Infrastructure Auditor
                  Platform.
                </p>
              </div>

              <div className="space-y-6">
                <Feature
                  icon={MapPinned}
                  title="Real-Time Field Auditing"
                  subtitle="Capture and manage inspection data from any location."
                />

                <Feature
                  icon={Cloud}
                  title="Offline Synchronization"
                  subtitle="Continue working without internet and sync automatically."
                />

                <Feature
                  icon={FileCheck}
                  title="Automated PDF Reports"
                  subtitle="Generate professional audit reports instantly."
                />

                <Feature
                  icon={ShieldCheck}
                  title="Secure Role-Based Access"
                  subtitle="Fine-grained permissions for every user role."
                />

                <Feature
                  icon={Sparkles}
                  title="AI-Powered Infrastructure Insights"
                  subtitle="Next-generation intelligent inspection assistance."
                />
              </div>

              <div className="mt-12 text-xs text-muted-foreground">
                ● ALL SYSTEMS OPERATIONAL
              </div>
            </div>
          </div>

          {/* RIGHT SIDE */}
          <div className="p-10 lg:p-12 flex flex-col justify-center bg-background/60 backdrop-blur-xl border-l border-white/10">
            <div className="mb-10">
              <h2 className="text-3xl font-bold">Management Portal</h2>

              <p className="text-muted-foreground mt-2">
                Access secure infrastructure monitoring systems.
              </p>
            </div>

            <div className="mb-8 flex justify-center">
              <GoogleLogin
                onSuccess={async (credentialResponse) => {
                  try {
                    const res = await fetch(
                      "https://infrastruc.onrender.com/api/auth/google",
                      {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                          credential: credentialResponse.credential,
                        }),
                      },
                    );

                    const data = await res.json();

                    if (!res.ok) {
                      throw new Error(data.error || "Google login failed");
                    }

                    auth.login(data.token, data.user);
                  } catch (err: any) {
                    setError(err.message);
                  }
                }}
                onError={() => {
                  console.log("Google Login Failed");
                }}
              />
            </div>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>

              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-3 text-muted-foreground">
                  Or Secure Credentials
                </span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                className="w-full rounded-lg border border-white/10 bg-background/60 px-4 py-3 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="Username / Inspector ID"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <input
                className="w-full rounded-lg border border-border bg-background p-3"
                placeholder="Passcode"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              {error && <div className="text-red-500 text-sm">{error}</div>}

              <button
                type="submit"
                className="w-full rounded-lg bg-primary py-3.5 font-semibold text-primary-foreground transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-primary/30"
              >
                Authorize Session →
              </button>
            </form>
            <div className="mt-8 flex items-center justify-between border-t border-white/10 pt-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
                Secure Connection
              </span>

              <span>TLS 1.3 Encrypted</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
