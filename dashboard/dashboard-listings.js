import { initApp } from '../core/initApp.js';
import { listingController } from '../modules/listings/listingController.js';

async function loadListings(){
  const { listings } = await initApp();

  const stale = listingController.getStale(listings);

  console.log('All Listings:', listings);
  console.log('Stale Listings:', stale);

  return { listings, stale };
}

export { loadListings };