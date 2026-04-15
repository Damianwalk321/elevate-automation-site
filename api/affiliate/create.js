import { affiliateController } from '../../modules/affiliate/affiliateController.js';

export default async function handler(req, res){
  try{
    const { userId } = req.body;

    if(!userId){
      return res.status(400).json({ error: 'Missing userId' });
    }

    const affiliate = affiliateController.createAffiliate(userId);

    return res.status(200).json({ success: true, data: affiliate });
  }catch(err){
    return res.status(500).json({ error: err.message });
  }
}