// /js/auth.js

function getSupabaseClient() {
  if (!window.supabaseClient) {
    throw new Error("Supabase client is not initialized.");
  }
  return window.supabaseClient;
}

async function syncUserToAppTable(user) {
  if (!user || !user.id || !user.email) return;

  try {
    await fetch("/api/sync-user", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        auth_user_id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || ""
      })
    });
  } catch (error) {
    console.error("User sync failed:", error);
  }
}

async function signUpWithEmail(email, password, fullName = "") {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.auth.signUp({
    email: email,
    password: password,
    options: {
      data: {
        full_name: fullName
      },
      emailRedirectTo: `${window.location.origin}/login.html`
    }
  });

  if (error) throw error;

  if (data?.user) {
    await syncUserToAppTable(data.user);
  }

  return data;
}

async function signInWithEmail(email, password) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email,
    password: password
  });

  if (error) throw error;

  if (data?.user?.email) {
    localStorage.setItem("user_email", data.user.email);
    await syncUserToAppTable(data.user);
  }

  return data;
}

async function signOutUser() {
  const supabase = getSupabaseClient();

  const { error } = await supabase.auth.signOut();

  localStorage.removeItem("user_email");

  if (error) throw error;
}

async function sendResetPassword(email) {
  const supabase = getSupabaseClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password.html`
  });

  if (error) throw error;
}

async function updatePassword(newPassword) {
  const supabase = getSupabaseClient();

  const { error } = await supabase.auth.updateUser({
    password: newPassword
  });

  if (error) throw error;
}

async function getCurrentUser() {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.auth.getUser();

  if (error) throw error;

  return data.user;
}

async function requireAuth() {
  try {
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
  } catch (error) {
    console.error("Auth check failed:", error);
    window.location.href = "/login.html";
    return null;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (!window.supabaseClient) {
    console.error("Supabase client missing on page.");
    return;
  }

  window.supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (session?.user?.email) {
      localStorage.setItem("user_email", session.user.email);
      await syncUserToAppTable(session.user);
    }

    if (event === "SIGNED_OUT") {
      localStorage.removeItem("user_email");
    }
  });
});

window.signUpWithEmail = signUpWithEmail;
window.signInWithEmail = signInWithEmail;
window.signOutUser = signOutUser;
window.sendResetPassword = sendResetPassword;
window.updatePassword = updatePassword;
window.getCurrentUser = getCurrentUser;
window.requireAuth = requireAuth;
