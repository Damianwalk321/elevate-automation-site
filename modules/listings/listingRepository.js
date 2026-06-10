import { getServerClient } from '../../lib/supabaseServer.js';

export const listingRepository = {
  async getByUser(req, userId){
    const supabase = getServerClient(req);

    const { data, error } = await supabase
      .from('listings')
      .select('*')
      .eq('user_id', userId);

    if (error) throw error;

    return data;
  },

  async updateStatus(req, userId, listingId, status){
    const supabase = getServerClient(req);

    const { data, error } = await supabase
      .from('listings')
      .update({ lifecycle_status: status })
      .eq('id', listingId)
      .eq('user_id', userId);

    if (error) throw error;

    return data;
  }
};