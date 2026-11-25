export function broadcastInfo({ auction, currentLot = null, nextLot = null, biddingOpen = false }) {
  const price = Number(currentLot?.currentBid) || Number(currentLot?.startingBid) || 0;
  const hasBid = Boolean(currentLot?.highestBidderId || currentLot?.highestBidderName || Number(currentLot?.currentBid) > Number(currentLot?.startingBid || 0));
  return {
    platform: 'Pumbi',
    fairWarning: Boolean(biddingOpen && currentLot?.fairWarningAt),
    house: auction?.auctionHouse?.name || auction?.privateHouseNameSnapshot || 'Auction house',
    title: auction?.title || 'Live auction',
    currentLot: currentLot ? { id: currentLot.id, lotNumber: currentLot.lotNumber, title: currentLot.title || 'Untitled lot', price, priceLabel: hasBid ? 'Current bid' : 'Opening bid', endTime: biddingOpen ? currentLot.endTime : null } : null,
    nextLot: nextLot && nextLot.id !== currentLot?.id ? { id: nextLot.id, lotNumber: nextLot.lotNumber, title: nextLot.title || 'Untitled lot' } : null,
    biddingOpen: Boolean(biddingOpen && currentLot)
  };
}
