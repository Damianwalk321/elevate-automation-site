import { apiClient } from './apiClient.js';
import { stateStore } from './stateStore.js';

export async function initApp(){
  const [profile, listings, summary] = await apiClient.batch([
    '/api/profile',
    '/api/get-user-listings',
    '/api/get-dashboard-summary'
  ]);

  stateStore.set('profile', profile);
  stateStore.set('listings', listings);
  stateStore.set('summary', summary);

  return { profile, listings, summary };
}