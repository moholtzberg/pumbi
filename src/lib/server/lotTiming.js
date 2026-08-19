export const PLATFORM_LOT_TIMING = Object.freeze({
  initialTimerSeconds: 60,
  bidExtensionSeconds: 30
});

function parseSettings(settings) {
  if (!settings) return {};
  if (typeof settings === 'object') return settings;
  try {
    const parsed = JSON.parse(settings);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function positiveInteger(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

/**
 * Resolve lot timing from the most specific configured level.
 * lot -> auction -> auction house -> platform
 */
export function resolveLotTiming({ lot = {}, auction = {}, auctionHouse = {} } = {}) {
  const auctionSettings = parseSettings(auction.settings);
  const houseSettings = parseSettings(auctionHouse.settings);

  const initialTimerSeconds = positiveInteger(lot.initialTimerSeconds)
    ?? positiveInteger(auctionSettings.automaticAuctionInitialTimerSeconds)
    ?? positiveInteger(houseSettings.automaticAuctionInitialTimerSeconds)
    ?? PLATFORM_LOT_TIMING.initialTimerSeconds;

  const bidExtensionSeconds = positiveInteger(lot.bidExtensionSeconds)
    ?? positiveInteger(auctionSettings.automaticAuctionTimerResetSeconds)
    ?? positiveInteger(houseSettings.automaticAuctionTimerResetSeconds)
    ?? PLATFORM_LOT_TIMING.bidExtensionSeconds;

  return { initialTimerSeconds, bidExtensionSeconds };
}

export function extendedEndTime(endTime, now, bidExtensionSeconds) {
  if (!endTime) return null;
  const remainingMilliseconds = new Date(endTime).getTime() - now.getTime();
  const extensionMilliseconds = bidExtensionSeconds * 1000;
  return remainingMilliseconds < extensionMilliseconds
    ? new Date(now.getTime() + extensionMilliseconds)
    : new Date(endTime);
}
