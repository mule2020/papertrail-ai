import { useState } from "react";
import type { FormEvent } from "react";
import { confirmSignUp, signIn, signUp } from "../auth";

type Mode = "signin" | "signup" | "confirm";

interface Props {
  onToken: (token: string, email: string) => void;
}

export default function AuthForm({ onToken }: Props) {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setInfo("");
    try {
      if (mode === "signup") {
        await signUp(email, password);
        setMode("confirm");
        setInfo("We emailed you a verification code (check spam too).");
      } else if (mode === "confirm") {
        await confirmSignUp(email, code);
        onToken(await signIn(email, password), email);
      } else {
        onToken(await signIn(email, password), email);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const title =
    mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Verify your email";

  return (
    <div className="auth-card">
      <h1>PaperTrail AI</h1>
      <p className="muted">Upload documents, get summaries and deadlines, ask questions.</p>
      <h2>{title}</h2>
      <form onSubmit={submit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={mode === "confirm"}
        />
        <input
          type="password"
          placeholder="Password (8+ chars, with a number)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
        />
        {mode === "confirm" && (
          <input
            placeholder="Verification code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
        )}
        <button type="submit" disabled={busy}>
          {busy ? "Please wait…" : title}
        </button>
      </form>
      {info && <p className="info">{info}</p>}
      {error && <p className="error">{error}</p>}
      {mode === "signin" && (
        <p className="muted">
          No account?{" "}
          <button className="link" onClick={() => setMode("signup")}>
            Sign up
          </button>
        </p>
      )}
      {mode !== "signin" && (
        <p className="muted">
          <button className="link" onClick={() => setMode("signin")}>
            Back to sign in
          </button>
        </p>
      )}
    </div>
  );
}