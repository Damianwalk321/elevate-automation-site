export const listingActions = {
  validateStatus(status){
    const allowed = ['active','sold','expired','draft'];
    if(!allowed.includes(status)){
      throw new Error(`Invalid status: ${status}`);
    }
    return true;
  },

  setStatus(listings, id, status){
    this.validateStatus(status);
    return listings.map(l =>
      l.id === id ? { ...l, lifecycle_status: status } : l
    );
  },

  bulkUpdate(listings, ids, status){
    this.validateStatus(status);
    if(!Array.isArray(ids)) throw new Error('ids must be array');

    return listings.map(l =>
      ids.includes(l.id) ? { ...l, lifecycle_status: status } : l
    );
  }
};