import prisma from './prisma.js';
import { AuctionHouse, User, Auction, Lot, Bid } from './models/index.js';

// Helper functions to map Prisma models to API format
function mapAuctionHouse(prismaAuctionHouse) {
  if (!prismaAuctionHouse) return null;
  return {
    id: prismaAuctionHouse.id,
    name: prismaAuctionHouse.name,
    slug: prismaAuctionHouse.slug,
    domain: prismaAuctionHouse.domain,
    description: prismaAuctionHouse.description,
    logoUrl: prismaAuctionHouse.logoUrl,
    settings: prismaAuctionHouse.settings,
    isActive: prismaAuctionHouse.isActive,
    createdAt: prismaAuctionHouse.createdAt,
    updatedAt: prismaAuctionHouse.updatedAt
  };
}

function mapAuction(prismaAuction) {
  if (!prismaAuction) return null;
  return {
    id: prismaAuction.id,
    title: prismaAuction.title,
    description: prismaAuction.description,
    startDate: prismaAuction.startDate,
    endDate: prismaAuction.endDate,
    status: prismaAuction.status.toLowerCase(),
    type: prismaAuction.type?.toLowerCase() || 'private',
    imageUrl: prismaAuction.imageUrl,
    settings: prismaAuction.settings,
    auctionHouseId: prismaAuction.auctionHouseId,
    sellerId: prismaAuction.sellerId,
    seriesId: prismaAuction.seriesId,
    seriesOccurrenceAt: prismaAuction.seriesOccurrenceAt,
    platformPolicyId: prismaAuction.platformPolicyId,
    policyVersionSnapshot: prismaAuction.policyVersionSnapshot,
    buyerTermsSnapshot: prismaAuction.buyerTermsSnapshot,
    sellerTermsSnapshot: prismaAuction.sellerTermsSnapshot,
    buyerPremiumRateSnapshot: prismaAuction.buyerPremiumRateSnapshot == null
      ? null
      : Number(prismaAuction.buyerPremiumRateSnapshot),
    sellerCommissionRateSnapshot: prismaAuction.sellerCommissionRateSnapshot == null
      ? null
      : Number(prismaAuction.sellerCommissionRateSnapshot),
    rateConfigSnapshot: prismaAuction.rateConfigSnapshot,
    privateHouseNameSnapshot: prismaAuction.privateHouseNameSnapshot,
    privateHouseBuyerTermsSnapshot: prismaAuction.privateHouseBuyerTermsSnapshot,
    privateHouseSellerTermsSnapshot: prismaAuction.privateHouseSellerTermsSnapshot,
    privateHouseBuyerPremiumRateSnapshot: prismaAuction.privateHouseBuyerPremiumRateSnapshot == null
      ? null
      : Number(prismaAuction.privateHouseBuyerPremiumRateSnapshot),
    privateHouseSellerCommissionRateSnapshot: prismaAuction.privateHouseSellerCommissionRateSnapshot == null
      ? null
      : Number(prismaAuction.privateHouseSellerCommissionRateSnapshot),
    privateHouseRateConfigSnapshot: prismaAuction.privateHouseRateConfigSnapshot,
    createdAt: prismaAuction.createdAt,
    updatedAt: prismaAuction.updatedAt,
    auctionHouse: prismaAuction.auctionHouse ? mapAuctionHouse(prismaAuction.auctionHouse) : null,
    seller: prismaAuction.seller ? mapUser(prismaAuction.seller, false) : null
  };
}

