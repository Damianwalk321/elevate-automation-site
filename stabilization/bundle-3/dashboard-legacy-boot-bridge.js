(() => {
  if (window.__EA_DASHBOARD_LEGACY_BOOT_BRIDGE__) return;
  window.__EA_DASHBOARD_LEGACY_BOOT_BRIDGE__ = true;

  const originalAddEventListener = document.addEventListener.bind(document);
  const originalRemoveEventListener = document.removeEventListener.bind(document);
  const listenerMap = new WeakMap();

  function invokeBoot(listener, reason = 'bridge') {
    if (listener.__eaDashboardBootRunning) {
      return listener.__eaDashboardBootPromise || Promise.resolve();
    }

    listener.__eaDashboardBootRunning = true;
    window.__ELEVATE_DASHBOARD_LEGACY_BOOT_RAN__ = true;

    const event = new Event('DOMContentLoaded');
    event.__ea_reason = reason;

    const promise = Promise.resolve()
      .then(() => listener.call(document, event))
      .catch((error) => {
        console.error('[Elevate Dashboard] legacy boot bridge error:', error);
        throw error;
      })
      .finally(() => {
        listener.__eaDashboardBootRunning = false;
      });

    listener.__eaDashboardBootPromise = promise;
    return promise;
  }

  document.addEventListener = function patchedAddEventListener(type, listener, options) {
    if (type === 'DOMContentLoaded' && typeof listener === 'function') {
      const once = typeof options === 'object' && options && options.once === true;
      const wrapped = (event) => invokeBoot(listener, event?.__ea_reason || 'dom_ready');
      listenerMap.set(listener, wrapped);

      window.__ELEVATE_DASHBOARD_LEGACY_BOOT__ = ({ reason = 'manual' } = {}) => {
        if (reason === 'manual_retry') {
          listener.__eaDashboardBootRunning = false;
        }
        return invokeBoot(listener, reason);
      };

      if (document.readyState === 'interactive' || document.readyState === 'complete') {
        queueMicrotask(() => invokeBoot(listener, 'late_load'));
        return;
      }

      return originalAddEventListener(type, wrapped, once ? { ...options, once: false } : options);
    }

    return originalAddEventListener(type, listener, options);
  };

  document.removeEventListener = function patchedRemoveEventListener(type, listener, options) {
    if (type === 'DOMContentLoaded' && listenerMap.has(listener)) {
      const wrapped = listenerMap.get(listener);
      listenerMap.delete(listener);
      return originalRemoveEventListener(type, wrapped, options);
    }
    return originalRemoveEventListener(type, listener, options);
  };
})();
