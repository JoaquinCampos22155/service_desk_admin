import { createClient } from "@supabase/supabase-js";
import "../styles.css";
import { createSupabaseClient } from "./supabase-client.mjs";

function loadClassicScript(source) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = source;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`No se pudo cargar ${source}.`));
    document.head.append(script);
  });
}

try {
  window.bevstackSupabase = createSupabaseClient(import.meta.env, createClient);
  await loadClassicScript(`${import.meta.env.BASE_URL}service-desk-auth.js`);
  await loadClassicScript(`${import.meta.env.BASE_URL}service-desk-data.js`);
  await loadClassicScript(`${import.meta.env.BASE_URL}app.js`);
} catch (error) {
  const host = document.querySelector("#auth-shell");
  if (host) {
    host.hidden = false;
    host.innerHTML = `<section class="auth-card" role="alert"><div class="auth-brand"><span class="auth-brand-mark">b</span><span><strong>bevstack</strong><small>SERVICE DESK</small></span></div><div class="auth-copy"><h1>Falta configurar la conexión</h1><p>${String(error.message || "No se pudo inicializar el Service Desk.")}</p></div></section>`;
  }
}
