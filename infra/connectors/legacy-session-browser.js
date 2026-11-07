// Keep the original editors on the installation's revocable native session.
document.addEventListener("click", async (event) => {
  const anchor = event.target instanceof Element ? event.target.closest('a[href="/logout"]') : null;
  if (!anchor) return;
  event.preventDefault();
  try {
    const status = await fetch("/openhub/api/operator/auth/status", { cache: "no-store" });
    const { csrf } = await status.json();
    const response = await fetch("/openhub/api/operator/auth/logout", {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": csrf },
      body: "{}",
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Logout unavailable");
    location.assign("/openhub/live");
  } catch {
    location.assign("/openhub/live");
  }
});
