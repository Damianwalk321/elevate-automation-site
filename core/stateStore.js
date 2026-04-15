let store = {};

export const stateStore = {
  set: (key, value) => { store[key] = value; },
  get: (key) => store[key]
};