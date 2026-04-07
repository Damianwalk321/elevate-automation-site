(function () {
  function clean(value) {
    return String(value || "").trim();
  }

  function getClient() {
    const client = window.supabaseClient;
    if (!client) {
      throw new Error("Supabase client is not initialized.");
    }
    return client;
  }

  async function getSessionToken() {
    const client = getClient();
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    return data?.session?.access_token || "";
  }

  async function syncUserRecord() {
    try {
      const token = await getSessionToken();
      if (!token) return;

      await fetch("/api/sync-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "x-elevate-client": "dashboard"
        },
        body: JSON.stringify({})
      });
    } catch (error) {
      console.warn("[Elevate Auth] syncUserRecord warning:", error);
    }
  }

  async function signInWithEmail(email, password) {
    const client = getClient();
    const { data, error } = await client.auth.signInWithPassword({
      email: clean(email).toLowerCase(),
      password
    });

    if (error) throw error;
    await syncUserRecord();
    return data;
  }

  async function signUpWithEmail(email, password, fullName = "", referral = {}) {
    const client = getClient();
    const referralCode = clean(referral?.referral_code || "");
    const referralSource = clean(referral?.referral_source || "");

    const { data, error } = await client.auth.signUp({
      email: clean(email).toLowerCase(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/login.html`,
        data: {
          full_name: clean(fullName),
          referral_code: referralCode,
          referral_source: referralSource
        }
      }
    });

    if (error) throw error;
    await syncUserRecord();
    return data;
  }

  async function sendResetPassword(email) {
    const client = getClient();
    const { data, error } = await client.auth.resetPasswordForEmail(clean(email).toLowerCase(), {
      redirectTo: `${window.location.origin}/reset-password.html`
    });

    if (error) throw error;
    return data;
  }

  async function updatePassword(newPassword) {
    const client = getClient();
    const { data, error } = await client.auth.updateUser({ password: newPassword });
    if (error) throw error;
    return data;
  }

  async function signOutWithEmail() {
    const client = getClient();
    const { error } = await client.auth.signOut();
    if (error) throw error;
  }

  window.signInWithEmail = signInWithEmail;
  window.signUpWithEmail = signUpWithEmail;
  window.sendResetPassword = sendResetPassword;
  window.updatePassword = updatePassword;
  window.signOutWithEmail = signOutWithEmail;

  console.log("[Elevate Auth] Browser auth helpers loaded.");
})();
