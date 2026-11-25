function auctionSettings(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  try { const parsed = JSON.parse(value || '{}'); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}; }
  catch { return {}; }
}

export function requiresBidderRegistration(auction) {
  return auctionSettings(auction?.settings).requireRegistrationToBid === true;
}

// Shared by the incoming bid, automatic defenses and the bidder-facing access API.
// Registration/verification/policy acceptance are gates only for configured sales.
export function auctionBidAccess(user, auction, registration, { phone = false, blocked = false } = {}) {
  const registrationRequired = requiresBidderRegistration(auction);
  const isPublic = String(auction.type).toUpperCase() === 'PUBLIC';
  const policyConfigured = !isPublic || Boolean(auction.platformPolicyId && auction.policyVersionSnapshot != null && auction.buyerTermsSnapshot);
  const policyAccepted = !registrationRequired || (isPublic
    ? Boolean(policyConfigured && registration?.status === 'APPROVED' && registration.termsAcceptedAt &&
        registration.acceptedPolicyId === auction.platformPolicyId &&
        registration.acceptedPolicyVersion === auction.policyVersionSnapshot &&
        registration.acceptedBuyerTermsSnapshot === auction.buyerTermsSnapshot)
    : registration?.status === 'APPROVED');
  const needsVerification = !blocked && registrationRequired && !phone && !user?.isVerifiedBuyer;
  return {
    blocked,
    registrationRequired,
    approvalRequired: registrationRequired && !isPublic,
    policyConfigured,
    policyAccepted,
    needsVerification,
    needsTermsAcceptance: !blocked && registrationRequired && !needsVerification && !policyAccepted && !['PENDING', 'REJECTED'].includes(registration?.status),
    readyToBid: Boolean(user && !blocked && !needsVerification && policyAccepted)
  };
}
