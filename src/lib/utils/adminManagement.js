export const managementFields = {
  auctionHouse: [
    'name',
    'slug',
    'legalName',
    'description',
    'website',
    'country',
    'contactFirstName',
    'contactLastName',
    'contactEmail',
    'contactPhone',
    'isActive',
    'onboardingStatus',
  ],
  auction: [
    'title',
    'description',
    'auctionHouseId',
    'sellerId',
    'auctioneerId',
    'type',
    'status',
    'currency',
    'startDate',
    'endDate',
    'imageUrl',
  ],
  lot: [
    'auctionId',
    'lotNumber',
    'title',
    'hebrewTitle',
    'description',
    'hebrewDescription',
    'category',
    'startingBid',
    'bidIncrement',
    'status',
    'isReady',
    'endTime',
    'initialTimerSeconds',
    'bidExtensionSeconds',
  ],
};
export function editorFields(
  model,
  { simple = false, advanced = false, creating = false } = {},
) {
  const primary = managementFields[model.key];
  if (!simple || advanced || !primary) return model.fields;
  return model.fields.filter(
    (field) => primary.includes(field.name) || (creating && field.required),
  );
}
export function adminListUrl(path, current, patch = {}) {
  const params = new URLSearchParams(current);
  for (const [key, value] of Object.entries(patch))
    value == null || value === ''
      ? params.delete(key)
      : params.set(key, String(value));
  return path + (params.size ? `?${params}` : '');
}
