"use client";

import { canAssignRole, hasPermission } from "@openhubpanel/security/permissions";
import { useCallback, useEffect, useRef, useState } from "react";
import { LanguageSelector, useLocale } from "@/i18n/provider";
import { type Field, GeneralForm } from "./form";
import { errorMessage } from "./messages";
import { readState, requestJson } from "./request";

type Workspace = { id: string; name: string; role: string };
type App = { id: string; name: string; panel_url: string | null; archived: boolean };
type Member = { user_id: string; display_name: string; role: string; active: boolean };
type Invitation = {
  id: string;
  email: string;
  role: string;
  expires_at: string;
  accepted: boolean;
  cancelled: boolean;
};
type Event = {
  id: string;
  action: string;
  actor_id: string;
  target_id: string;
  outcome: string;
  created_at: string;
};
type Snapshot = {
  workspaceId: string;
  userId: string;
  role: string;
  applications: App[];
  members: Member[];
  invitations: Invitation[];
  events: Event[];
  ownershipOffer: { ownerId: string; targetId: string; expiresAt: string } | null;
};
type Connection = {
  id: string;
  application_id: string;
  name: string;
  url: string;
  write_enabled: boolean;
  disabled: boolean;
  revision: string;
  status: string;
  checked_at: string | null;
};
type Articles = {
  resource?: string;
  resources?: { id: string; name: string; capabilities: string[] }[];
  items: { id: string; title: string; status: string; version: number }[];
  revision: string;
  writeEnabled: boolean;
};
const roles = ["owner", "admin", "editor", "viewer"];
const auditLabels: Record<string, string> = {
  "workspace.created": "Workspace created",
  "member.role_changed": "Member role changed",
  "member.removed": "Member removed",
  "invitation.created": "Invitation created",
  "invitation.resent": "Invitation replaced",
  "invitation.cancelled": "Invitation cancelled",
  "invitation.accepted": "Invitation accepted",
  "ownership.offered": "Ownership offered",
  "ownership.accepted": "Ownership accepted",
  "application.created": "Application created",
  "application.updated": "Application updated",
  "connection.created": "Connection created",
  "connection.tested": "Connection tested",
  "connection.disable": "Connection disabled",
  "connection.enable-writes": "Connection writes enabled",
  "connection.disable-writes": "Connection writes disabled",
  "connection.write.intent": "Article change requested",
  "connection.write.dispatched": "Article change sent",
  "connection.write.completed": "Article change completed",
  "connection.write.conflict": "Article change conflicted",
  "connection.write.unknown": "Article change result uncertain",
};

