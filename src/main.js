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
  await loadClassicScript(`${import.meta.env.BASE_URL}service-desk-data.js`);
  await loadClassicScript(`${import.meta.env.BASE_URL}app.js`);
} catch (error) {
  const host = document.querySelector("#app-content");
  if (host) {
    host.innerHTML = `<section class="panel" role="alert"><h1>Falta configurar la conexión</h1><p>${String(error.message || "No se pudo inicializar el Service Desk.")}</p></section>`;
  }
}
