import { z } from "zod"
 
export const signInSchema = z.object({
  email: z.string({ required_error: "Email is required" })
    .min(1, "Email is required")
    .email("Invalid email"),
  password: z.string({ required_error: "Password is required" })
    .min(1, "Password is required")
    .min(8, "Password must be more than 8 characters")
    .max(32, "Password must be less than 32 characters"),
})

export const auctionHouseSignupSchema = z.object({
  name: z.string({ required_error: "Auction house name is required" })
    .min(1, "Auction house name is required")
    .min(3, "Name must be at least 3 characters")
    .max(100, "Name must be less than 100 characters"),
  slug: z.string({ required_error: "Slug is required" })
    .min(1, "Slug is required")
    .min(3, "Slug must be at least 3 characters")
    .max(50, "Slug must be less than 50 characters")
    .regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"),
  description: z.string().optional().nullable(),
  domain: z.string()
    .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i, "Invalid domain format")
    .or(z.string().length(0))
    .optional()
    .nullable(),
  logoUrl: z.string().url("Invalid logo URL").or(z.string().length(0)).optional().nullable(),
  // User creation fields (required if not logged in)
  userEmail: z.string().email("Invalid email address").optional(),
  userName: z.string().min(1, "Name is required").optional(),
  userFirstName: z.string().optional(),
  userLastName: z.string().optional(),
  userPassword: z.string().min(8, "Password must be at least 8 characters").optional(),
})

// Bid increment structure
const bidIncrementSchema = z.object({
  from: z.number().min(0),
  increment: z.number().min(0),
})

// Payment method structure
const paymentMethodSchema = z.object({
  method: z.string(),
  percentage: z.number().min(0).max(100),
  vat: z.boolean().default(false),
})

// Auction house settings schema
export const auctionHouseSettingsSchema = z.object({
  // Basic Information
  mainLanguage: z.string().optional().nullable(),
  nameInEnglish: z.string().optional().nullable(),
  addressInEnglish: z.string().optional().nullable(),
  disclaimerInEnglish: z.string().optional().nullable(),
  
  // Contact Information
  email: z.string().email("Invalid email address").optional().nullable(),
  phone: z.string().optional().nullable(),
  phoneForWhatsapp: z.string().optional().nullable(),
  
  // Localization
  secondLanguage: z.string().optional().nullable(),
  defaultCurrency: z.string().optional().nullable(),
  secondCurrency: z.string().optional().nullable(),
  
  // Pricing
  defaultItemStartPrice: z.coerce.number().min(0).optional().nullable(),
  buyersPremium: z.coerce.number().min(0).max(100).optional().nullable(),
  addVat: z.boolean().default(false),
  
  // Email Notifications
  emailOnAbsenteeBid: z.boolean().default(false),
  emailOnAbsenteeBidCancel: z.boolean().default(false),
  emailToNotifyBidsUpdate: z.string().email("Invalid email address").optional().nullable(),
  
  // Bidding Rules
  russianUsersRequireApproval: z.boolean().default(false),
  automaticAuctionInitialTimerSeconds: z.coerce.number().int().min(1).optional().nullable(),
  automaticAuctionTimerResetSeconds: z.coerce.number().int().min(1).optional().nullable(),
  
  // Payment Methods
  paymentMethods: z.array(paymentMethodSchema).optional().default([]),
  addPaymentButtonToInvoices: z.boolean().default(false),
  
  // Legal Documents
  termsOfSaleInEnglish: z.string().optional().nullable(),
  privacyPolicyInEnglish: z.string().optional().nullable(),
  disclaimerForSellersInEnglish: z.string().optional().nullable(),
  
  // Bid Increments
  bidIncrements: z.array(bidIncrementSchema).optional().default([]),
  
  // Email Templates
  emailSignatureInEnglish: z.string().optional().nullable(),
  
  // Category Meta Fields Configuration
  categoryMetaFields: z.record(z.array(z.object({
    key: z.string(),
    label: z.string(),
    type: z.enum(['text', 'number', 'date', 'boolean', 'select']),
    required: z.boolean().default(false),
    options: z.array(z.string()).optional(), // For select type
    placeholder: z.string().optional(),
    helpText: z.string().optional()
  }))).optional().default({}),
  photoIdRequestEmailTemplateInEnglish: z.string().optional().nullable(),
  bidLimitEmailTemplateInEnglish: z.string().optional().nullable(),
  
  // Invoice Settings
  additionalTextForInvoicesInEnglish: z.string().optional().nullable(),
  additionalTextForConsignorStatementsInEnglish: z.string().optional().nullable(),
  taxNumber: z.string().optional().nullable(),
  invoiceProvider: z.string().optional().nullable(),
  
  // AI Settings
  aiPrompt: z.string().optional().nullable(), // Base prompt for AI services (tone, style, context about auction house)
})

