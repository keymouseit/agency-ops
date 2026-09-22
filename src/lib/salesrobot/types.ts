export type SalesRobotEventType =
  | 'prospect_added'
  | 'connection_request_sent'
  | 'connection_accepted'
  | 'message_sent'
  | 'reply_received'
  | 'unknown'

export interface SalesRobotApiCampaign {
  uuid?: string
  name?: string
  campaignStatus?: string
  source?: string
  isArchived?: boolean
  totalProspectCount?: number
  prospectsAdded?: number
  connectionRequestSentCount?: number
  connectionRequestAcceptedCount?: number
  repliedCount?: number
  firstEmailSentCount?: number
  followUpSentCount?: number
  inMailMessageCount?: number
  voiceMessageSentCount?: number
  videoMessageSentCount?: number
  viewedCount?: number
  groupMessageSentCount?: number
  eventMessageSentCount?: number
  startedTime?: string
  createdAt?: string
}

export interface SalesRobotApiAccount {
  uuid?: string
  linkedinAccountUuid?: string
  name?: string
  nameOnLinkedinAccount?: string
  fullName?: string
  email?: string
  emailId?: string
  linkedinEmail?: string
  healthStatus?: string
  licenceStatus?: string
  subscription?: string
  paymentStatus?: string
}

export interface SalesRobotApiProspectStep {
  stepNumber?: number
  stepType?: string
  messageSent?: string
  sentAt?: string
  status?: string
  connectedAt?: string | null
  repliedAt?: string | null
}

export interface SalesRobotApiProspect {
  prospectUuid?: string
  uuid?: string
  id?: number | string
  fullName?: string
  profileUrl?: string
  firstName?: string
  lastName?: string
  companyName?: string
  jobTitle?: string
  campaignUUID?: string
  campaignUuid?: string
  linkedinAccountUuid?: string
  isConnected?: boolean | null
  isReplied?: boolean | null
  isEmailReplied?: boolean | null
  lastActivity?: string | null
  firstReplyAt?: string | null
  connectionRequestSentAt?: string | null
  connectionAcceptedAt?: string | null
  lastExecutionTime?: string | null
  createdTime?: string
  currentExecutionStep?: number
  messageThreadId?: string | null
  isUnread?: boolean | null
  stepExportData?: SalesRobotApiProspectStep[] | null
}

export interface SalesRobotSyncedMessage {
  messageId?: string
  messageText?: string
  sentTime?: string
  messageSentByMe?: boolean
}

export interface SalesRobotSyncedConversation {
  linkedinAccountUuid?: string
  campaignName?: string
  campaignUuid?: string
  nameOfPerson?: string
  isUnread?: boolean
  prospectData?: SalesRobotApiProspect | null
  threadedMessages?: {
    messages?: SalesRobotSyncedMessage[]
  } | null
}

export interface SalesRobotDailyActivity {
  date?: string
  campaignDTOList?: SalesRobotApiCampaign[]
}

export interface NormalizedWebhookEvent {
  externalEventId?: string
  eventType: SalesRobotEventType
  salesrobotCampaignId?: string
  campaignName?: string
  linkedinAccountId?: string
  prospectId?: string
  prospectLinkedinUrl?: string
  occurredAt: Date
  raw: Record<string, unknown>
}

export interface MetricTotals {
  prospectsAdded: number
  connectionRequestsSent: number
  connectionsAccepted: number
  messagesSent: number
  repliesReceived: number
}

export interface MetricRates {
  acceptanceRate: number
  replyRate: number
}