async function mapLot(prismaLot) {
  if (!prismaLot) return null;
  
  // Import presigned URL converter (dynamic import to avoid circular deps)
  const { convertToPresignedUrl, convertImageObjects } = await import('$lib/utils/s3Presigned.js');
  
  // Get images from relation or fallback to legacy fields
  let imageUrl = null;
  let imageUrls = null;
  let images = [];
  
  if (prismaLot.images && Array.isArray(prismaLot.images)) {
    images = prismaLot.images.map(img => ({
      id: img.id,
      url: img.url,
      cloudKey: img.cloudKey,
      displayOrder: img.displayOrder,
      isPrimary: img.isPrimary,
      isHidden: img.isHidden || false
    }));
    
    // Convert image URLs to presigned URLs
    images = await convertImageObjects(images);
    
    // Set primary image as imageUrl for backward compatibility (exclude hidden images)
    const visibleImages = images.filter(img => !img.isHidden);
    const primaryImage = visibleImages.find(img => img.isPrimary) || visibleImages[0];
    if (primaryImage) {
      imageUrl = await convertToPresignedUrl(primaryImage.url || primaryImage);
    }
    
    // Set all image URLs for backward compatibility (only visible images)
    if (visibleImages.length > 0) {
      const urls = visibleImages.map(img => img.url || img);
      imageUrls = JSON.stringify(urls);
    }
  } else {
    // Fallback to legacy fields
    imageUrl = await convertToPresignedUrl(prismaLot.imageUrl);
    if (prismaLot.imageUrls) {
      const parsed = typeof prismaLot.imageUrls === 'string' 
        ? JSON.parse(prismaLot.imageUrls) 
        : prismaLot.imageUrls;
      if (Array.isArray(parsed)) {
        const presignedUrls = await Promise.all(parsed.map(url => convertToPresignedUrl(url)));
        imageUrls = JSON.stringify(presignedUrls);
      } else {
        imageUrls = prismaLot.imageUrls;
      }
    }
  }
  
  return {
    id: prismaLot.id,
    auctionId: prismaLot.auctionId,
    lotNumber: prismaLot.lotNumber,
    position: prismaLot.position || 0,
    title: prismaLot.title,
    HebrewTitle: prismaLot.hebrewTitle,
    hebrewTitle: prismaLot.hebrewTitle,
    description: prismaLot.description,
    HebrewDescription: prismaLot.hebrewDescription,
    hebrewDescription: prismaLot.hebrewDescription,
    category: prismaLot.category,
    tags: prismaLot.tags,
    metaFields: prismaLot.metaFields,
    startingBid: prismaLot.startingBid,
    currentBid: prismaLot.currentBid,
    bidIncrement: prismaLot.bidIncrement,
    imageUrl,
    imageUrls: typeof imageUrls === 'string' ? imageUrls : (imageUrls ? JSON.stringify(imageUrls) : null),
    images, // New: array of image objects
    status: prismaLot.status.toLowerCase(),
    endTime: prismaLot.endTime,
    highestBidderId: prismaLot.highestBidderId,
    highestBidderName: prismaLot.highestBidderName,
    isReady: prismaLot.isReady,
    watchersCount: prismaLot.watchersCount,
    submittingSellerProfileId: prismaLot.submittingSellerProfileId,
    submissionId: prismaLot.submissionId,
    ownerUserId: prismaLot.ownerUserId,
    createdAt: prismaLot.createdAt,
    updatedAt: prismaLot.updatedAt,
    auction: prismaLot.auction ? mapAuction(prismaLot.auction) : null
  };
}

function mapBid(prismaBid) {
  if (!prismaBid) return null;
  return {
    id: prismaBid.id,
    lotId: prismaBid.lotId,
    userId: prismaBid.userId,
    userName: prismaBid.userName,
    amount: prismaBid.amount,
    timestamp: prismaBid.timestamp
  };
}

function mapUser(prismaUser, includePassword = true) {
  if (!prismaUser) return null;
  return {
    id: prismaUser.id,
    email: prismaUser.email,
    password: includePassword ? prismaUser.password : undefined,
    name: prismaUser.name,
    firstName: prismaUser.firstName,
    lastName: prismaUser.lastName,
    phone: prismaUser.phone,
    address: prismaUser.address,
    isVerifiedBuyer: prismaUser.isVerifiedBuyer,
    isVerifiedBidder: prismaUser.isVerifiedBidder,
    role: prismaUser.role.toLowerCase(),
    auctionHouseId: prismaUser.auctionHouseId,
    createdAt: prismaUser.createdAt,
    updatedAt: prismaUser.updatedAt
  };
}

