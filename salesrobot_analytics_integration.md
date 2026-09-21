# SalesRobot Analytics Integration Specification

## Goal

Integrate SalesRobot campaign activity and analytics into our platform so that we can automatically track weekly campaign performance instead of manually entering numbers.

The dashboard should support metrics such as:

- Prospects/leads added
- Connection requests sent
- Connections accepted
- Messages sent
- Replies received
- Acceptance rate
- Reply rate
- Campaign-level performance
- LinkedIn account-level performance
- Weekly, monthly, and custom date-range reporting
- Historical trends

---

## Does SalesRobot support this?

Yes. SalesRobot publicly documents that it provides:

1. A REST API for custom integrations
2. Webhooks for campaign/prospect activity
3. Campaign analytics and reporting inside SalesRobot
4. Campaign-level, account-level, team-level, and daily analytics

SalesRobot states that webhooks can notify external systems about events such as:

- New connections
- New replies
- Messages sent
- Other campaign activity

This means we can build our own analytics layer by consuming SalesRobot events and/or API data.

> Important:
> The public documentation confirms REST API and webhook support, but a dedicated API endpoint that returns all SalesRobot dashboard analytics in one response was not clearly documented in the public pages reviewed.
>
> The developer should first inspect the latest SalesRobot API/Postman documentation to determine whether campaign statistics can be fetched directly. If not, analytics should be calculated from webhook/API events stored in our own database.

---

# Recommended Integration Architecture

```text
SalesRobot
   |
   +------------------------+
   |                        |
REST API                Webhooks
   |                        |
   +-----------+------------+
               |
               v
        Our Backend API
               |
               v
        Event/Data Storage
               |
               v
       Weekly Aggregation
               |
               v
      Analytics Dashboard
```

Recommended approach: use **both REST API and webhooks**.

### Webhooks

Use webhooks for near-real-time event collection.

Examples:

```text
connection_request_sent
connection_accepted
message_sent
reply_received
```

### REST API

Use the REST API for:

- Campaign discovery
- Campaign metadata
- Lead/prospect synchronization
- LinkedIn account information
- Reconciliation
- Recovering data if webhook delivery was missed

A scheduled reconciliation job can run periodically, for example every few hours or once per day.

---

# Authentication

SalesRobot API examples use an API key passed in the request headers.

Example:

```http
x-api-key: YOUR_SALESROBOT_API_KEY
```

Do not expose this API key to the frontend.

Store it server-side using an environment variable or secrets manager.

Example:

```env
SALESROBOT_API_KEY=xxxxxxxxxxxxxxxx
```

---

# Developer Tasks

## 1. Review SalesRobot API documentation

Determine which endpoints are currently available for:

- List campaigns
- Get campaign details
- Get campaign prospects/leads
- Get prospect status
- Get LinkedIn account details
- Get messages
- Get replies
- Get connection activity
- Get campaign statistics/analytics, if available
- Configure/read webhooks, if supported through API

Do not assume endpoint URLs from examples remain permanent. Use the latest official API documentation.

---

## 2. Determine whether Analytics API endpoints exist

Look specifically for endpoints supporting parameters similar to:

```text
campaignUuid
fromDate
toDate
startDate
endDate
accountUuid
status
```

Ideal API functionality would look conceptually like:

```http
GET /campaign/{campaignId}/analytics
```

or:

```http
GET /analytics/campaign
```

with parameters such as:

```text
campaignId
from
to
```

The exact endpoint must be taken from SalesRobot's current documentation.

If SalesRobot provides direct reporting endpoints, use them where appropriate.

If not, create our own analytics from stored webhook/API event data.

---

# 3. Webhook Receiver

Create an endpoint in our backend.

Example:

```http
POST /api/integrations/salesrobot/webhook
```

Example Express structure:

```js
router.post("/integrations/salesrobot/webhook", async (req, res) => {
  try {
    const payload = req.body;

    console.log("SalesRobot webhook:", payload);

    await salesRobotWebhookService.process(payload);

    return res.status(200).json({
      success: true
    });
  } catch (error) {
    console.error("SalesRobot webhook error:", error);

    return res.status(500).json({
      success: false
    });
  }
});
```

The exact webhook payload must be confirmed from SalesRobot before mapping fields.

---

# 4. Store Raw Events

It is recommended to store the original webhook event before processing it.

Example table/collection:

```text
salesrobot_events
```

Suggested fields:

```text
id
external_event_id
event_type
campaign_id
campaign_name
linkedin_account_id
prospect_id
prospect_linkedin_url
occurred_at
received_at
raw_payload
processed
```

Example record:

```json
{
  "event_type": "reply_received",
  "campaign_id": "campaign-123",
  "linkedin_account_id": "linkedin-account-456",
  "prospect_id": "prospect-789",
  "occurred_at": "2026-09-21T10:20:00Z",
  "received_at": "2026-09-21T10:20:02Z"
}
```