// Auction settings schema (nested within each auction)
export const auctionSettingsSchema = z.object({
  // Default Auction Settings
  defaultAuctionDurationDays: z.coerce.number().min(1).optional().nullable(),
  defaultPreviewPeriodDays: z.coerce.number().min(0).optional().nullable(),
  autoStartAuctions: z.boolean().default(false),
  autoCloseAuctions: z.boolean().default(false),
  staggeredLotClosing: z.boolean().default(false),
  lotClosingIntervalSeconds: z.coerce.number().min(0).optional().nullable(),
  requireRegistrationToBid: z.boolean().default(false),
  allowAbsenteeBids: z.boolean().default(true),
  extendBiddingOnLastMinuteBid: z.boolean().default(false),
  biddingExtensionSeconds: z.coerce.number().min(0).optional().nullable(),
  minimumBidIncrement: z.coerce.number().min(0).optional().nullable(),
  allowProxyBidding: z.boolean().default(true),
  maxProxyBidAmount: z.coerce.number().min(0).optional().nullable(),
  defaultAuctionStatus: z.enum(['UPCOMING', 'LIVE', 'ENDED', 'CANCELLED']).optional().nullable(),
  
  // Catalog Settings
  displayStartPriceInCatalog: z.boolean().default(true),
  enableAbsenteeBids: z.boolean().default(true),
  buyersPremium: z.coerce.number().min(0).max(100).optional().nullable(),
  daysToAllowPostAuctionSale: z.coerce.number().min(0).optional().nullable(),
  
  // Live Auction Settings
  baseLiveAuctionStartPriceOnAbsenteeBids: z.boolean().default(false),
  autoAdvanceNextLot: z.boolean().default(false),
  // Runtime: current lot on the auctioneer block (not edited in settings UI)
  onBlockLotId: z.string().optional().nullable(),
  buyerPaysShipping: z.boolean().default(true),
  liveVideoUrl: z.string().url('Invalid live video URL').or(z.literal('')).optional().nullable(),
  liveVideoTitle: z.string().max(120).optional().nullable(),
  liveAudioUrl: z.string().url('Invalid live audio URL').or(z.literal('')).optional().nullable(),
  liveAudioTitle: z.string().max(120).optional().nullable(),
  
  // Automatic Auction Settings
  automaticAuctionInitialTimerSeconds: z.coerce.number().int().min(1).optional().nullable(),
  automaticAuctionTimerResetSeconds: z.coerce.number().int().min(1).optional().nullable(),
  
  // Currency
  currency: z.string().optional().nullable(),
  
  // Gallery Template Settings
  galleryTemplate: z.enum(['card-grid', 'image-slider', 'overlay-text', 'minimal-grid', 'masonry', 'carousel-hover']).optional().default('card-grid'),
  galleryTemplateSettings: z.object({
    // Card Grid settings
    cardGridColumns: z.coerce.number().min(1).max(5).optional().default(3),
    cardGridShowDescription: z.boolean().optional().default(true),
    cardGridShowStartingBid: z.boolean().optional().default(true),
    
    // Image Slider settings
    sliderAutoPlay: z.boolean().optional().default(false),
    sliderAutoPlayInterval: z.coerce.number().min(1000).optional().default(3000),
    sliderShowDots: z.boolean().optional().default(true),
    sliderShowArrows: z.boolean().optional().default(true),
    
    // Overlay Text settings
    overlayTextPosition: z.enum(['top', 'center', 'bottom']).optional().default('bottom'),
    overlayTextOpacity: z.coerce.number().min(0).max(1).optional().default(0.8),
    overlayButtonStyle: z.enum(['white', 'colored', 'outline']).optional().default('white'),
    
    // Minimal Grid settings
    minimalGridColumns: z.coerce.number().min(2).max(6).optional().default(5),
    minimalGridShowDescription: z.boolean().optional().default(false),
    
    // Masonry settings
    masonryColumns: z.coerce.number().min(2).max(5).optional().default(4),
    masonryVaryHeights: z.boolean().optional().default(true),
  }).optional().default({}),
  
  // AI Settings
  aiPrompt: z.string().optional().nullable(), // Additional prompt for this specific auction (tone, style, context)
})