export function GeneralPanel({ basePath, operatorHub = false }: { basePath: string; operatorHub?: boolean }) {
  const { t } = useLocale();
  const [csrf, setCsrf] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspace, setWorkspace] = useState("");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [articles, setArticles] = useState<{ connection: string; data: Articles } | null>(null);
  const [pendingWrite, setPendingWrite] = useState<Record<string, unknown> | null>(null);
  const [tab, setTab] = useState("Overview");
  const [phase, setPhase] = useState("login");
  const [secret, setSecret] = useState("");
  const [recovery, setRecovery] = useState<string[]>([]);
  const [invite, setInvite] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const generation = useRef(0);
  const inFlight = useRef(false);
  const clearFeedback = useCallback(() => {
    setError("");
    setMessage("");
  }, []);
  const operationKeys = useRef(new Map<string, string>());
  const api = useCallback(
    async <T,>(route: string, payload?: unknown): Promise<T> => {
      return requestJson<T>(
        `${basePath}/api/general/${route}`,
        payload === undefined
          ? {}
          : {
              method: "POST",
              headers: { "content-type": "application/json", "x-csrf-token": csrf },
              body: JSON.stringify(payload),
            },
      );
    },
    [basePath, csrf],
  );
  const refreshState = useCallback(async () => {
    const state = readState(await api<unknown>("state"));
    setCsrf(state.csrf);
    setAuthenticated(state.authenticated);
    setWorkspaces(state.workspaces);
    setWorkspace((current) =>
      state.workspaces.some((item) => item.id === current) ? current : (state.workspaces[0]?.id ?? ""),
    );
    if (!state.authenticated) {
      setSnapshot(null);
      setConnections([]);
      setArticles(null);
      setWorkspace("");
    }
    return state;
  }, [api]);
  useEffect(() => {
    let active = true;
    const fragment = new URLSearchParams(location.hash.slice(1));
    const proof = fragment.get("invite");
    if (proof) {
      setInvite(proof);
      history.replaceState(null, "", location.pathname);
    }
    requestJson<unknown>(`${basePath}/api/general/state`)
      .then((value) => {
        const state = readState(value);
        if (!active) return;
        setCsrf(state.csrf);
        setAuthenticated(state.authenticated);
        setWorkspaces(state.workspaces);
        setWorkspace(state.workspaces[0]?.id ?? "");
        if (!state.authenticated || !state.workspaces.length) setLoading(false);
      })
      .catch((failure) => {
        if (active) {
          setError(errorMessage(failure instanceof Error ? failure.message : "UNAVAILABLE"));
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [basePath]);
  const loadWorkspace = useCallback(
    async (id: string, current: number) => {
      const [data, list] = await Promise.all([
        api<Snapshot>(`workspace?workspace=${id}`),
        api<Connection[]>(`connections?workspace=${id}`),
      ]);
      if (
        !data ||
        data.workspaceId !== id ||
        ![data.applications, data.members, data.invitations, data.events, list].every(Array.isArray)
      )
        throw new Error("UNAVAILABLE");
      if (generation.current === current) {
        setSnapshot(data);
        setConnections(list);
      }
    },
    [api],
  );
  useEffect(() => {
    const current = ++generation.current;
    setSnapshot(null);
    setConnections([]);
    setArticles(null);
    setInviteLink("");
    setPendingWrite(null);
    if (!workspace || !authenticated) {
      if (authenticated) setLoading(false);
      return;
    }
    setLoading(true);
    loadWorkspace(workspace, current)
      .catch((failure: Error) => {
        if (generation.current === current) setError(errorMessage(failure.message));
      })
      .finally(() => {
        if (generation.current === current) setLoading(false);
      });
  }, [workspace, authenticated, loadWorkspace]);
  async function run(action: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      await action();
    } catch (failure) {
      const code = failure instanceof Error ? failure.message : "UNAVAILABLE";
      setMessage("");
      setError(errorMessage(code));
      if (["UNAUTHENTICATED", "FORBIDDEN"].includes(code)) {
        setSnapshot(null);
        setConnections([]);
        setArticles(null);
        await refreshState().catch(() => {});
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  async function mutate(action: string, data: Record<string, unknown>) {
    await run(async () => {
      const result = await api<{
        id?: string;
        token?: string;
        status?: string;
        remoteKeyRevocationRequired?: boolean;
        version?: number;
        ok?: boolean;
      }>(action, { ...data, workspace }).catch((failure) => {
        if (
          action === "article" &&
          ["UNKNOWN_OUTCOME", "NETWORK_ERROR", "TIMEOUT", "UNAVAILABLE"].includes(failure.message)
        )
          setPendingWrite({ ...data, code: "" });
        throw failure;
      });
      if (
        ["workspaces", "application", "connection"].includes(action) &&
        (typeof result.id !== "string" || !result.id)
      )
        throw new Error("UNAVAILABLE");
      if (action === "invitation" && (typeof result.token !== "string" || !result.token))
        throw new Error("UNAVAILABLE");
      if (
        ["member", "cancel-invitation", "transfer", "accept-transfer"].includes(action) &&
        result.ok !== true
      )
        throw new Error("UNAVAILABLE");
      if (
        action === "test-connection" &&
        !["connected", "unavailable", "incompatible"].includes(result.status ?? "")
      )
        throw new Error("UNAVAILABLE");
      if (action === "change-connection" && typeof result.remoteKeyRevocationRequired !== "boolean")
        throw new Error("UNAVAILABLE");
      if (action === "article") {
        if (
          result.ok !== true ||
          !Number.isSafeInteger(result.version) ||
          Number(result.version) <= Number(data.expectedVersion)
        )
          throw new Error("UNAVAILABLE");
        setPendingWrite(null);
      }

      if (result.token) setInviteLink(`${location.origin}${basePath}/workspace#invite=${result.token}`);
      if (action === "article" && result.version) {
        setArticles((current) =>
          current
            ? {
                ...current,
                data: {
                  ...current.data,
                  items: current.data.items.map((item) =>
                    item.id === data.article
                      ? { ...item, title: String(data.title), version: Number(result.version) }
                      : item,
                  ),
                },
              }
            : null,
        );
      }
      if (action === "change-connection" || (action === "application" && data.archived)) setArticles(null);
      const state = await refreshState();
      if (action === "workspaces" && result.id) setWorkspace(result.id);
      else if (state.workspaces.some((item) => item.id === workspace))
        await loadWorkspace(workspace, generation.current);
      else setWorkspace(state.workspaces[0]?.id ?? "");
      if (result.status === "unavailable") throw new Error("CONNECTION_UNAVAILABLE");
      setMessage(
        result.status === "unavailable"
          ? "The connected application could not be reached."
          : result.remoteKeyRevocationRequired
            ? "Connection disabled. Revoke its API key in the connected application too."
            : "Changes saved.",
      );
    });
  }
  const code: Field = { name: "code", label: "Current authenticator code", type: "password" };
  const roleOptions = roles.map((role) => ({ value: role, label: role }));
  const form = (
    title: string,
    fields: Field[],
    submit: string,
    action: string,
    extra: Record<string, unknown> = {},
  ) => (
    <GeneralForm
      onStart={clearFeedback}
      title={title}
      fields={fields}
      submit={submit}
      disabled={busy || loading}
      run={(input) => mutate(action, { ...extra, ...input })}
    />
  );
  return (
    <div className="general-shell">
      <header>
        <div>
          <strong>OpenHubPanel</strong>
          <p>{t("Team workspaces")}</p>
        </div>
        <div className="general-toolbar">
          {operatorHub && <a href={`${basePath}/live`}>{t("Live workspace")}</a>}
          <LanguageSelector />
        </div>
      </header>
      <main>
        <h1>{t(authenticated ? "Your workspaces" : "Workspace sign-in")}</h1>
        {loading && <p role="status">{t("Loading…")}</p>}
        {error && (
          <p className="general-error" role="alert">
            {t(error)}
          </p>
        )}
        {message && <p role="status">{t(message)}</p>}
        {error && !pendingWrite && (
          <button type="button" disabled={busy} onClick={() => location.reload()}>
            {t("Reload")}
          </button>
        )}
        {pendingWrite && (
          <button type="button" disabled={busy} onClick={() => mutate("article", pendingWrite)}>
            {t("Check result")}
          </button>
        )}
        {!!recovery.length && (
          <section>
            <h2>{t("Save your recovery codes")}</h2>
            <p>{t("These codes are shown once. Keep them somewhere private.")}</p>
            <pre>{recovery.join("\n")}</pre>
            <button type="button" onClick={() => setRecovery([])}>
              {t("I saved my codes")}
            </button>
          </section>
        )}
        {!authenticated ? (
          <section>
            {phase === "login" ? (
              <>
                <p>
                  {t(
                    "Your password is required. An authenticator code is needed unless this device is trusted.",
                  )}
                </p>
                <GeneralForm
                  onStart={clearFeedback}
                  title="Sign in"
                  fields={[
                    { name: "email", label: "Email", type: "email" },
                    { name: "password", label: "Password", type: "password" },
                    { name: "recovery", label: "Recovery code (optional)", type: "password", optional: true },
                  ]}
                  submit="Sign in"
                  disabled={busy || loading}
                  run={(input) =>
                    run(async () => {
                      const result = await api<{ phase: string; secret?: string }>("login", input);
                      if (result.phase === "authenticated") {
                        await refreshState();
                        setPhase("login");
                        setSecret("");
                      } else {
                        setPhase(result.phase);
                        setSecret(result.secret ?? "");
                      }
                    })
                  }
                />
                <GeneralForm
                  onStart={clearFeedback}
                  title="First installation"
                  fields={[
                    { name: "token", label: "Setup token", type: "password" },
                    { name: "email", label: "Email", type: "email" },
                    { name: "password", label: "Password", type: "password" },
                  ]}
                  submit="Start setup"
                  disabled={busy || loading}
                  run={(input) =>
                    run(async () => {
                      const result = await api<{ phase: string; secret: string }>("bootstrap", input);
                      setPhase(result.phase);
                      setSecret(result.secret);
                    })
                  }
                />
                {invite && (
                  <GeneralForm
                    onStart={clearFeedback}
                    title="Join with invitation"
                    fields={[{ name: "password", label: "Password", type: "password" }]}
                    submit="Create invited account"
                    disabled={busy || loading}
                    run={(input) =>
                      run(async () => {
                        const result = await api<{ phase: string; secret: string }>("enroll-invitation", {
                          ...input,
                          token: invite,
                        });
                        setPhase(result.phase);
                        setSecret(result.secret);
                      })
                    }
                  />
                )}
              </>
            ) : (
              <>
                {secret && (
                  <>
                    <h2>{t("Set up your authenticator")}</h2>
                    <p>{t("Add this key to your authenticator, then enter its current code.")}</p>
                    <pre>{secret}</pre>
                  </>
                )}
                <GeneralForm
                  onStart={clearFeedback}
                  title="Verify authenticator"
                  fields={[
                    code,
                    {
                      name: "rememberDevice",
                      label: "Trust this device for 30 days",
                      type: "checkbox",
                      optional: true,
                    },
                  ]}
                  submit="Verify"
                  disabled={busy || loading}
                  run={(input) =>
                    run(async () => {
                      const result = await api<{ recoveryCodes?: string[] }>("complete", input);
                      setSecret("");
                      setPhase("login");
                      setRecovery(result.recoveryCodes ?? []);
                      const state = await refreshState();
                      setWorkspace(state.workspaces[0]?.id ?? "");
                    })
                  }
                />
                <p>{t("Your password is still required. Do not trust a shared device.")}</p>
                <button
                  type="button"
                  onClick={() => {
                    setPhase("login");
                    setSecret("");
                  }}
                >
                  {t("Back to sign-in")}
                </button>
              </>
            )}
          </section>
        ) : (
          <>
            <div className="general-toolbar">
              <label htmlFor="general-workspace">{t("Workspace")}</label>
              <select
                id="general-workspace"
                value={workspace}
                disabled={busy}
                onChange={(event) => {
                  if (event.target.value === workspace) return;
                  clearFeedback();
                  setPendingWrite(null);
                  generation.current++;
                  setSnapshot(null);
                  setConnections([]);
                  setArticles(null);
                  setWorkspace(event.target.value);
                }}
              >
                <option value="">{t("Choose a workspace")}</option>
                {workspaces.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await api("logout", {});
                    await refreshState();
                  })
                }
              >
                {t("Sign out")}
              </button>
            </div>
            {invite && (
              <section>
                <h2>{t("Join with invitation")}</h2>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const result = await api<{ id: string }>("accept-invitation", { token: invite });
                      setInvite("");
                      await refreshState();
                      setWorkspace(result.id);
                      setMessage("Invitation accepted.");
                    })
                  }
                >
                  {t("Accept invitation")}
                </button>
              </section>
            )}
            <nav aria-label={t("Workspace navigation")}>
              {["Overview", "Applications", "Connections", "Team members", "Activity log", "Security"].map(
                (item) => (
                  <button
                    type="button"
                    key={item}
                    disabled={busy}
                    aria-current={tab === item ? "page" : undefined}
                    onClick={() => {
                      setTab(item);
                      setMessage("");
                      setError("");
                      if (workspace) {
                        const current = ++generation.current;
                        setSnapshot(null);
                        setConnections([]);
                        setArticles(null);
                        setLoading(true);
                        void run(async () => {
                          try {
                            await loadWorkspace(workspace, current);
                          } finally {
                            if (generation.current === current) setLoading(false);
                          }
                        });
                      }
                    }}
                  >
                    {t(item)}
                  </button>
                ),
              )}
            </nav>
            {tab === "Overview" && (
              <section>
                <h2>{t("Overview")}</h2>
                <p>{t("Create a workspace, invite your team and connect an application.")}</p>
                {!workspaces.length && <p>{t("You do not have a workspace yet.")}</p>}
                {form(
                  "Create workspace",
                  [{ name: "name", label: "Workspace name" }],
                  "Create workspace",
                  "workspaces",
                )}
                {snapshot && (
                  <p>
                    {t("Your role")}: {t(snapshot.role)} · {t("Applications")}: {snapshot.applications.length}
                  </p>
                )}
              </section>
            )}
            {snapshot && tab === "Applications" && (
              <section>
                <h2>{t("Applications")}</h2>
                {!snapshot.applications.length && (
                  <p>{t("No applications yet. Add your first application.")}</p>
                )}
                {snapshot.applications.map((app) => (
                  <article key={app.id}>
                    <h3>{app.name}</h3>
                    <p>{t(app.archived ? "Archived" : "Active")}</p>
                    {app.panel_url && (
                      <a href={app.panel_url} target="_blank" rel="noopener noreferrer">
                        {t("Open external panel")}
                      </a>
                    )}
                    {hasPermission(snapshot.role, "apps.manage") &&
                      form(
                        "Edit application",
                        [
                          { name: "name", label: "Application name", value: app.name },
                          {
                            name: "panelUrl",
                            label: "External panel URL (optional)",
                            type: "url",
                            value: app.panel_url ?? "",
                            optional: true,
                          },
                          {
                            name: "archived",
                            label: "Archived",
                            type: "checkbox",
                            optional: true,
                            checked: app.archived,
                          },
                        ],
                        "Save",
                        "application",
                        { id: app.id },
                      )}
                  </article>
                ))}
                {hasPermission(snapshot.role, "apps.manage") &&
                  form(
                    "Add application",
                    [
                      { name: "name", label: "Application name" },
                      {
                        name: "panelUrl",
                        label: "External panel URL (optional)",
                        type: "url",
                        optional: true,
                      },
                    ],
                    "Add application",
                    "application",
                  )}
              </section>
            )}
            {snapshot && tab === "Team members" && (
              <section>
                <h2>{t("Team members")}</h2>
                {!hasPermission(snapshot.role, "members.read") ? (
                  <p>{t("You do not have permission for this action.")}</p>
                ) : (
                  <>
                    {!snapshot.members.length && <p>{t("No members yet.")}</p>}
                    {snapshot.members.map((member) => (
                      <article key={member.user_id}>
                        <h3>{member.display_name}</h3>
                        <p>{member.user_id}</p>
                        <p>
                          {t(member.role)} · {t(member.active ? "Active" : "Removed")}
                        </p>
                        {hasPermission(snapshot.role, "members.manage") &&
                          canAssignRole(snapshot.role, member.role) &&
                          member.active &&
                          form(
                            "Manage member",
                            [
                              {
                                name: "role",
                                label: "Role",
                                options: roleOptions.filter(
                                  (option) =>
                                    canAssignRole(snapshot.role, option.value) &&
                                    (option.value !== "owner" || member.role === "owner"),
                                ),
                                value: member.role,
                              },
                              {
                                name: "active",
                                label: "Keep membership active",
                                checked: true,
                                type: "checkbox",
                                optional: true,
                              },
                              code,
                            ],
                            "Save member",
                            "member",
                            { user: member.user_id },
                          )}
                      </article>
                    ))}
                    {form(
                      "Invite member",
                      [
                        { name: "email", label: "Email", type: "email" },
                        {
                          name: "role",
                          label: "Role",
                          options: roleOptions.filter(
                            (item) => item.value !== "owner" && canAssignRole(snapshot.role, item.value),
                          ),
                        },
                        code,
                      ],
                      "Create invitation link",
                      "invitation",
                    )}
                    <p>{t("No email is sent. Copy the invitation link and share it privately.")}</p>
                    {inviteLink && (
                      <div>
                        <label htmlFor="invitation-link">{t("One-use invitation link")}</label>
                        <input
                          id="invitation-link"
                          readOnly
                          value={inviteLink}
                          onFocus={(event) => event.target.select()}
                        />
                      </div>
                    )}
                    <h3>{t("Invitations")}</h3>
                    {!snapshot.invitations.length && <p>{t("No invitations yet.")}</p>}
                    {snapshot.invitations.map((invitation) => (
                      <article key={invitation.id}>
                        <p>
                          {invitation.email} · {t(invitation.role)} ·{" "}
                          {new Date(invitation.expires_at).toLocaleString()}
                        </p>
                        <p>
                          {t(
                            invitation.accepted
                              ? "Accepted"
                              : invitation.cancelled
                                ? "Cancelled"
                                : Date.parse(invitation.expires_at) <= Date.now()
                                  ? "Expired"
                                  : "Pending",
                          )}
                        </p>
                        {!invitation.accepted && !invitation.cancelled && (
                          <>
                            {form("Cancel invitation", [code], "Cancel invitation", "cancel-invitation", {
                              id: invitation.id,
                            })}
                            {form("Resend invitation", [code], "Replace invitation link", "invitation", {
                              email: invitation.email,
                              role: invitation.role,
                              previous: invitation.id,
                            })}
                          </>
                        )}
                      </article>
                    ))}
                    {snapshot.role === "owner" &&
                      form(
                        "Offer ownership",
                        [
                          {
                            name: "target",
                            label: "Member",
                            options: snapshot.members
                              .filter((member) => member.active && member.user_id !== snapshot.userId)
                              .map((member) => ({ value: member.user_id, label: member.display_name })),
                          },
                          code,
                        ],
                        "Offer ownership",
                        "transfer",
                      )}
                  </>
                )}
                {snapshot.ownershipOffer?.targetId === snapshot.userId &&
                  form("Accept ownership offer", [code], "Accept ownership", "accept-transfer")}
              </section>
            )}
            {snapshot && tab === "Connections" && (
              <section>
                <h2>{t("Connections")}</h2>
                <p>
                  {t("Panel links open an external website. API connections manage supported data here.")}
                </p>
                {!connections.length && <p>{t("No API connections yet.")}</p>}
                {connections.map((connection) => (
                  <article key={connection.id}>
                    <h3>{connection.name}</h3>
                    <p>{connection.url}</p>
                    <p>
                      {t(
                        connection.disabled
                          ? "Disabled"
                          : connection.status === "connected"
                            ? "Connected"
                            : connection.status === "unavailable"
                              ? "Unavailable"
                              : "Not tested",
                      )}{" "}
                      · {t(connection.write_enabled ? "Writes enabled" : "Read only")}
                    </p>
                    {connection.checked_at && (
                      <p>
                        {t("Last checked")}: {new Date(connection.checked_at).toLocaleString()}
                      </p>
                    )}
                    {!connection.disabled && (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            run(async () => {
                              setArticles(null);
                              setArticles({
                                connection: connection.id,
                                data: await api<Articles>(
                                  `connections/${connection.id}/articles?workspace=${workspace}`,
                                ),
                              });
                            })
                          }
                        >
                          {t("Read articles")}
                        </button>
                        {hasPermission(snapshot.role, "apps.manage") && (
                          <>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => mutate("test-connection", { id: connection.id })}
                            >
                              {t("Test connection")}
                            </button>
                            {form(
                              "Manage connection",
                              [
                                {
                                  name: "action",
                                  label: "Action",
                                  options: [
                                    { value: "disable", label: "Disable connection" },
                                    { value: "enable-writes", label: "Enable writes" },
                                    { value: "disable-writes", label: "Disable writes" },
                                  ],
                                },
                                code,
                              ],
                              "Apply",
                              "change-connection",
                              { id: connection.id, revision: connection.revision },
                            )}
                          </>
                        )}
                      </>
                    )}
                  </article>
                ))}
                {articles && (
                  <section>
                    <h3>{t("Articles")}</h3>
                    {articles.data.resources && articles.data.resources.length > 1 && (
                      <div className="general-toolbar">
                        <label htmlFor="connection-resource">{t("Resources")}</label>
                        <select
                          id="connection-resource"
                          value={articles.data.resource ?? "articles"}
                          disabled={busy}
                          onChange={(event) => {
                            const nextResource = event.target.value;
                            const connId = articles.connection;
                            void run(async () => {
                              setArticles({
                                connection: connId,
                                data: await api<Articles>(
                                  `connections/${connId}/articles?workspace=${workspace}&resource=${encodeURIComponent(nextResource)}`,
                                ),
                              });
                            });
                          }}
                        >
                          {articles.data.resources.map((res) => (
                            <option key={res.id} value={res.id}>
                              {res.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    {!articles.data.items.length && <p>{t("No articles found.")}</p>}
                    {articles.data.items.map((item) => (
                      <article key={item.id}>
                        <h3>{item.title}</h3>
                        <p>
                          {item.status} · {t("Version")}: {item.version}
                        </p>
                        {articles.data.writeEnabled && hasPermission(snapshot.role, "content.write") && (
                          <GeneralForm
                            onStart={clearFeedback}
                            title="Edit article"
                            fields={[{ name: "title", label: "Title", value: item.title }, code]}
                            submit="Save title or check result"
                            disabled={busy}
                            run={(input) => {
                              const payload = {
                                ...input,
                                ...(articles.data.resource && articles.data.resource !== "articles"
                                  ? { resource: articles.data.resource }
                                  : {}),
                                id: articles.connection,
                                article: item.id,
                                expectedVersion: item.version,
                                revision: articles.data.revision,
                              };
                              const fingerprint = JSON.stringify({ ...payload, workspace, code: undefined });
                              let idempotencyKey = operationKeys.current.get(fingerprint);
                              if (!idempotencyKey) {
                                idempotencyKey = crypto.randomUUID();
                                operationKeys.current.set(fingerprint, idempotencyKey);
                              }
                              return mutate("article", { ...payload, idempotencyKey });
                            }}
                          />
                        )}
                      </article>
                    ))}
                  </section>
                )}
                {hasPermission(snapshot.role, "apps.manage") &&
                  form(
                    "Add API connection",
                    [
                      {
                        name: "applicationId",
                        label: "Application",
                        options: snapshot.applications
                          .filter((app) => !app.archived)
                          .map((app) => ({ value: app.id, label: app.name })),
                      },
                      { name: "name", label: "Connection name" },
                      { name: "url", label: "API base URL", type: "url" },
                      { name: "credential", label: "API key", type: "password" },
                      {
                        name: "approveTarget",
                        label: "I approve sending this API key to this URL",
                        type: "checkbox",
                      },
                      code,
                    ],
                    "Add connection",
                    "connection",
                  )}
              </section>
            )}
            {snapshot && tab === "Activity log" && (
              <section>
                <h2>{t("Activity log")}</h2>
                {!hasPermission(snapshot.role, "audit.read") ? (
                  <p>{t("You do not have permission for this action.")}</p>
                ) : (
                  <>
                    {!snapshot.events.length && <p>{t("No activity yet.")}</p>}
                    {snapshot.events.map((event) => (
                      <article key={event.id}>
                        <p>
                          {t(auditLabels[event.action] ?? "Workspace activity")} · {t(event.outcome)}
                        </p>
                        <p>
                          {t("Actor")}: {event.actor_id}
                        </p>
                        <p>
                          {t("Target")}: {event.target_id}
                        </p>
                        <time dateTime={event.created_at}>{new Date(event.created_at).toLocaleString()}</time>
                      </article>
                    ))}
                  </>
                )}
              </section>
            )}
            {tab === "Security" && (
              <section>
                <h2>{t("Security")}</h2>
                <p>
                  {t(
                    "Trusted devices can skip sign-in codes for 30 days. Sensitive actions still require a current code. Sessions expire after 15 minutes idle or 8 hours total.",
                  )}
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const result = await api<{ ok: boolean }>("forget-device", {});
                      if (result.ok !== true) throw new Error("UNAVAILABLE");
                      setMessage(
                        "Device trust removed. Your next sign-in will require an authenticator code.",
                      );
                    })
                  }
                >
                  {t("Forget this trusted device")}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await api("logout", { all: true });
                      await refreshState();
                      setMessage("All sessions and trusted devices have been revoked.");
                    })
                  }
                >
                  {t("Sign out on all devices")}
                </button>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