Do not depend on these exact field names until the real SalesRobot payload has been inspected.

---

# 5. Suggested Campaign Table

```text
salesrobot_campaigns
```

Suggested structure:

```text
id
salesrobot_campaign_id
name
linkedin_account_id
status
created_at
updated_at
last_synced_at
```

---

# 6. Suggested Prospect Table

```text
salesrobot_prospects
```

Suggested fields:

```text
id
salesrobot_prospect_id
campaign_id
linkedin_url
first_name
last_name
company
status
added_at
connection_requested_at
connected_at
first_message_sent_at
replied_at
created_at
updated_at
```

---

# 7. Weekly Analytics Table

It is useful to store aggregated statistics so dashboards load quickly.

Example:

```text
salesrobot_weekly_analytics
```

Suggested structure:

```text
id
campaign_id
linkedin_account_id
week_start
week_end

prospects_added
connection_requests_sent
connections_accepted
messages_sent
replies_received

acceptance_rate
reply_rate

created_at
updated_at
```

---

# Metric Calculations

## Acceptance Rate

```text
connections accepted / connection requests sent * 100
```

Example:

```text
Requests sent = 500
Connections accepted = 200

Acceptance Rate = 200 / 500 * 100
                = 40%
```

---

## Reply Rate

The business should decide which denominator is required.

Possible definitions include:

### Replies compared with connections

```text
replies / connections accepted * 100
```

### Replies compared with messages sent

```text
replies / messages sent * 100
```

### Replies compared with contacted prospects

```text
replies / contacted prospects * 100
```

Use the same definition consistently across the dashboard.

If SalesRobot has an official definition for "reply rate", follow that definition when trying to match their UI.

---

# Example Weekly Dashboard

| Week | Prospects | Requests Sent | Connections | Replies | Acceptance Rate | Reply Rate |
|---|---:|---:|---:|---:|---:|---:|
| Sep 1-7 | 520 | 410 | 173 | 42 | 42.2% | 10.2% |
| Sep 8-14 | 610 | 480 | 216 | 61 | 45.0% | 12.7% |
| Sep 15-21 | 570 | 455 | 223 | 67 | 49.0% | 14.7% |

---

# Suggested Dashboard Filters

Support the following filters:

```text
Date Range
Campaign
LinkedIn Account
Team Member
Campaign Status
```

Date presets:

```text
Today
Last 7 Days
This Week
Last Week
Last 30 Days
This Month
Last Month
Custom Range
```

---

# Suggested Dashboard Cards

Display:

```text
Total Prospects
Requests Sent
Connections
Messages Sent
Replies
Acceptance Rate
Reply Rate
```

Also consider charts for:

```text
Connections by Week
Replies by Week
Requests Sent by Week
Acceptance Rate Trend
Reply Rate Trend
Campaign Comparison
```

---

# Backend Sync Strategy

## Initial Sync

When the SalesRobot integration is connected:

1. Retrieve campaigns.
2. Save campaigns locally.
3. Retrieve available prospects/activity.
4. Save historical data where the API allows it.
5. Calculate historical analytics.
6. Register/configure webhooks.

---

## Ongoing Sync

Use webhooks for new activity.

Conceptually:

```text
SalesRobot event
      |
      v
Webhook endpoint
      |
      v
Store raw event
      |
      v
Update prospect/campaign
      |
      v
Update aggregate analytics
```

---

## Reconciliation Job

Run a scheduled process to make sure our database remains synchronized.

Example:

```text
Every 6 hours
```

or:

```text
Once every night
```

Process:

```text
Fetch campaigns
    |
Fetch recent activity
    |
Compare with database
    |
Insert missing events/data
    |
Recalculate affected analytics
```

---

# Duplicate Event Handling

Webhooks can occasionally be delivered more than once.

The integration must be idempotent.

If SalesRobot provides an event ID:

```text
external_event_id
```

make it unique.

Example:

```sql
UNIQUE(external_event_id)
```

If no unique event ID exists, create a deduplication key using stable fields such as:

```text
event_type
campaign_id
prospect_id
occurred_at
```

---

# Recommended API Wrapper

Keep SalesRobot-specific logic in a separate service.

Suggested project structure:

```text
src/
  integrations/
    salesrobot/
      salesrobot.client.js
      salesrobot.service.js
      salesrobot.webhook.js
      salesrobot.analytics.js
      salesrobot.sync.js
```

Example client:

```js
const axios = require("axios");

const salesRobotClient = axios.create({
  baseURL: process.env.SALESROBOT_API_BASE_URL,
  headers: {
    "x-api-key": process.env.SALESROBOT_API_KEY,
    "Content-Type": "application/json"
  }
});

module.exports = salesRobotClient;
```

Do not hardcode the API base URL until it has been confirmed from the latest SalesRobot documentation.

---

# Security Requirements

The SalesRobot API key must:

