// /js/auth.js

async function signUpWithEmail(email, password, fullName = "") {
  const supabase = window.supabaseClient;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName
      }
    }
  });

  if (error) throw error;

  // Sync public users table if user object exists immediately
  if (data?.user?.id) {
    await fetch("/api/sync-user", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        auth_user_id: data.user.id,
        email: data.user.email,
        full_name: fullName
      })
    });
  }

  return data;
}

async function signInWithEmail(email, password) {
  const supabase = window.supabaseClient;

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) throw error;

  // Optional compatibility for older dashboard logic
  if (data?.user?.email) {
    localStorage.setItem("user_email", data.user.email);
  }

  return data;
}

async function signOutUser() {
  const supabase = window.supabaseClient;
  const { error } = await supabase.auth.signOut();

  localStorage.removeItem("user_email");

  if (error) throw error;
}

async function sendResetPassword(email) {
  const supabase = window.supabaseClient;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password.html`
  });

  if (error) throw error;
}

async function updatePassword(newPassword) {
  const supabase = window.supabaseClient;

  const { error } = await supabase.auth.updateUser({
    password: newPassword
  });

  if (error) throw error;
}

async function getCurrentUser() {
  const supabase = window.supabaseClient;
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

    return user;
  } catch (err) {
    console.error("Auth check failed:", err);
    window.location.href = "/login.html";
    return null;
  }
}

// Auth state listener
document.addEventListener("DOMContentLoaded", () => {
  const supabase = window.supabaseClient;
  if (!supabase) return;

  supabase.auth.onAuthStateChange(async (event, session) => {
    if (session?.user?.email) {
      localStorage.setItem("user_email", session.user.email);

      await fetch("/api/sync-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          auth_user_id: session.user.id,
          email: session.user.email,
          full_name: session.user.user_metadata?.full_name || ""
        })
      });
    }

    if (event === "SIGNED_OUT") {
      localStorage.removeItem("user_email");
    }
  });
});

// expose to window
window.signUpWithEmail = signUpWithEmail;
window.signInWithEmail = signInWithEmail;
window.signOutUser = signOutUser;
window.sendResetPassword = sendResetPassword;
window.updatePassword = updatePassword;
window.getCurrentUser = getCurrentUser;
window.requireAuth = requireAuth;
