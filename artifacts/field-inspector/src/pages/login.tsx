import { useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const auth = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
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
    <div className="min-h-screen flex items-center justify-center">
      <form
        onSubmit={handleSubmit}
        className="border rounded-lg p-6 w-96 space-y-4"
      >
        <h1 className="text-xl font-bold">Login</h1>

        <input
          className="border w-full p-2"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          className="border w-full p-2"
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <div className="text-red-500 text-sm">{error}</div>}

        <button type="submit" className="border px-4 py-2 w-full">
          Login
        </button>
        <div className="flex justify-center pt-2">
          <GoogleLogin
            onSuccess={async (credentialResponse) => {
              try {
                const res = await fetch("https://infrastruc.onrender.com/api/auth/google", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    credential: credentialResponse.credential,
                  }),
                });

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
      </form>
    </div>
  );
}
