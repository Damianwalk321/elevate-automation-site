(() => {
  if (window.__ELEVATE_BUNDLE_F_REVIEW_ACTIONS__) return;
  window.__ELEVATE_BUNDLE_F_REVIEW_ACTIONS__ = true;

  const CSS = `
    .ea-review-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
    .ea-review-status{margin-top:10px;font-size:12px;color:#d4af37;min-height:16px}
    .ea-review-inline-note{font-size:12px;color:#a9a9a9;line-height:1.5}
    .ea-price-review-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center}
    .ea-price-review-row input{
      background:#101010;border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:11px 12px;color:#f5f5f5;
      font-size:13px;outline:none;width:100%;
    }
    .ea-review-primary{
      background:rgba(212,175,55,.15)!important;
      border-color:rgba(212,175,55,.28)!important;
      color:#f3ddb0!important;
      font-weight:700!important;
    }
    @media (max-width:760px){.ea-review-actions,.ea-price-review-row{grid-template-columns:1fr}}
  `;

  function ensureStyle() {
    if (document.getElementById('ea-bundle-f-review-style')) return;
    const style = document.createElement('style');
    style.id = 'ea-bundle-f-review-style';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function getIdentityPayloadFromNode(node) {
    const raw = clean(node?.getAttribute('data-review-item') || '');
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  function getUserIdentity() {
    const summary = window.dashboardSummary || {};
    const snapshot = summary.account_snapshot || {};
    return {
      userId: clean(snapshot.user_id || ''),
      email: clean(snapshot.email || '')
    };
  }

  async function postReviewAction(identity, action, extra = {}) {
    const identityUser = getUserIdentity();
    const body = {
      action,
      id: identity?.id || '',
      identity_key: identity?.identity_key || '',
      vin: identity?.vin || '',
      stock_number: identity?.stock_number || '',
      source_url: identity?.source_url || '',
      userId: identityUser.userId,
      email: identityUser.email,
      ...extra
    };

    const response = await fetch('/api/review-listing-action', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-elevate-client': 'dashboard'
      },
      body: JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || 'Review action failed');
    return data;
  }

  async function refreshDashboardSurfaces() {
    try {
      window.dispatchEvent(new CustomEvent('elevate:tracking-refreshed'));
      window.dispatchEvent(new CustomEvent('elevate:sync-refreshed'));
      const refreshBtn = document.getElementById('refreshListingsBtn');
      if (refreshBtn) refreshBtn.click();
    } catch {}
  }

  function parsePriceValue(raw) {
    const n = Number(String(raw || '').replace(/[^0-9.]/g, ''));
    return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
  }

  function injectActionPanels() {
    document.querySelectorAll('.ea-review-item').forEach((item) => {
      if (item.dataset.bundleFActions === 'true') return;
      const identity = getIdentityPayloadFromNode(item);
      if (!identity) return;
      item.dataset.bundleFActions = 'true';

      const note = document.createElement('div');
      note.className = 'ea-review-inline-note';
      note.textContent = 'Save the outcome, then refresh the workspace.';

      const actions = document.createElement('div');
      actions.className = 'ea-review-actions';
      actions.innerHTML = `
        <button class="action-btn ea-review-primary" type="button" data-review-action="keep_live">Keep live</button>
        <button class="action-btn" type="button" data-review-action="mark_sold">Mark sold</button>
        <button class="action-btn" type="button" data-review-action="send_to_price_review">Price review</button>
        <button class="action-btn" type="button" data-review-action="mark_stale">Mark stale</button>
      `;

      const priceRow = document.createElement('div');
      priceRow.className = 'ea-price-review-row';
      priceRow.innerHTML = `
        <input type="text" inputmode="numeric" placeholder="Updated price">
        <button class="action-btn" type="button" data-review-action="mark_price_updated">Save price</button>
      `;

      const status = document.createElement('div');
      status.className = 'ea-review-status';

      actions.querySelectorAll('[data-review-action]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const action = btn.getAttribute('data-review-action');
          status.textContent = 'Saving...';
          try {
            await postReviewAction(identity, action);
            status.textContent = `Saved: ${action.replace(/_/g, ' ')}`;
            await refreshDashboardSurfaces();
          } catch (error) {
            status.textContent = error?.message || 'Action failed';
          }
        });
      });

      const priceInput = priceRow.querySelector('input');
      const priceBtn = priceRow.querySelector('[data-review-action="mark_price_updated"]');
      priceBtn.addEventListener('click', async () => {
        const parsed = parsePriceValue(priceInput.value);
        if (!parsed) {
          status.textContent = 'Enter a valid price.';
          return;
        }
        status.textContent = 'Saving price...';
        try {
          await postReviewAction(identity, 'mark_price_updated', { price: parsed });
          status.textContent = `Saved price: $${parsed.toLocaleString()}`;
          await refreshDashboardSurfaces();
        } catch (error) {
          status.textContent = error?.message || 'Price update failed';
        }
      });

      item.appendChild(note);
      item.appendChild(actions);
      item.appendChild(priceRow);
      item.appendChild(status);
    });
  }

  function patchRecentListingPrices() {
    const cards = Array.from(document.querySelectorAll('#recentListingsGrid .listing-card'));
    const recent = Array.isArray(window.dashboardSummary?.recent_listings) ? window.dashboardSummary.recent_listings : [];
    cards.forEach((card, index) => {
      const row = recent[index];
      const priceEl = card.querySelector('.listing-price');
      if (!row || !priceEl) return;
      const resolved = row.price_resolved !== false;
      priceEl.textContent = clean(row.display_price_text || (resolved && row.price ? `$${Number(row.price).toLocaleString()}` : 'Price pending'));
      priceEl.style.color = resolved ? '' : '#ffcfad';
    });
  }

  function boot() {
    ensureStyle();
    injectActionPanels();
    patchRecentListingPrices();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
  window.addEventListener('elevate:tracking-refreshed', () => setTimeout(boot, 150));
  window.addEventListener('elevate:sync-refreshed', () => setTimeout(boot, 150));
  window.addEventListener('load', () => setTimeout(boot, 500));
})();
