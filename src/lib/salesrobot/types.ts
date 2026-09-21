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

export interface SalesRobotApiProspect {
  prospectUuid?: string
  uuid?: string
  id?: number | string
  profileUrl?: string
  firstName?: string
  lastName?: string
  companyName?: string
  jobTitle?: string
  campaignUUID?: string
  campaignUuid?: string
  linkedinAccountUuid?: string
  isConnected?: boolean
  isReplied?: boolean
  createdTime?: string
  currentExecutionStep?: number
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