- Never be returned to the frontend
- Never be committed to Git
- Never appear in client-side JavaScript
- Be stored in a backend secret/environment variable
- Be masked in logs

For multi-tenant systems, encrypt integration credentials at rest.

---

# Error Handling

The integration should gracefully handle:

```text
401 / invalid API key
403 / insufficient permissions
404 / campaign removed
429 / rate limiting
500 / SalesRobot service error
network timeout
webhook duplicate
malformed webhook payload
```

Implement retries with exponential backoff for temporary failures.

Do not indefinitely retry permanent 4xx failures.

---

# Logging

Recommended log fields:

```text
integration=salesrobot
campaign_id
prospect_id
event_type
request_id
http_status
duration_ms
```

Never log the API key.

---

# Important Questions Developer Must Verify

Before implementation, verify the following against the current SalesRobot documentation/account:

1. Is there a direct Campaign Analytics API?
2. Can statistics be filtered by date range?
3. Can historical connection requests be retrieved?
4. Can historical accepted connections be retrieved?
5. Can historical replies/messages be retrieved?
6. What webhook event types are available?
7. What is the exact webhook payload schema?
8. Is webhook authentication/signature verification supported?
9. What API rate limits apply?
10. Does the API use pagination?
11. What timezone does SalesRobot use for analytics?
12. How does SalesRobot define acceptance rate?
13. How does SalesRobot define reply rate?
14. Can team/account-level analytics be fetched through API?
15. Does the current subscription plan include the required API/webhook functionality?

---

# Official SalesRobot Documentation and References

## Main API Documentation

SalesRobot's integrations page currently links to this Postman-based API documentation:

https://documenter.getpostman.com/view/10815846/2sB3BKE8Fb

Start here when implementing the integration.

---

## SalesRobot Developer/API Documentation

An additional SalesRobot API documentation site is available at:

https://docs.salesrobot.co/

Example API reference page:

https://docs.salesrobot.co/reference/updatecampaignsecondaryaccount

That example shows API-key authentication using:

```http
x-api-key
```

The developer should navigate through the current API reference to identify all relevant Campaign, Prospect, Account, and Messaging endpoints.

---

## SalesRobot Integrations Page

https://www.salesrobot.co/integrations

This page confirms that SalesRobot supports:

- REST API integrations
- Custom integrations
- Webhook workflows
- Campaign and lead automation
- Real-time prospect/campaign activity workflows

It also states that webhook workflows can receive updates such as new connections, new replies, and messages sent.

---

## SalesRobot Analytics Page

https://www.salesrobot.co/analytics

This page describes SalesRobot's built-in analytics, including:

- Overall LinkedIn account performance
- Campaign-level performance
- Daily statistics
- Campaign step-level performance
- Reporting across selected time periods

Use this page as the functional reference for what our dashboard should aim to display.

---

## SalesRobot Help Center

https://salesrobot.crisp.help/en/

Useful sections include:

```text
Integrations and Automation
SalesRobot Metric Guide
SalesRobot Settings
Campaign Setup
```

The metric guide should be reviewed before matching formulas such as reply rate and acceptance rate.

---

## SalesRobot Application

https://app.salesrobot.co/

Use the SalesRobot account UI to configure integrations/webhooks and compare our analytics output with SalesRobot's own dashboard.

---

# Implementation Recommendation

Preferred implementation:

```text
1. REST API
   -> Campaign/account/prospect discovery
   -> Historical synchronization
   -> Periodic reconciliation

2. Webhooks
   -> Real-time connections
   -> Real-time messages
   -> Real-time replies
   -> Other supported campaign events

3. Our Database
   -> Store raw activity permanently
   -> Maintain campaign/prospect state

4. Analytics Service
   -> Group records by week/month/date range
   -> Calculate acceptance and reply rates

5. Dashboard
   -> Display KPIs and performance trends
```

This design avoids depending entirely on SalesRobot's dashboard and gives us control over long-term historical reporting.

---

# Phase 1 Acceptance Criteria

The first implementation should be considered complete when:

- SalesRobot credentials can be configured securely.
- Campaigns can be synchronized to our platform.
- At least one real webhook event can be received.
- Connections and replies can be stored.
- Events are deduplicated.
- Analytics can be grouped by week.
- The dashboard can show:
  - Requests sent
  - Connections
  - Replies
  - Acceptance rate
  - Reply rate
- A date-range filter works.
- A campaign filter works.
- A reconciliation job exists.
- Failed SalesRobot API calls are logged and retried where appropriate.

---

# Final Note

Do not build the integration based only on endpoint examples in this document.

SalesRobot has multiple documentation surfaces, and API endpoints can change. The developer should use the latest official SalesRobot API/Postman documentation when selecting:

```text
API base URL
endpoint paths
request payloads
response fields
pagination behavior
webhook schemas
rate limits
authentication requirements
```

The recommended architecture above remains valid even if individual SalesRobot endpoint names change.
