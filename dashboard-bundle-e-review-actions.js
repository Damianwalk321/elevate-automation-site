(() => {
  if (window.__ELEVATE_BUNDLE_A_REVIEW_ACTIONS__) return;
  window.__ELEVATE_BUNDLE_A_REVIEW_ACTIONS__ = true;

  const CSS = `
    .ea-review-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
    .ea-review-status{margin-top:10px;font-size:12px;color:#d4af37;min-height:16px}
    .ea-review-inline-note{font-size:12px;color:#a9a9a9;line-height:1.5}
    .ea-review-price-box{display:grid;gap:8px;padding:12px;border:1px solid rgba(212,175,55,.12);border-radius:12px;background:#111}
    .ea-review-price-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px}
    .ea-review-price-input{width:100%;background:#171717;border:1px solid rgba(255,255,255,.08);color:#f3f3f3;border-radius:10px;padding:10px 12px;font-size:13px}
    @media (max-width:760px){.ea-review-actions,.ea-review-price-row{grid-template-columns:1fr}}
  `;

  function ensureStyle() {
    if (document.getElementById('ea-bundle-a-review-style')) return;
    const style = document.createElement('style');
    style.id = 'ea-bundle-a-review-style';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function asNumber(value) {
    const match = String(value || '').replace(/,/g, '').match(/-?\d+(\.\d+)?/);
    return match ? Number(match[0]) : 0;
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

  function buildPriceBox(identity) {
    const wrapper = document.createElement('div');
    wrapper.className = 'ea-review-price-box';

    const label = document.createElement('div');
    label.className = 'ea-review-inline-note';
    label.textContent = 'Record a reviewed price directly against the tracked listing row. This updates dashboard state; it does not directly push a live Marketplace repricing action yet.';

    const row = document.createElement('div');
    row.className = 'ea-review-price-row';

    const input = document.createElement('input');
    input.className = 'ea-review-price-input';
    input.type = 'text';
    input.inputMode = 'decimal';
    input.placeholder = 'Enter reviewed price';
    if (identity?.price) input.value = String(identity.price);

    const btn = document.createElement('button');
    btn.className = 'action-btn';
    btn.type = 'button';
    btn.textContent = 'Save Reviewed Price';

    const status = document.createElement('div');
    status.className = 'ea-review-status';

    btn.addEventListener('click', async () => {
      const numeric = asNumber(input.value);
      if (!numeric) {
        status.textContent = 'Enter a valid price first.';
        return;
      }
      status.textContent = 'Saving reviewed price...';
      try {
        await postReviewAction(identity, 'mark_price_updated', { price: numeric });
        status.textContent = `Saved reviewed price: $${numeric.toLocaleString()}`;
        await refreshDashboardSurfaces();
      } catch (error) {
        status.textContent = error?.message || 'Price update failed';
      }
    });

    row.appendChild(input);
    row.appendChild(btn);
    wrapper.appendChild(label);
    wrapper.appendChild(row);
    wrapper.appendChild(status);
    return wrapper;
  }

  function injectActionPanels() {
    document.querySelectorAll('.ea-review-item').forEach((item) => {
      if (item.dataset.bundleAActions === 'true') return;
      const identity = getIdentityPayloadFromNode(item);
      if (!identity) return;
      item.dataset.bundleAActions = 'true';

      const note = document.createElement('div');
      note.className = 'ea-review-inline-note';
      note.textContent = 'Persist review outcomes directly to listing rows, then refresh the dashboard surfaces.';

      const actions = document.createElement('div');
      actions.className = 'ea-review-actions';
      actions.innerHTML = `
        <button class="action-btn" type="button" data-review-action="keep_live">Keep Live</button>
        <button class="action-btn" type="button" data-review-action="mark_sold">Mark Sold</button>
        <button class="action-btn" type="button" data-review-action="send_to_price_review">Send to Price Watch</button>
        <button class="action-btn" type="button" data-review-action="mark_stale">Mark Stale</button>
      `;

      const status = document.createElement('div');
      status.className = 'ea-review-status';

      actions.querySelectorAll('[data-review-action]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const action = btn.getAttribute('data-review-action');
          status.textContent = 'Saving review action...';
          try {
            await postReviewAction(identity, action);
            status.textContent = `Saved: ${action.replace(/_/g, ' ')}`;
            await refreshDashboardSurfaces();
          } catch (error) {
            status.textContent = error?.message || 'Action failed';
          }
        });
      });

      item.appendChild(note);
      item.appendChild(actions);
      item.appendChild(buildPriceBox(identity));
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
