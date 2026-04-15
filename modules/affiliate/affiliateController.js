import { affiliateService } from './affiliateService.js';

export const affiliateController = {
  createAffiliate(userId){
    const code = affiliateService.generateCode(userId);
    return { userId, code };
  },

  getCommission(amount){
    return affiliateService.calculateCommission(amount);
  }
};