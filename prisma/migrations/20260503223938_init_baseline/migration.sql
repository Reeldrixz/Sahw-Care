-- CreateEnum
CREATE TYPE "FulfillmentStatus" AS ENUM ('PENDING', 'VERIFIED', 'DISPUTED', 'AUTO_CONFIRMED');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('DONOR', 'RECIPIENT', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'PENDING', 'FLAGGED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ItemStatus" AS ENUM ('PENDING', 'ACTIVE', 'FULFILLED', 'REMOVED', 'FROZEN', 'RESERVED');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'FULFILLED', 'ACCEPTED', 'DECLINED', 'CHAT_OPENED', 'PICKUP_AGREED', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "RegisterItemStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'FULFILLED', 'DELIVERED', 'CANCELLED', 'PENDING_APPROVAL');

-- CreateEnum
CREATE TYPE "RegisterAddressMode" AS ENUM ('ASK_PER_SHIPMENT', 'SAVED_PER_REGISTER');

-- CreateEnum
CREATE TYPE "RegisterStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'CLOSED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "ItemAssignmentStatus" AS ENUM ('RESERVED', 'PURCHASED', 'DELIVERED');

-- CreateEnum
CREATE TYPE "OtpType" AS ENUM ('PHONE', 'EMAIL');

-- CreateEnum
CREATE TYPE "DocStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PostCategory" AS ENUM ('TIP', 'STORY', 'GRATITUDE', 'QUESTION', 'SMALL_WIN', 'SUPPORT');

-- CreateEnum
CREATE TYPE "ReactionType" AS ENUM ('HEART', 'HUG', 'CLAP');

-- CreateEnum
CREATE TYPE "FlagStatus" AS ENUM ('PENDING', 'APPROVED', 'REMOVED');

-- CreateEnum
CREATE TYPE "CircleAccessType" AS ENUM ('FULL', 'READ_COMMENT');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "NotifType" AS ENUM ('NEW_POST', 'REPLY', 'THREAD_REPLY', 'RBW_RESTRICTION', 'REPORT_CONFIRMED', 'FULFILLMENT_PENDING', 'FULFILLMENT_CONFIRMED', 'FULFILLMENT_REMINDER', 'BUNDLE_ALLOCATION_CONFIRM', 'ITEM_FULLY_FUNDED', 'ITEM_PURCHASED', 'ITEM_DISPATCHED', 'ITEM_DELIVERED', 'REQUEST_ACCEPTED', 'REQUEST_DECLINED', 'REQUEST_RECEIVED', 'ITEM_RESERVED', 'ITEM_FULFILLED', 'DELIVERY_CONFIRMED', 'FULFILLMENT_DISPUTED', 'BUNDLE_UPDATE', 'BUNDLE_GOAL_MET', 'BUNDLE_DELIVERED', 'ADMIN_MESSAGE', 'MODERATION_ACTION', 'VERIFICATION_APPROVED', 'VERIFICATION_REJECTED', 'MANUAL_VERIFIED', 'CIRCLE_REPLY', 'CIRCLE_THREAD_REPLY', 'CIRCLE_NEW_POST', 'CIRCLE_MILESTONE', 'TRUST_MILESTONE', 'TRUST_WARNING', 'DONOR_LEVEL_UP', 'REQUEST_LOCK_CLEARED', 'COORDINATION_ACCEPTED', 'COORDINATION_TIME_PROPOSED', 'COORDINATION_SCHEDULED', 'COORDINATION_CANCELLED', 'COORDINATION_DELIVERED', 'REGISTER_ITEM_APPROVED', 'REGISTER_ITEM_REJECTED');

-- CreateEnum
CREATE TYPE "BundleInstanceStatus" AS ENUM ('AVAILABLE', 'REQUESTED', 'APPROVED', 'ORDERED', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'REJECTED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "AbuseEventType" AS ENUM ('SIGNUP', 'VERIFICATION_SUBMITTED', 'VERIFICATION_APPROVED', 'VERIFICATION_REJECTED', 'INTRO_POST_CREATED', 'CIRCLE_POST_CREATED', 'COMMENT_CREATED', 'DISCOVER_REQUEST_CREATED', 'URGENT_OVERRIDE_USED', 'REGISTER_CREATED', 'REPORT_SUBMITTED', 'TRUST_SCORE_CHANGED', 'BUNDLE_REQUESTED', 'BUNDLE_APPROVED', 'BUNDLE_REJECTED', 'FULFILLMENT_MARKED', 'FULFILLMENT_DISPUTED');

-- CreateEnum
CREATE TYPE "AbuseFlagType" AS ENUM ('TOO_MANY_REQUESTS_SHORT_WINDOW', 'NEW_ACCOUNT_REQUESTING_TOO_FAST', 'REPEATED_URGENT_OVERRIDE', 'HIGH_REQUEST_LOW_ENGAGEMENT', 'SUSPICIOUS_REPORT_VOLUME', 'REPEATED_DEVICE_OR_SESSION', 'TRUST_SCORE_RECOVERY_SPAM', 'REPEATED_BUNDLE_ATTEMPTS', 'HIGH_UNVERIFIED_FULFILLMENTS', 'DUPLICATE_LISTING', 'OFF_PLATFORM_CONTACT');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "AbuseFlagStatus" AS ENUM ('OPEN', 'REVIEWED', 'CLOSED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "CoordinationStatus" AS ENUM ('PENDING', 'LOCATION_CONFIRMED', 'TIME_PROPOSED', 'SCHEDULED', 'DONOR_READY', 'DELIVERED', 'CONFIRMED', 'CANCELLED', 'REPORTED');

-- CreateEnum
CREATE TYPE "CoordMessageType" AS ENUM ('IM_HERE', 'RUNNING_LATE', 'ON_MY_WAY', 'CANT_MAKE_IT', 'PICKUP_COMPLETE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "CoordReportReason" AS ENUM ('INAPPROPRIATE_MESSAGES', 'REQUESTING_PERSONAL_INFO', 'PRESSURE_OR_HARASSMENT', 'OFF_PLATFORM_CONTACT_ATTEMPT', 'SUSPICIOUS_BEHAVIOUR', 'OTHER');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED');

-- CreateEnum
CREATE TYPE "AllocationStatus" AS ENUM ('QUEUED', 'APPROVED', 'DISPATCHED', 'DELIVERED', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "FundingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "QueueStatus" AS ENUM ('QUEUED', 'PURCHASED', 'DISPATCHED', 'DELIVERED');

-- CreateEnum
CREATE TYPE "ItemFundingStatus" AS ENUM ('UNFUNDED', 'PARTIAL', 'FULLY_FUNDED', 'IN_FULFILLMENT', 'FULFILLED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'DONOR',
    "avatar" TEXT,
    "location" TEXT,
    "preferredCity" TEXT,
    "preferredRadius" INTEGER DEFAULT 10,
    "locationSetByGPS" BOOLEAN NOT NULL DEFAULT false,
    "isPremium" BOOLEAN NOT NULL DEFAULT false,
    "trustRating" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "trustScore" INTEGER NOT NULL DEFAULT 0,
    "verificationLevel" INTEGER NOT NULL DEFAULT 0,
    "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "urgentOverridesUsed" INTEGER NOT NULL DEFAULT 0,
    "urgentOverridesResetAt" TIMESTAMP(3),
    "docStatus" "DocStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "documentUrl" TEXT,
    "documentType" TEXT,
    "documentNote" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
    "journeyType" TEXT,
    "gender" TEXT NOT NULL DEFAULT 'unspecified',
    "dueDate" TIMESTAMP(3),
    "babyBirthDate" TIMESTAMP(3),
    "currentStage" TEXT,
    "countryCode" TEXT,
    "countryFlag" TEXT,
    "subTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "currentCircleId" TEXT,
    "graduatedCircleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastStageCheck" TIMESTAMP(3),
    "circleIdentitySet" BOOLEAN NOT NULL DEFAULT false,
    "circleContext" TEXT,
    "circleDisplayName" TEXT,
    "circleIdentityUpdatedAt" TIMESTAMP(3),
    "circleIdentitySkippedAt" TIMESTAMP(3),
    "lastBundleCompletedAt" TIMESTAMP(3),
    "activeBundleId" TEXT,
    "trustFrozen" BOOLEAN NOT NULL DEFAULT false,
    "trustFrozenUntil" TIMESTAMP(3),
    "impactScore" INTEGER NOT NULL DEFAULT 0,
    "donorLevel" TEXT NOT NULL DEFAULT 'NEW_DONOR',
    "bundleRestrictedUntil" TIMESTAMP(3),
    "dailyPointsEarned" INTEGER NOT NULL DEFAULT 0,
    "dailyPointsDate" TIMESTAMP(3),
    "graceRequestsUsed" INTEGER NOT NULL DEFAULT 0,
    "activeRequestLockedUntil" TIMESTAMP(3),
    "requestCountSinceReset" INTEGER NOT NULL DEFAULT 0,
    "streakCurrentDays" INTEGER NOT NULL DEFAULT 0,
    "streakLastActiveDate" TIMESTAMP(3),
    "streakWeeksCompleted" INTEGER NOT NULL DEFAULT 0,
    "hasPostedIntro" BOOLEAN NOT NULL DEFAULT false,
    "totalFundedCents" INTEGER NOT NULL DEFAULT 0,
    "fundingCount" INTEGER NOT NULL DEFAULT 0,
    "notifyNewPosts" BOOLEAN NOT NULL DEFAULT false,
    "notifyReplies" BOOLEAN NOT NULL DEFAULT true,
    "notifyThreadReplies" BOOLEAN NOT NULL DEFAULT true,
    "notifyBundleUpdates" BOOLEAN NOT NULL DEFAULT true,
    "notifyVerification" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "quantity" TEXT NOT NULL,
    "quantityNum" INTEGER NOT NULL DEFAULT 1,
    "location" TEXT NOT NULL,
    "description" TEXT,
    "images" TEXT[],
    "urgent" BOOLEAN NOT NULL DEFAULT false,
    "status" "ItemStatus" NOT NULL DEFAULT 'PENDING',
    "adminBlurred" BOOLEAN NOT NULL DEFAULT false,
    "frozenAt" TIMESTAMP(3),
    "frozenReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "donorId" TEXT NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Favourite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favourite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "pickupRating" DOUBLE PRECISION NOT NULL,
    "qualityRating" DOUBLE PRECISION NOT NULL,
    "quantityRating" DOUBLE PRECISION NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewerId" TEXT NOT NULL,
    "donorId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Request" (
    "id" TEXT NOT NULL,
    "note" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reasonForRequest" TEXT,
    "whoIsItFor" TEXT,
    "pickupPreference" TEXT,
    "pickupMode" TEXT DEFAULT 'PICKUP',
    "pickupCategoryId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "itemId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "requestNote" TEXT,
    "pickupLocationId" TEXT,

    CONSTRAINT "Request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestFulfillment" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "status" "FulfillmentStatus" NOT NULL DEFAULT 'PENDING',
    "donorNote" TEXT,
    "donorPhotoUrl" TEXT,
    "markedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recipientResponse" TEXT,
    "respondedAt" TIMESTAMP(3),
    "reminderSentAt" TIMESTAMP(3),
    "autoConfirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequestFulfillment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestId" TEXT NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationParticipant" (
    "userId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,

    CONSTRAINT "ConversationParticipant_pkey" PRIMARY KEY ("userId","conversationId")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "senderId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PickupCoordination" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "locationId" TEXT,
    "proposedTime" TIMESTAMP(3),
    "proposedBy" TEXT,
    "confirmedTime" TIMESTAMP(3),
    "status" "CoordinationStatus" NOT NULL DEFAULT 'PENDING',
    "cancelledById" TEXT,
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PickupCoordination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicPickupLocation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "address" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicPickupLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoordinationMessage" (
    "id" TEXT NOT NULL,
    "coordinationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "messageType" "CoordMessageType" NOT NULL,
    "content" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoordinationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoordinationReport" (
    "id" TEXT NOT NULL,
    "coordinationId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reason" "CoordReportReason" NOT NULL,
    "notes" TEXT,
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoordinationReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reporterId" TEXT NOT NULL,
    "itemId" TEXT,
    "targetUserId" TEXT,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Register" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "addressMode" "RegisterAddressMode" NOT NULL DEFAULT 'ASK_PER_SHIPMENT',
    "status" "RegisterStatus" NOT NULL DEFAULT 'DRAFT',
    "completedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "creatorId" TEXT NOT NULL,

    CONSTRAINT "Register_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegisterItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Other',
    "quantity" TEXT NOT NULL DEFAULT '1',
    "note" TEXT,
    "storeLinks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "RegisterItemStatus" NOT NULL DEFAULT 'AVAILABLE',
    "catalogItemId" TEXT,
    "standardPriceCents" INTEGER NOT NULL DEFAULT 0,
    "totalFundedCents" INTEGER NOT NULL DEFAULT 0,
    "fundingStatus" "ItemFundingStatus" NOT NULL DEFAULT 'UNFUNDED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "registerId" TEXT NOT NULL,

    CONSTRAINT "RegisterItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemAssignment" (
    "id" TEXT NOT NULL,
    "status" "ItemAssignmentStatus" NOT NULL DEFAULT 'RESERVED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "itemId" TEXT NOT NULL,
    "donorId" TEXT NOT NULL,

    CONSTRAINT "ItemAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegisterMessage" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "senderId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,

    CONSTRAINT "RegisterMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpVerification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "OtpType" NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoryCooldown" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "lastFulfilledAt" TIMESTAMP(3) NOT NULL,
    "nextEligibleAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoryCooldown_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FulfillmentLog" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "donorConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "momConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "mismatch" BOOLEAN NOT NULL DEFAULT false,
    "donorConfirmedAt" TIMESTAMP(3),
    "momConfirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FulfillmentLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UrgentOverride" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "approved" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UrgentOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Circle" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT,
    "country" TEXT,
    "stageKey" TEXT,
    "groupLetter" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Circle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CircleChannel" (
    "id" TEXT NOT NULL,
    "circleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CircleChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CircleMember" (
    "userId" TEXT NOT NULL,
    "circleId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isLeader" BOOLEAN NOT NULL DEFAULT false,
    "lastViewedAt" TIMESTAMP(3),
    "accessType" "CircleAccessType" NOT NULL DEFAULT 'FULL',
    "isGraduated" BOOLEAN NOT NULL DEFAULT false,
    "hasSeenWelcome" BOOLEAN NOT NULL DEFAULT false,
    "hasSeenModerationBanner" BOOLEAN NOT NULL DEFAULT false,
    "hasSeenStageTransition" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CircleMember_pkey" PRIMARY KEY ("userId","circleId")
);

-- CreateTable
CREATE TABLE "CirclePost" (
    "id" TEXT NOT NULL,
    "circleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" "PostCategory" NOT NULL,
    "photoUrl" TEXT,
    "channelId" TEXT,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "isIntroPost" BOOLEAN NOT NULL DEFAULT false,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CirclePost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostReaction" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ReactionType" NOT NULL,

    CONSTRAINT "PostReaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostComment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "identityLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostReport" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "reportedBy" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlaggedPost" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "FlagStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FlaggedPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sponsorName" TEXT NOT NULL,
    "sponsorLogo" TEXT,
    "totalBudget" DOUBLE PRECISION NOT NULL,
    "costPerBundle" DOUBLE PRECISION NOT NULL,
    "totalBundles" INTEGER NOT NULL,
    "bundlesRemaining" INTEGER NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "targetStage" TEXT,
    "targetRegion" TEXT,
    "templateId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BundleTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "estimatedCost" DOUBLE PRECISION NOT NULL,
    "items" JSONB NOT NULL,
    "targetStage" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BundleTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BundleInstance" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "status" "BundleInstanceStatus" NOT NULL DEFAULT 'REQUESTED',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "orderedAt" TIMESTAMP(3),
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "trackingNumber" TEXT,
    "orderReference" TEXT,
    "deliveryAddress" JSONB NOT NULL,
    "adminNotes" TEXT,

    CONSTRAINT "BundleInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotifType" NOT NULL,
    "title" TEXT,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "actionLabel" TEXT,
    "metadata" JSONB,
    "readAt" TIMESTAMP(3),
    "circleId" TEXT,
    "postId" TEXT,
    "triggeredByUserId" TEXT,
    "link" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "pointsDelta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "referenceId" TEXT,
    "referenceType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrustEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustScoreLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "pointsDelta" INTEGER NOT NULL,
    "newScore" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrustScoreLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImpactScoreLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "pointsDelta" INTEGER NOT NULL,
    "newScore" INTEGER NOT NULL,
    "referenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImpactScoreLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostLike" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbuseEventLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventType" "AbuseEventType" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trustScore" INTEGER NOT NULL,
    "metadata" JSONB NOT NULL,
    "ipAddress" TEXT,
    "deviceId" TEXT,
    "sessionId" TEXT,

    CONSTRAINT "AbuseEventLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbuseFlag" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "flagType" "AbuseFlagType" NOT NULL,
    "severity" "Severity" NOT NULL,
    "status" "AbuseFlagStatus" NOT NULL DEFAULT 'OPEN',
    "evidence" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "notes" TEXT,

    CONSTRAINT "AbuseFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustScoreHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "oldScore" INTEGER NOT NULL,
    "newScore" INTEGER NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrustScoreHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyAbuseSummary" (
    "id" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "weekEnd" TIMESTAMP(3) NOT NULL,
    "totalFlags" INTEGER NOT NULL,
    "highSeverityFlags" INTEGER NOT NULL,
    "topFlagTypes" JSONB NOT NULL,
    "usersDroppedBelow60" INTEGER NOT NULL,
    "rapidTrustFarmers" INTEGER NOT NULL,
    "topRequestedCategories" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyAbuseSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyBundleGoal" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "targetBundles" INTEGER NOT NULL,
    "costPerBundle" INTEGER NOT NULL,
    "deliveredBundles" INTEGER NOT NULL DEFAULT 0,
    "bundlesFundedToday" INTEGER NOT NULL DEFAULT 0,
    "status" "GoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonthlyBundleGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BundleContribution" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "donorId" TEXT NOT NULL,
    "bundleCount" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "paymentRef" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'CONFIRMED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BundleContribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BundleAllocation" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "bundleType" TEXT NOT NULL,
    "status" "AllocationStatus" NOT NULL DEFAULT 'QUEUED',
    "allocatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dispatchedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "deliveryAddress" TEXT,
    "notes" TEXT,

    CONSTRAINT "BundleAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemCatalog" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "standardPriceCents" INTEGER NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "preferredVendor" TEXT,
    "preferredVendorUrl" TEXT,
    "substituteNote" TEXT,
    "ageStage" TEXT,
    "requiresSize" BOOLEAN NOT NULL DEFAULT false,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegisterItemFunding" (
    "id" TEXT NOT NULL,
    "registerItemId" TEXT NOT NULL,
    "donorId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" "FundingStatus" NOT NULL DEFAULT 'CONFIRMED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegisterItemFunding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FulfillmentQueue" (
    "id" TEXT NOT NULL,
    "registerItemId" TEXT NOT NULL,
    "totalFundedCents" INTEGER NOT NULL,
    "status" "QueueStatus" NOT NULL DEFAULT 'QUEUED',
    "purchasedFrom" TEXT,
    "actualCostCents" INTEGER,
    "trackingRef" TEXT,
    "notes" TEXT,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "purchasedAt" TIMESTAMP(3),
    "dispatchedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),

    CONSTRAINT "FulfillmentQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegisterAddress" (
    "id" TEXT NOT NULL,
    "registerId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "streetAddress" TEXT NOT NULL,
    "unit" TEXT,
    "city" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'Canada',
    "phone" TEXT NOT NULL,
    "redactedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegisterAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentAddress" (
    "id" TEXT NOT NULL,
    "registerItemId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "streetAddress" TEXT NOT NULL,
    "unit" TEXT,
    "city" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'Canada',
    "phone" TEXT NOT NULL,
    "redactedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShipmentAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AddressAuditSnapshot" (
    "id" TEXT NOT NULL,
    "registerId" TEXT,
    "registerItemId" TEXT,
    "city" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "postalCodeFirst3" TEXT NOT NULL,
    "addressHash" TEXT NOT NULL,
    "redactedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AddressAuditSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Favourite_userId_itemId_key" ON "Favourite"("userId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_requestId_key" ON "Review"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "RequestFulfillment_requestId_key" ON "RequestFulfillment"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_requestId_key" ON "Conversation"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "PickupCoordination_requestId_key" ON "PickupCoordination"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemAssignment_itemId_key" ON "ItemAssignment"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryCooldown_userId_category_key" ON "CategoryCooldown"("userId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "FulfillmentLog_assignmentId_key" ON "FulfillmentLog"("assignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Circle_country_key" ON "Circle"("country");

-- CreateIndex
CREATE UNIQUE INDEX "Circle_stageKey_key" ON "Circle"("stageKey");

-- CreateIndex
CREATE UNIQUE INDEX "PostReaction_postId_userId_key" ON "PostReaction"("postId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "PostReport_postId_reportedBy_key" ON "PostReport"("postId", "reportedBy");

-- CreateIndex
CREATE UNIQUE INDEX "FlaggedPost_postId_key" ON "FlaggedPost"("postId");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PostLike_postId_userId_key" ON "PostLike"("postId", "userId");

-- CreateIndex
CREATE INDEX "AbuseEventLog_userId_idx" ON "AbuseEventLog"("userId");

-- CreateIndex
CREATE INDEX "AbuseEventLog_eventType_idx" ON "AbuseEventLog"("eventType");

-- CreateIndex
CREATE INDEX "AbuseEventLog_timestamp_idx" ON "AbuseEventLog"("timestamp");

-- CreateIndex
CREATE INDEX "AbuseFlag_userId_idx" ON "AbuseFlag"("userId");

-- CreateIndex
CREATE INDEX "AbuseFlag_status_idx" ON "AbuseFlag"("status");

-- CreateIndex
CREATE INDEX "AbuseFlag_severity_idx" ON "AbuseFlag"("severity");

-- CreateIndex
CREATE INDEX "AbuseFlag_createdAt_idx" ON "AbuseFlag"("createdAt");

-- CreateIndex
CREATE INDEX "TrustScoreHistory_userId_idx" ON "TrustScoreHistory"("userId");

-- CreateIndex
CREATE INDEX "TrustScoreHistory_createdAt_idx" ON "TrustScoreHistory"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ItemCatalog_sku_key" ON "ItemCatalog"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "FulfillmentQueue_registerItemId_key" ON "FulfillmentQueue"("registerItemId");

-- CreateIndex
CREATE UNIQUE INDEX "RegisterAddress_registerId_key" ON "RegisterAddress"("registerId");

-- CreateIndex
CREATE UNIQUE INDEX "ShipmentAddress_registerItemId_key" ON "ShipmentAddress"("registerItemId");

-- CreateIndex
CREATE INDEX "AddressAuditSnapshot_registerId_idx" ON "AddressAuditSnapshot"("registerId");

-- CreateIndex
CREATE INDEX "AddressAuditSnapshot_registerItemId_idx" ON "AddressAuditSnapshot"("registerItemId");

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favourite" ADD CONSTRAINT "Favourite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favourite" ADD CONSTRAINT "Favourite_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_pickupLocationId_fkey" FOREIGN KEY ("pickupLocationId") REFERENCES "PublicPickupLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestFulfillment" ADD CONSTRAINT "RequestFulfillment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupCoordination" ADD CONSTRAINT "PickupCoordination_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupCoordination" ADD CONSTRAINT "PickupCoordination_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "PublicPickupLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoordinationMessage" ADD CONSTRAINT "CoordinationMessage_coordinationId_fkey" FOREIGN KEY ("coordinationId") REFERENCES "PickupCoordination"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoordinationMessage" ADD CONSTRAINT "CoordinationMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoordinationReport" ADD CONSTRAINT "CoordinationReport_coordinationId_fkey" FOREIGN KEY ("coordinationId") REFERENCES "PickupCoordination"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoordinationReport" ADD CONSTRAINT "CoordinationReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Register" ADD CONSTRAINT "Register_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegisterItem" ADD CONSTRAINT "RegisterItem_registerId_fkey" FOREIGN KEY ("registerId") REFERENCES "Register"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegisterItem" ADD CONSTRAINT "RegisterItem_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "ItemCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemAssignment" ADD CONSTRAINT "ItemAssignment_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "RegisterItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemAssignment" ADD CONSTRAINT "ItemAssignment_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegisterMessage" ADD CONSTRAINT "RegisterMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegisterMessage" ADD CONSTRAINT "RegisterMessage_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "ItemAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtpVerification" ADD CONSTRAINT "OtpVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryCooldown" ADD CONSTRAINT "CategoryCooldown_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FulfillmentLog" ADD CONSTRAINT "FulfillmentLog_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "ItemAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UrgentOverride" ADD CONSTRAINT "UrgentOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceLog" ADD CONSTRAINT "DeviceLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CircleChannel" ADD CONSTRAINT "CircleChannel_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "Circle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CircleMember" ADD CONSTRAINT "CircleMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CircleMember" ADD CONSTRAINT "CircleMember_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "Circle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CirclePost" ADD CONSTRAINT "CirclePost_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "Circle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CirclePost" ADD CONSTRAINT "CirclePost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CirclePost" ADD CONSTRAINT "CirclePost_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "CircleChannel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostReaction" ADD CONSTRAINT "PostReaction_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CirclePost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostReaction" ADD CONSTRAINT "PostReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostComment" ADD CONSTRAINT "PostComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CirclePost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostComment" ADD CONSTRAINT "PostComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostReport" ADD CONSTRAINT "PostReport_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CirclePost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostReport" ADD CONSTRAINT "PostReport_reportedBy_fkey" FOREIGN KEY ("reportedBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlaggedPost" ADD CONSTRAINT "FlaggedPost_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CirclePost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "BundleTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleInstance" ADD CONSTRAINT "BundleInstance_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleInstance" ADD CONSTRAINT "BundleInstance_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "BundleTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleInstance" ADD CONSTRAINT "BundleInstance_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustEvent" ADD CONSTRAINT "TrustEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustScoreLog" ADD CONSTRAINT "TrustScoreLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImpactScoreLog" ADD CONSTRAINT "ImpactScoreLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostLike" ADD CONSTRAINT "PostLike_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CirclePost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostLike" ADD CONSTRAINT "PostLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbuseEventLog" ADD CONSTRAINT "AbuseEventLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbuseFlag" ADD CONSTRAINT "AbuseFlag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustScoreHistory" ADD CONSTRAINT "TrustScoreHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleContribution" ADD CONSTRAINT "BundleContribution_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "MonthlyBundleGoal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleContribution" ADD CONSTRAINT "BundleContribution_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleAllocation" ADD CONSTRAINT "BundleAllocation_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "MonthlyBundleGoal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleAllocation" ADD CONSTRAINT "BundleAllocation_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegisterItemFunding" ADD CONSTRAINT "RegisterItemFunding_registerItemId_fkey" FOREIGN KEY ("registerItemId") REFERENCES "RegisterItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegisterItemFunding" ADD CONSTRAINT "RegisterItemFunding_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FulfillmentQueue" ADD CONSTRAINT "FulfillmentQueue_registerItemId_fkey" FOREIGN KEY ("registerItemId") REFERENCES "RegisterItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegisterAddress" ADD CONSTRAINT "RegisterAddress_registerId_fkey" FOREIGN KEY ("registerId") REFERENCES "Register"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentAddress" ADD CONSTRAINT "ShipmentAddress_registerItemId_fkey" FOREIGN KEY ("registerItemId") REFERENCES "RegisterItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

