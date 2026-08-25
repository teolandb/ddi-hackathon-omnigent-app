/**
 * Page 5 — Ask Genie (conversational analytics).
 *
 * Persona: any user with an ad-hoc question, mid-call, who needs an answer
 * without leaving the app.
 *
 * All five AI-trust requirements are implemented here:
 *  1. Identity      — /api/whoami (real x-forwarded-* headers) shown in a Badge.
 *  2. Generated SQL — every answer's SQL is rendered inspectably.
 *  3. Streaming     — live status from useGenieChat().status, never a frozen spinner.
 *  4. Disclaimer    — persistent "AI-generated, verify" note beside the chat.
 *  5. Governance    — truthful execution-identity disclosure (OBO, because
 *                     user_api_scopes: [dashboards.genie] is wired in
 *                     databricks.yml) plus empty / error / ambiguous states.
 */
import { useMemo, useState } from 'react';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  GenieChatInput,
  GenieChatMessageList,
  useGenieChat,
} from '@databricks/appkit-ui/react';
import {
  Bookmark,
  BookmarkPlus,
  Code2,
  Database,
  Filter,
  Loader2,
  Play,
  RotateCcw,
  Send,
  Server,
  ShieldAlert,
  Sparkles,
  Trash2,
  User,
  type LucideIcon,
} from 'lucide-react';
import { InfoNote, PageHeader } from '../components/kit';
import { useSavedQuestions, useWhoAmI } from '../lib/state';

/**
 * Human-readable labels for Genie's per-message lifecycle phases, so the user
 * sees what is actually happening rather than a generic spinner. Unknown phases
 * fall back to a neutral "Working…" — the status union is versioned, so we do not
 * assume this list is exhaustive.
 */
const PHASE_LABELS: Record<string, { label: string; icon: LucideIcon }> = {
  SUBMITTED: { label: 'Sending your question to Genie…', icon: Send },
  FETCHING_METADATA: { label: 'Reading the data model…', icon: Database },
  FILTERING_CONTEXT: { label: 'Finding the relevant tables and columns…', icon: Filter },
  ASKING_AI: { label: 'Generating SQL with AI…', icon: Sparkles },
  PENDING_WAREHOUSE: { label: 'Warming up the SQL warehouse…', icon: Server },
  EXECUTING_QUERY: { label: 'Running the query on Databricks…', icon: Play },
};

const EXAMPLE_QUESTIONS = [
  'Which French customers have T9 modules?',
  'Compare FASTPICK adoption between France and Spain',
  'What is total revenue by customer segment?',
  'Which strategic accounts have the most projects?',
  'Show me all solution compatibility exceptions',
  'Which product families drive the most configuration exceptions?',
] as const;

function LiveStatus({ phase }: { phase: string }) {
  const meta = PHASE_LABELS[phase] ?? { label: 'Working…', icon: Sparkles };
  const Icon = meta.icon;
  return (
    <div
      className="flex items-center gap-2.5 rounded-md border bg-accent/60 px-3 py-2 text-sm text-accent-foreground"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="font-medium">{meta.label}</span>
    </div>
  );
}

