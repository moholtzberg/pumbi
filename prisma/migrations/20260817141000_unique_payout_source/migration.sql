-- A platform balance source may only fund one release per auction house.
CREATE UNIQUE INDEX "payout_releases_auction_house_id_source_reference_key"
ON "payout_releases"("auction_house_id", "source_reference");
