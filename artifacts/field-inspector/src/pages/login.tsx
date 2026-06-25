import { useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "@/lib/auth";
function Feature({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 w-2 rounded-full bg-primary" />
      <span>{text}</span>
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
    const res = await fetch("/api/auth/login", {
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
          <div className="relative bg-gradient-to-br from-background via-background to-secondary/20 p-12 flex flex-col justify-center">
            <div className="mb-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-bold">
                  ⚡
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

              <h1 className="text-6xl font-black tracking-tight leading-none">
                INFRASTRUC
              </h1>

              <p className="mt-4 text-muted-foreground max-w-md">
                Intelligent Field Inspection & Infrastructure Auditor Platform.
              </p>
            </div>

            <div className="space-y-5">
              <Feature text="Real-Time Field Auditing" />
              <Feature text="Offline Data Synchronization" />
              <Feature text="Asset Geolocation Tracking" />
              <Feature text="Automated PDF Audit Reports" />
              <Feature text="Secure Role-Based Access" />
              <Feature text="AI-Powered Infrastructure Insights" />
            </div>

            <div className="mt-12 text-xs text-muted-foreground">
              ● ALL SYSTEMS OPERATIONAL
            </div>
          </div>

          {/* RIGHT SIDE */}
          <div className="p-10 lg:p-12 flex flex-col justify-center bg-card">
            <div className="mb-8">
              <h2 className="text-3xl font-bold">Management Portal</h2>

              <p className="text-muted-foreground mt-2">
                Access secure infrastructure monitoring systems.
              </p>
            </div>

            <div className="mb-6 flex justify-center">
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
                className="w-full rounded-md border border-border bg-background p-3"
                placeholder="Username / Inspector ID"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <input
                className="w-full rounded-md border border-border bg-background p-3"
                placeholder="Passcode"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              {error && <div className="text-red-500 text-sm">{error}</div>}

              <button
                type="submit"
                className="w-full bg-primary text-primary-foreground rounded-md py-3 font-semibold"
              >
                Authorize Session →
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
