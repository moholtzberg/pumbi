export const SUBMISSION_CATEGORIES = ['Books', 'Manuscripts', 'Judaica', 'Silver', 'Art', 'Jewelry', 'Coins & Medals', 'Other'];

export const SELLER_CONTACT_FIELDS = ['displayName', 'legalName', 'contactEmail', 'contactPhone', 'address'];
export const sellerContactComplete = profile => SELLER_CONTACT_FIELDS.every(key => typeof profile?.[key] === 'string' && profile[key].trim());

export function defaultSubmissionOpportunity(opportunities) {
  const options = [
    ...(opportunities?.series || []).map(item => `series:${item.id}`),
    ...(opportunities?.auctions || []).map(item => `auction:${item.id}`)
  ];
  return options.length === 1 ? options[0] : '';
}