const nullableUrl = z.string().url("Invalid image URL").or(z.literal("")).nullable().optional()
const auctionStatusApiSchema = z.preprocess(
  value => typeof value === "string" ? value.toUpperCase() : value,
  z.enum(["UPCOMING", "LIVE", "ENDED", "CANCELLED"])
)
const auctionTypeApiSchema = z.preprocess(
  value => typeof value === "string" ? value.toUpperCase() : value,
  z.enum(["PUBLIC", "PRIVATE"])
)

const auctionFieldsSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().nullable().optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  status: auctionStatusApiSchema.default("UPCOMING"),
  type: auctionTypeApiSchema.default("PRIVATE"),
  imageUrl: nullableUrl,
  settings: z.union([z.string(), z.record(z.unknown())]).nullable().optional(),
  auctionHouseId: z.string().min(1, "Auction house ID is required"),
  sellerId: z.string().min(1, "Seller ID is required"),
  auctioneerId: z.string().nullable().optional(),
  auctioneerStartedAt: z.coerce.date().nullable().optional(),
  seriesId: z.string().nullable().optional(),
  seriesOccurrenceAt: z.coerce.date().nullable().optional(),
  platformPolicyId: z.string().nullable().optional(),
  policyVersionSnapshot: z.coerce.number().int().nullable().optional(),
  buyerTermsSnapshot: z.string().nullable().optional(),
  sellerTermsSnapshot: z.string().nullable().optional(),
  buyerPremiumRateSnapshot: z.coerce.number().nonnegative().nullable().optional(),
  sellerCommissionRateSnapshot: z.coerce.number().nonnegative().nullable().optional(),
  rateConfigSnapshot: z.unknown().nullable().optional(),
  privateHouseNameSnapshot: z.string().nullable().optional(),
  privateHouseBuyerTermsSnapshot: z.string().nullable().optional(),
  privateHouseSellerTermsSnapshot: z.string().nullable().optional(),
  privateHouseBuyerPremiumRateSnapshot: z.coerce.number().nonnegative().nullable().optional(),
  privateHouseSellerCommissionRateSnapshot: z.coerce.number().nonnegative().nullable().optional(),
  privateHouseRateConfigSnapshot: z.unknown().nullable().optional(),
})

export const auctionCreateSchema = auctionFieldsSchema.refine(({ startDate, endDate }) => endDate > startDate, {
  message: "End date must be after start date",
  path: ["endDate"],
})

export const auctionUpdateSchema = auctionFieldsSchema.partial().refine(
  ({ startDate, endDate }) => !startDate || !endDate || endDate > startDate,
  {
    message: "End date must be after start date",
    path: ["endDate"],
  }
)

export const auctionRegistrationSchema = z.object({
  acceptedTerms: z.boolean().optional(),
  termsAccepted: z.boolean().optional(),
  policyAccepted: z.boolean().optional(),
}).passthrough()