export function GeniePage() {
  const { messages, status, error, sendMessage, reset, hasPreviousPage, fetchPreviousPage } = useGenieChat({
    alias: 'default',
  });
  const me = useWhoAmI();
  const saved = useSavedQuestions();
  const [lastQuestion, setLastQuestion] = useState('');

  // Remember the question so it can be saved together with its generated SQL.
  const ask = (question: string) => {
    setLastQuestion(question);
    sendMessage(question);
  };

  const busy = status === 'streaming' || status === 'loading-history' || status === 'loading-older';

  /** Live phase from the most recent assistant message while streaming. */
  const livePhase = useMemo(() => {
    if (status !== 'streaming') return null;
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const message = messages[i];
      if (message.role === 'assistant') {
        return message.status && message.status !== 'COMPLETED' ? message.status : 'ASKING_AI';
      }
    }
    return 'SUBMITTED';
  }, [messages, status]);

  /**
   * Most recent generated SQL. `attachments[].query` is a typed field on
   * GenieAttachmentResponse, so no cast is needed.
   */
  const lastQuery = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      for (const attachment of messages[i].attachments ?? []) {
        if (attachment.query?.query) return attachment.query;
      }
    }
    return null;
  }, [messages]);

  /** Follow-up prompts Genie suggested for the current conversation. */
  const suggestions = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      for (const attachment of messages[i].attachments ?? []) {
        if (attachment.suggestedQuestions && attachment.suggestedQuestions.length > 0) {
          return attachment.suggestedQuestions;
        }
      }
    }
    return [];
  }, [messages]);

  /** An assistant turn that finished with no text and no query — ambiguous. */
  const ambiguousAnswer = useMemo(() => {
    if (busy || messages.length === 0) return false;
    const last = messages[messages.length - 1];
    if (last.role !== 'assistant') return false;
    const hasText = last.content.trim().length > 0;
    const hasQuery = (last.attachments ?? []).some((a) => a.query?.query);
    return !hasText && !hasQuery && !last.error;
  }, [busy, messages]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Ask Genie"
        message="Ask questions about the Warehousing portfolio in plain English. Genie is grounded in the same tables the other pages query — lifecycle risk, compliance, accounts and geography."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* (1) Identity — real forwarded headers, not a placeholder. */}
            <Badge variant="secondary" className="gap-1">
              <User className="h-3 w-3" aria-hidden="true" />
              {me?.email ?? me?.user ?? 'Signed in'}
            </Badge>
            <Button variant="outline" size="sm" onClick={reset} disabled={messages.length === 0}>
              <RotateCcw className="mr-1.5 h-4 w-4" />
              New conversation
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-2 lg:col-span-2">
          {/* Explicit height: the chat collapses to zero without one. */}
          <Card className="flex h-[min(640px,72vh)] flex-col">
            <CardContent className="flex min-h-0 flex-1 flex-col gap-3 p-4">
              {messages.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Sparkles className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Start a conversation</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Try an example question, or ask your own. Follow-ups stay in the same thread.
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    {EXAMPLE_QUESTIONS.slice(0, 3).map((question) => (
                      <Button key={question} variant="outline" size="sm" onClick={() => ask(question)}>
                        {question}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : (
                <GenieChatMessageList
                  messages={messages}
                  status={status}
                  className="min-h-0 flex-1"
                  hasPreviousPage={hasPreviousPage}
                  onFetchPreviousPage={fetchPreviousPage}
                />
              )}

              {/* (5) Error state — never a silent failure. */}
              {status === 'error' && (
                <Alert variant="destructive">
                  <ShieldAlert className="h-4 w-4" />
                  <AlertTitle>Genie couldn&apos;t answer that</AlertTitle>
                  <AlertDescription>
                    {error ?? 'Try rephrasing the question, or being more specific about the metric.'}
                  </AlertDescription>
                </Alert>
              )}

              {/* (5) Ambiguous / empty answer state. */}
              {ambiguousAnswer && (
                <Alert>
                  <ShieldAlert className="h-4 w-4" />
                  <AlertTitle>No result returned</AlertTitle>
                  <AlertDescription>
                    Genie didn&apos;t produce an answer for that question. Try naming the metric and the
                    grouping explicitly — for example &ldquo;total revenue by customer segment&rdquo;.
                  </AlertDescription>
                </Alert>
              )}

              {/* (3) Streaming — reflects the live phase, never a frozen spinner. */}
              {livePhase && <LiveStatus phase={livePhase} />}

              <GenieChatInput
                onSend={ask}
                disabled={busy}
                placeholder="Ask about T9 risk, compliance exceptions, accounts, geography…"
              />
            </CardContent>
          </Card>

          {/* (4) Persistent disclaimer + (5) truthful execution identity. */}
          <InfoNote>
            AI-generated from your data via Genie — review the generated SQL before acting on an answer.
            Queries execute on behalf of the signed-in user ({me?.email ?? me?.user ?? 'you'}), so results
            respect that user&apos;s own Unity Catalog permissions.
          </InfoNote>
        </div>

        <div className="space-y-4">
          {suggestions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Suggested follow-ups</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {suggestions.map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => ask(question)}
                    disabled={busy}
                    className="w-full rounded-md border px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                  >
                    {question}
                  </button>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Example questions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {EXAMPLE_QUESTIONS.map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => ask(question)}
                  disabled={busy}
                  className="w-full rounded-md border px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                >
                  {question}
                </button>
              ))}
            </CardContent>
          </Card>

          {/* (2) Generated SQL — always inspectable. */}
          {lastQuery && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-1.5 text-base">
                  <Code2 className="h-4 w-4" aria-hidden="true" />
                  Generated SQL
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  {lastQuery.description ?? lastQuery.title ?? 'How this answer was computed'}
                </p>
              </CardHeader>
              <CardContent>
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">
                  {lastQuery.query}
                </pre>
              </CardContent>
            </Card>
          )}

          {/* Personal question library, persisted in Lakebase. */}
          {saved.available && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-1.5 text-base">
                  <Bookmark className="h-4 w-4" aria-hidden="true" />
                  Saved questions
                </CardTitle>
                {lastQuestion && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-1 w-full justify-start"
                    onClick={() => void saved.save(lastQuestion, lastQuery?.query ?? null)}
                    disabled={busy}
                  >
                    <BookmarkPlus className="mr-1.5 h-4 w-4" />
                    <span className="truncate">Save: {lastQuestion}</span>
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-2">
                {saved.questions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Ask a question, then save it here to re-run it later. Your library persists across
                    sessions.
                  </p>
                ) : (
                  saved.questions.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-1 rounded-md border pl-3 transition-colors hover:bg-muted"
                    >
                      <button
                        type="button"
                        onClick={() => ask(item.question)}
                        disabled={busy}
                        title={item.generated_sql ?? 'Re-ask this question'}
                        className="min-w-0 flex-1 py-2 text-left text-sm text-foreground disabled:opacity-50"
                      >
                        <span className="line-clamp-2">{item.question}</span>
                      </button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => void saved.remove(item.id)}
                        aria-label="Remove saved question"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Data governance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                Genie space: <strong>Vanderlande Warehousing Intelligence</strong>,
                attached to the <code>ddi_hackathon</code> tables on the same SQL warehouse the dashboard
                pages use.
              </p>
              <p>
                Queries run on behalf of the signed-in user via the <code>dashboards.genie</code> user API
                scope, so Unity Catalog row and column permissions apply per user.
              </p>
              <p>Synthetic demonstration data.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
