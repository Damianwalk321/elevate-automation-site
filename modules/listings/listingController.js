import { listingService } from './listingService.js';

export const listingController = {
  setStatus(listing, status){
    return listingService.updateStatus(listing, status);
  },

  getStale(listings){
    return listingService.markStale(listings);
  }
};