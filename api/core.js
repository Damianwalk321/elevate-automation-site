import { getUser } from '../lib/supabaseServer.js';
import { listingRepository } from '../modules/listings/listingRepository.js';
import { usageTracker } from '../modules/account/usageTracker.js';
import { planEnforcer } from '../modules/account/planEnforcer.js';

export default async function handler(req, res){
  try{
    const user = await getUser(req);

    if(!user){
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const action = req.body.action;

    switch(action){
      case 'GET_LISTINGS': {
        const listings = await listingRepository.getByUser(user.id);
        return res.status(200).json({ data: listings });
      }

      case 'UPDATE_STATUS': {
        const { id, status } = req.body;
        const result = await listingRepository.updateStatus(user.id, id, status);
        return res.status(200).json({ data: result });
      }

      case 'TRACK_USAGE': {
        const usage = await usageTracker.incrementPosts(user.id);
        return res.status(200).json({ data: usage });
      }

      default:
        return res.status(400).json({ error: 'Invalid action' });
    }

  }catch(err){
    return res.status(500).json({ error: err.message });
  }
}