export const listingService = {
  updateStatus(listing, status){
    return { ...listing, lifecycle_status: status };
  },

  markStale(listings){
    return listings.filter(l => l.days_live > 30);
  }
};