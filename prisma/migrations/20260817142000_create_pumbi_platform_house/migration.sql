-- Public platform auctions are owned by a stable Pumbi auction-house record.
INSERT INTO "auction_houses" (
    "id",
    "name",
    "slug",
    "description",
    "is_active",
    "legal_name",
    "onboarding_status",
    "onboarding_step",
    "onboarding_approved_at",
    "created_at",
    "updated_at"
)
VALUES (
    'pumbi',
    'Pumbi',
    'pumbi',
    'Pumbi platform-owned public auctions',
    true,
    'Pumbi',
    'APPROVED',
    1,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO UPDATE SET
    "name" = EXCLUDED."name",
    "slug" = EXCLUDED."slug",
    "description" = EXCLUDED."description",
    "is_active" = true,
    "legal_name" = EXCLUDED."legal_name",
    "onboarding_status" = 'APPROVED',
    "onboarding_approved_at" = COALESCE("auction_houses"."onboarding_approved_at", CURRENT_TIMESTAMP),
    "updated_at" = CURRENT_TIMESTAMP;