export const db = {
  auctionHouses: {
    getAll: async () => {
      const houses = await prisma.auctionHouse.findMany({
        where: { isActive: true }
      });
      return houses.map(mapAuctionHouse);
    },
    getById: async (id) => {
      const house = await prisma.auctionHouse.findUnique({
        where: { id }
      });
      return mapAuctionHouse(house);
    },
    getBySlug: async (slug) => {
      const house = await prisma.auctionHouse.findUnique({
        where: { slug }
      });
      return mapAuctionHouse(house);
    },
    create: async (data) => {
      const house = await prisma.auctionHouse.create({
        data
      });
      return mapAuctionHouse(house);
    },
    update: async (id, updates) => {
      const house = await prisma.auctionHouse.update({
        where: { id },
        data: updates
      });
      return mapAuctionHouse(house);
    }
  },
  auctions: {
    getAll: async (options = {}) => {
      const where = options.auctionHouseId 
        ? { auctionHouseId: options.auctionHouseId }
        : {};
      const auctions = await prisma.auction.findMany({
        where,
        include: {
          seller: true,
          auctionHouse: true
        }
      });
      return auctions.map(mapAuction);
    },
    getById: async (id) => {
      const auction = await prisma.auction.findUnique({
        where: { id },
        include: {
          seller: true,
          auctionHouse: true
        }
      });
      return mapAuction(auction);
    },
    create: async (auction) => {
      const created = await prisma.auction.create({
        data: auction,
        include: {
          seller: true,
          auctionHouse: true
        }
      });
      return mapAuction(created);
    },
    update: async (id, updates) => {
      const updated = await prisma.auction.update({
        where: { id },
        data: updates,
        include: {
          seller: true,
          auctionHouse: true
        }
      });
      return mapAuction(updated);
    }
  },
  lots: {
    getByAuctionId: async (auctionId) => {
      try {
        const lots = await prisma.lot.findMany({
          where: { auctionId },
          include: {
            images: {
              orderBy: [{ isPrimary: 'desc' }, { displayOrder: 'asc' }]
            }
          },
          orderBy: [
            { position: 'asc' },
            { lotNumber: 'asc' }
          ]
        });
        return await Promise.all(lots.map(lot => mapLot(lot)));
      } catch (error) {
        // Fallback if images relation doesn't exist yet (before migration)
        if (error.message?.includes('Unknown field `images`')) {
          const lots = await prisma.lot.findMany({
            where: { auctionId },
            orderBy: [
              { position: 'asc' },
              { lotNumber: 'asc' }
            ]
          });
          return await Promise.all(lots.map(lot => mapLot(lot)));
        }
        throw error;
      }
    },
    getById: async (id) => {
      try {
        const lot = await prisma.lot.findUnique({
          where: { id },
          include: {
            auction: true,
            images: {
              orderBy: [{ isPrimary: 'desc' }, { displayOrder: 'asc' }]
            }
          }
        });
        return await mapLot(lot);
      } catch (error) {
        // Fallback if images relation doesn't exist yet (before migration)
        if (error.message?.includes('Unknown field `images`')) {
          const lot = await prisma.lot.findUnique({
            where: { id },
            include: {
              auction: true
            }
          });
          return await mapLot(lot);
        }
        throw error;
      }
    },
    create: async (lot) => {
      const { images, ...lotData } = lot;
      try {
        const created = await prisma.lot.create({
          data: lotData,
          include: {
            images: true
          }
        });
        return await mapLot(created);
      } catch (error) {
        // Fallback if images relation doesn't exist yet (before migration)
        if (error.message?.includes('Unknown field `images`')) {
          const created = await prisma.lot.create({
            data: lotData
          });
          return await mapLot(created);
        }
        throw error;
      }
    },
    update: async (id, updates) => {
      const { images, ...lotData } = updates;
      try {
        const updated = await prisma.lot.update({
          where: { id },
          data: lotData,
          include: {
            images: {
              orderBy: [{ isPrimary: 'desc' }, { displayOrder: 'asc' }]
            }
          }
        });
        return await mapLot(updated);
      } catch (error) {
        // Fallback if images relation doesn't exist yet (before migration)
        if (error.message?.includes('Unknown field `images`')) {
          const updated = await prisma.lot.update({
            where: { id },
            data: lotData
          });
          return await mapLot(updated);
        }
        throw error;
      }
    }
  },
  bids: {
    getByLotId: async (lotId) => {
      const bids = await prisma.bid.findMany({
        where: { lotId },
        orderBy: { timestamp: 'desc' }
      });
      return bids.map(mapBid);
    },
    getByUserId: async (userId) => {
      const bids = await prisma.bid.findMany({
        where: { userId },
        orderBy: { timestamp: 'desc' }
      });
      return bids.map(mapBid);
    },
    create: async (bid) => {
      const created = await prisma.bid.create({
        data: bid
      });
      return mapBid(created);
    }
  },
  users: {
    getById: async (id) => {
      const user = await prisma.user.findUnique({
        where: { id }
      });
      return mapUser(user);
    },
    getByEmail: async (email) => {
      const user = await prisma.user.findUnique({
        where: { email }
      });
      return mapUser(user);
    },
    getByAuctionHouse: async (auctionHouseId) => {
      const users = await prisma.user.findMany({
        where: { auctionHouseId }
      });
      return users.map(mapUser);
    },
    create: async (user) => {
      const created = await prisma.user.create({
        data: user
      });
      return mapUser(created);
    },
    update: async (id, updates) => {
      const updated = await prisma.user.update({
        where: { id },
        data: updates
      });
      return mapUser(updated);
    }
  }
};
