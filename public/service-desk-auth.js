"use strict";

(() => {
  class ServiceDeskAuthError extends Error {
    constructor(message, cause) {
      super(message, { cause });
      this.name = "ServiceDeskAuthError";
      this.code = cause?.code;
    }
  }

  function createServiceDeskAuth(client) {
    if (!client?.auth) throw new ServiceDeskAuthError("La autenticación de Supabase no está disponible.");
    return {
      async start(callbacks = {}) {
        const { data, error } = await client.auth.getSession();
        if (error) throw new ServiceDeskAuthError(error.message || "No se pudo recuperar la sesión.", error);
        const result = client.auth.onAuthStateChange((event, session) => {
          callbacks.onAuthEvent?.(event, session);
          callbacks.onSession?.(session || null, event);
        });
        callbacks.onSession?.(data.session || null, "INITIAL_SESSION");
        return result?.data?.subscription;
      },
      async signIn(email, password) {
        const { data, error } = await client.auth.signInWithPassword({ email: String(email).trim(), password });
        if (error) throw new ServiceDeskAuthError(error.message || "No se pudo iniciar sesión.", error);
        return data.session;
      },
      async sendPasswordReset(email) {
        const { error } = await client.auth.resetPasswordForEmail(String(email).trim(), { redirectTo: window.location.origin });
        if (error) throw new ServiceDeskAuthError(error.message || "No se pudo enviar el enlace.", error);
      },
      async updatePassword(password) {
        const { error } = await client.auth.updateUser({ password });
        if (error) throw new ServiceDeskAuthError(error.message || "No se pudo actualizar la contraseña.", error);
      },
      async signOut() {
        const { error } = await client.auth.signOut();
        if (error) throw new ServiceDeskAuthError(error.message || "No se pudo cerrar la sesión.", error);
      },
    };
  }

  window.ServiceDeskAuth = {
    ServiceDeskAuthError,
    createServiceDeskAuth,
    ...createServiceDeskAuth(window.bevstackSupabase),
  };
})();
