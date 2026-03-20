// /js/auth.js

(function () {
  function getSupabaseClient() {
    if (!window.supabaseClient) {
      throw new Error("Supabase client is not initialized.");
    }
    return window.supabaseClient;
  }

  function withTimeout(promise, ms, label = "Operation") {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
      )
    ]);
  }

  async function syncUserToAppTable(user) {
    if (!user || !user.id || !user.email) return;

    try {
      const response = await fetch("/api/sync-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || ""
        })
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        console.error("sync-user failed:", data || response.statusText);
        return;
      }

      if (data?.ok === false && !data?.skipped) {
        console.error("sync-user returned non-ok payload:", data);
      }
    } catch (error) {
      console.error("User sync failed:", error);
    }
  }

  async function signUpWithEmail(email, password, fullName = "") {
    const supabase = getSupabaseClient();

    const { data, error } = await withTimeout(
      supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName
          },
          emailRedirectTo: `${window.location.origin}/login.html`
        }
      }),
      10000,
      "Sign up"
    );

    if (error) throw error;

    if (data?.user) {
      await syncUserToAppTable(data.user);
    }

    return data;
  }

  async function signInWithEmail(email, password) {
    const supabase = getSupabaseClient();

    const { data, error } = await withTimeout(
      supabase.auth.signInWithPassword({
        email,
        password
      }),
      10000,
      "Login"
    );

    if (error) throw error;

    if (data?.user?.email) {
      localStorage.setItem("user_email", data.user.email);
      await syncUserToAppTable(data.user);
    }

    return data;
  }

  async function signOutUser() {
    const supabase = getSupabaseClient();

    const { error } = await withTimeout(
      supabase.auth.signOut(),
      10000,
      "Logout"
    );

    localStorage.removeItem("user_email");

    if (error) throw error;
  }

  async function sendResetPassword(email) {
    const supabase = getSupabaseClient();

    const { error } = await withTimeout(
      supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password.html`
      }),
      10000,
      "Reset password email"
    );

    if (error) throw error;
  }

  async function updatePassword(newPassword) {
    const supabase = getSupabaseClient();

    const { error } = await withTimeout(
      supabase.auth.updateUser({
        password: newPassword
      }),
      10000,
      "Update password"
    );

    if (error) throw error;
  }

  async function getCurrentUser() {
    const supabase = getSupabaseClient();

    const sessionResult = await withTimeout(
      supabase.auth.getSession(),
      8000,
      "Get session"
    );

    if (sessionResult?.error) {
      throw sessionResult.error;
    }

    const sessionUser = sessionResult?.data?.session?.user;
    if (sessionUser) {
      return sessionUser;
    }

    const userResult = await withTimeout(
      supabase.auth.getUser(),
      8000,
      "Get user"
    );

    if (userResult?.error) {
      throw userResult.error;
    }

    return userResult?.data?.user || null;
  }

  async function requireAuth() {
    const user = await getCurrentUser();

    if (!user) {
      window.location.href = "/login.html";
      return null;
    }

    if (user.email) {
      localStorage.setItem("user_email", user.email);
    }

    await syncUserToAppTable(user);

    return user;
  }

  window.signUpWithEmail = signUpWithEmail;
  window.signInWithEmail = signInWithEmail;
  window.signOutUser = signOutUser;
  window.sendResetPassword = sendResetPassword;
  window.updatePassword = updatePassword;
  window.getCurrentUser = getCurrentUser;
  window.requireAuth = requireAuth;

  document.addEventListener("DOMContentLoaded", function () {
    try {
      if (!window.supabaseClient) {
        console.error("Supabase client missing on page.");
        return;
      }

      window.supabaseClient.auth.onAuthStateChange(async function (event, session) {
        if (session?.user?.email) {
          localStorage.setItem("user_email", session.user.email);
        }

        if (session?.user?.id && session?.user?.email) {
          await syncUserToAppTable(session.user);
        }

        if (event === "SIGNED_OUT") {
          localStorage.removeItem("user_email");
        }
      });
    } catch (error) {
      console.error("Auth state listener setup failed:", error);
    }
  });

  console.log("auth.js loaded successfully");
})();
