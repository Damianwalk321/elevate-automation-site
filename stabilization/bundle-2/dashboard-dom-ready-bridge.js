(() => {
  if (window.__EA_DASHBOARD_DOM_READY_BRIDGE__) return;
  window.__EA_DASHBOARD_DOM_READY_BRIDGE__ = true;

  const originalAddEventListener = document.addEventListener.bind(document);
  const originalRemoveEventListener = document.removeEventListener.bind(document);
  const lateDomReadyMap = new WeakMap();

  function isDomReady() {
    return document.readyState === 'interactive' || document.readyState === 'complete';
  }

  document.addEventListener = function patchedAddEventListener(type, listener, options) {
    if (type === 'DOMContentLoaded' && typeof listener === 'function' && isDomReady()) {
      const once = typeof options === 'object' && options && options.once === true;
      const wrapped = () => {
        try {
          listener.call(document, new Event('DOMContentLoaded'));
        } catch (error) {
          console.error('[Elevate Dashboard] late DOMContentLoaded bridge error:', error);
        }
      };
      lateDomReadyMap.set(listener, wrapped);
      queueMicrotask(wrapped);
      if (!once) return;
      return;
    }
    return originalAddEventListener(type, listener, options);
  };

  document.removeEventListener = function patchedRemoveEventListener(type, listener, options) {
    if (type === 'DOMContentLoaded' && lateDomReadyMap.has(listener)) {
      lateDomReadyMap.delete(listener);
      return;
    }
    return originalRemoveEventListener(type, listener, options);
  };
})();
