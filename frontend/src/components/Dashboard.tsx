import { useCallback, useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { askQuestion, getDocuments, uploadDocument, UnauthorizedError } from "../api";
import type { AskResult, DocItem } from "../api";

interface Props {
  token: string;
  email: string;
  onSignOut: () => void;
}

interface Turn {
  question: string;
  result?: AskResult;
  error?: string;
}

export default function Dashboard({ token, email, onSignOut }: Props) {
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [docError, setDocError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [pollUntil, setPollUntil] = useState(0);

  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [active, setActive] = useState<number | null>(null);

  const fail = useCallback(
    (err: unknown, setter: (msg: string) => void) => {
      if (err instanceof UnauthorizedError) {
        onSignOut();
        return;
      }
      setter(err instanceof Error ? err.message : "Something went wrong");
    },
    [onSignOut],
  );

  const refresh = useCallback(async () => {
    try {
      setDocs(await getDocuments(token));
      setDocError("");
    } catch (err) {
      fail(err, setDocError);
    }
  }, [token, fail]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // After an upload, poll for a minute so status changes show up.
  useEffect(() => {
    if (!pollUntil) return;
    const id = setInterval(() => {
      refresh();
      if (Date.now() > pollUntil) setPollUntil(0);
    }, 3000);
    return () => clearInterval(id);
  }, [pollUntil, refresh]);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setDocError("");
    try {
      await uploadDocument(token, file);
      await refresh();
      setPollUntil(Date.now() + 60_000);
    } catch (err) {
      fail(err, setDocError);
    } finally {
      setUploading(false);
    }
  }

  async function onAsk(e: FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q) return;
    setAsking(true);
    setQuestion("");
    let turn: Turn;
    try {
      turn = { question: q, result: await askQuestion(token, q) };
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        onSignOut();
        return;
      }
      const msg = err instanceof Error ? err.message : "Something went wrong";
      turn = {
        question: q,
        error: msg === "Not Found" ? "Question answering isn't deployed yet." : msg,
      };
    } finally {
      setAsking(false);
    }
    setTurns((prev) => {
      setActive(prev.length);
      return [...prev, turn];
    });
  }

  const shown = active !== null ? turns[active] : undefined;
  const sources = shown?.result?.sources ?? [];

  return (
    <div className="layout">
      <header>
        <strong>PaperTrail AI</strong>
        <span className="muted">
          {email} ·{" "}
          <button className="link" onClick={onSignOut}>
            Sign out
          </button>
        </span>
      </header>

      <main>
        <section className="panel">
          <div className="panel-head">
            <h2>Documents</h2>
            <div>
              <button className="secondary" onClick={refresh}>
                Refresh
              </button>
              <label className="upload">
                {uploading ? "Uploading…" : "Upload"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,application/pdf"
                  onChange={onFile}
                  disabled={uploading}
                  hidden
                />
              </label>
            </div>
          </div>
          {docError && <p className="error">{docError}</p>}
          {docs.length === 0 && <p className="muted">No documents yet. Upload a PNG, JPEG, or one-page PDF.</p>}
          <ul className="docs">
            {docs.map((d) => (
              <li key={d.docId}>
                <div className="doc-title">
                  <span>{d.filename}</span>
                  <span className={`badge ${d.status.toLowerCase()}`}>{d.status}</span>
                </div>
                <div className="muted small">{new Date(d.createdAt * 1000).toLocaleString()}</div>
                {d.error && <p className="error small">{d.error}</p>}
                {d.summary?.overview && <p>{d.summary.overview}</p>}
                {d.summary?.keyDates && d.summary.keyDates.length > 0 && (
                  <div>
                    <strong className="small">Key dates</strong>
                    <ul>
                      {d.summary.keyDates.map((k, i) => (
                        <li key={i}>
                          {k.date} — {k.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {d.summary?.obligations && d.summary.obligations.length > 0 && (
                  <div>
                    <strong className="small">Obligations</strong>
                    <ul>
                      {d.summary.obligations.map((o, i) => (
                        <li key={i}>{o}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {d.summary?.costs && d.summary.costs.length > 0 && (
                  <div>
                    <strong className="small">Costs</strong>
                    <ul>
                      {d.summary.costs.map((c, i) => (
                        <li key={i}>
                          {c.label}: {c.amount}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <h2>Ask your documents</h2>
          <div className="chat">
            {turns.map((t, i) => (
              <div key={i} className={`turn ${i === active ? "active" : ""}`}>
                <p className="q">{t.question}</p>
                {t.result && <p className="a">{t.result.answer}</p>}
                {t.error && <p className="error">{t.error}</p>}
                {t.result && (
                  <button className="link" onClick={() => setActive(i)}>
                    View sources ({t.result.sources.length})
                  </button>
                )}
              </div>
            ))}
            {asking && <p className="muted">Thinking…</p>}
          </div>
          <form onSubmit={onAsk} className="ask">
            <input
              placeholder="e.g. When is my rent due?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
            <button type="submit" disabled={asking}>
              Ask
            </button>
          </form>

          <h3>Sources</h3>
          {sources.length === 0 ? (
            <p className="muted small">Sources for the selected answer appear here.</p>
          ) : (
            <ul className="sources">
              {sources.map((s, i) => (
                <li key={i}>
                  <div className="doc-title">
                    <span>{s.filename}</span>
                    <span className="muted small">score {s.score.toFixed(2)}</span>
                  </div>
                  <p className="small">{s.text}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}