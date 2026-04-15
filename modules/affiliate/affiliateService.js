export const affiliateService = {
  generateCode(userId){
    return `AFF-${userId}-${Math.random().toString(36).substring(2,8)}`;
  },

  calculateCommission(amount, rate = 0.2){
    return amount * rate;
  }
};