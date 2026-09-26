export const formatPrice = (amount: number, currency: 'INR' = 'INR'): string =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
