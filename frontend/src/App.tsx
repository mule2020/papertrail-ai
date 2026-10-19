import { useCallback, useState } from "react";
import AuthForm from "./components/AuthForm";
import Dashboard from "./components/Dashboard";
import "./App.css";

interface Session {
  token: string;
  email: string;
}

const KEY = "papertrail.session";

function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export default function App() {
  const [session, setSession] = useState<Session | null>(loadSession);

  const handleToken = useCallback((token: string, email: string) => {
    const s = { token, email };
    sessionStorage.setItem(KEY, JSON.stringify(s));
    setSession(s);
  }, []);

  const signOut = useCallback(() => {
    sessionStorage.removeItem(KEY);
    setSession(null);
  }, []);

  return session ? (
    <Dashboard token={session.token} email={session.email} onSignOut={signOut} />
  ) : (
    <AuthForm onToken={handleToken} />
  );
}