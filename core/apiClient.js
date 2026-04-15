export const apiClient = {
  async batch(endpoints){
    const results = await Promise.all(endpoints.map(e => fetch(e).then(r=>r.json())));
    return results;
  }
};