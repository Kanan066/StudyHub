if (localStorage.getItem("studyhub-token")) location.replace("app.html");
const $ = (id) => document.getElementById(id);
let registering = false;

function setMode(reg) {
  registering = reg;
  $("aName").hidden = !reg;
  $("authSubmit").textContent = reg ? "Create account" : "Log in";
  $("authToggle").textContent = reg ? "Already have an account? Log in" : "New here? Create an account";
  $("aPass").autocomplete = reg ? "new-password" : "current-password";
  $("authError").textContent = "";
}
$("authToggle").addEventListener("click", () => setMode(!registering));

$("authForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const body = { email: $("aEmail").value.trim(), password: $("aPass").value };
  if (registering) body.name = $("aName").value.trim();
  try {
    const res = await fetch("/api/auth/" + (registering ? "register" : "login"), {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Something went wrong");
    localStorage.setItem("studyhub-token", data.token);
    localStorage.setItem("studyhub-user", JSON.stringify(data.user));
    location.href = "app.html";
  } catch (err) {
    $("authError").textContent = err instanceof TypeError
      ? "Cannot reach the server. Run npm start, then open http://localhost:3000" : err.message;
  }
});
setMode(location.hash === "#register");
if (location.protocol === "file:") $("authError").textContent = "Do not open this file directly. Run npm start, then visit http://localhost:3000";
