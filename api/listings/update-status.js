import { listingActions } from '../../modules/listings/listingActions.js';

export default async function handler(req, res){
  try{
    const { listings, id, status } = req.body;

    if(!listings || !id || !status){
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const updated = listingActions.setStatus(listings, id, status);

    return res.status(200).json({ success: true, data: updated });
  }catch(err){
    return res.status(500).json({ error: err.message });
  }
}