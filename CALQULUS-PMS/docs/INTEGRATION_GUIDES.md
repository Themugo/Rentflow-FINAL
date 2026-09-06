# Integration Guides

## Table of Contents
1. [Introduction](#introduction)
2. [Payment Gateway Integration](#payment-gateway-integration)
3. [M-Pesa Integration](#m-pesa-integration)
4. [Bank Transfer Integration](#bank-transfer-integration)
5. [Stripe Integration](#stripe-integration)
6. [SMS Gateway Integration](#sms-gateway-integration)
7. [Email Service Integration](#email-service-integration)
8. [Webhook Integration](#webhook-integration)
9. [API Integration](#api-integration)
10. [Third-Party Service Integration](#third-party-service-integration)

## Introduction

CALQULUS RMS provides multiple integration options to connect with external systems, payment gateways, and third-party services. This guide covers the most common integrations and how to set them up.

### Integration Types

- **Payment Gateways** - M-Pesa, Stripe, Bank Transfers
- **Communication Services** - SMS gateways, Email services
- **Webhooks** - Real-time event notifications
- **API Integration** - RESTful API for custom integrations
- **Third-Party Services** - Accounting software, CRM, etc.

### Integration Benefits

- Automated payment processing
- Real-time notifications
- Data synchronization
- Custom workflows
- Enhanced functionality

### Prerequisites

Before integrating with CALQULUS RMS:
- Have active CALQULUS RMS account
- Obtain API credentials from CALQULUS RMS
- Have accounts with third-party services
- Understand integration requirements
- Have technical resources for implementation

## Payment Gateway Integration

### Overview

CALQULUS RMS supports multiple payment gateways for rent collection:
- M-Pesa (mobile money)
- Stripe (credit/debit cards)
- Bank transfers (direct bank payments)
- Custom payment gateways

### General Setup Process

1. Navigate to **Settings** → **Payment Methods**
2. Select payment gateway to configure
3. Enter API credentials
4. Configure settings
5. Test integration
6. Enable for production use

### Security Considerations

- Store API credentials securely
- Use environment variables for sensitive data
- Enable two-factor authentication
- Regularly rotate API keys
- Monitor for unauthorized access
- Use HTTPS for all API calls

## M-Pesa Integration

### Overview

M-Pesa is Safaricom's mobile money service widely used in Kenya for payments. CALQULUS RMS provides full M-Pesa integration for rent collection.

### Prerequisites

- Active M-Pesa business account
- M-Pesa business shortcode
- M-Pesa API credentials (Consumer Key, Consumer Secret)
- Lipa na M-Pesa Online (STK Push) enabled
- M-Pesa Paybill or Till Number

### Setup Steps

#### 1. Obtain M-Pesa Credentials

1. Log in to [Safaricom Developer Portal](https://developer.safaricom.co.ke)
2. Create a new app
3. Generate API credentials:
   - Consumer Key
   - Consumer Secret
4. Enable Lipa na M-Pesa Online
5. Note your business shortcode and passkey

#### 2. Configure in CALQULUS RMS

1. Navigate to **Settings** → **Payment Methods**
2. Select **M-Pesa**
3. Enter credentials:
   ```
   Consumer Key: [Your Consumer Key]
   Consumer Secret: [Your Consumer Secret]
   Business Shortcode: [Your Shortcode]
   Passkey: [Your Passkey]
   Environment: [Sandbox or Production]
   ```
4. Click **Test Connection**
5. Verify connection is successful
6. Click **Save**

#### 3. Configure Payment Settings

1. Set default payment method for tenants
2. Configure payment confirmation callback URL
3. Set up payment notification settings
4. Configure refund settings
5. Enable for production use

### M-Pesa Payment Flow

```
1. Tenant initiates payment
2. CALQULUS RMS sends STK Push to M-Pesa
3. Tenant receives M-Pesa prompt
4. Tenant enters M-Pesa PIN
5. M-Pesa processes payment
6. M-Pesa sends callback to CALQULUS RMS
7. CALQULUS RMS updates payment status
8. Tenant receives confirmation
9. Manager receives notification
```

### Testing M-Pesa Integration

1. Use M-Pesa sandbox environment for testing
2. Test with small amounts (KES 1-10)
3. Verify payment flow works end-to-end
4. Test payment confirmation callbacks
5. Test refund process
6. Move to production after successful testing

### Troubleshooting M-Pesa

- **STK Push not received**: Check phone number format, ensure network coverage
- **Payment timeout**: Increase timeout duration, check M-Pesa service status
- **Callback not received**: Verify callback URL is accessible, check firewall settings
- **Invalid credentials**: Verify Consumer Key and Secret are correct
- **Transaction failed**: Check M-Pesa account balance, verify shortcode is active

## Bank Transfer Integration

### Overview

Bank transfer integration allows tenants to pay rent via direct bank transfers. CALQULUS RMS automatically matches payments using reference numbers.

### Prerequisites

- Active bank account
- Bank API access (optional for automatic matching)
- Bank account details for tenants
- Payment reference system

### Setup Steps

#### 1. Configure Bank Account

1. Navigate to **Settings** → **Payment Methods**
2. Select **Bank Transfer**
3. Enter bank details:
   ```
   Bank Name: [Your Bank]
   Account Number: [Your Account Number]
   Account Holder: [Account Holder Name]
   Branch: [Branch Name]
   SWIFT Code: [SWIFT Code]
   ```
4. Click **Save**

#### 2. Configure Payment Reference System

1. Set up reference number format
2. Configure automatic matching rules
3. Set up bank statement import
4. Configure notification settings

#### 3. Provide Payment Instructions to Tenants

1. Generate payment instructions for each tenant
2. Include:
   - Bank account details
   - Reference number format
   - Payment deadline
   - Processing time
3. Send to tenants via email or portal

### Bank Transfer Payment Flow

```
1. Tenant initiates bank transfer
2. Tenant includes reference number
3. Bank processes transfer
4. CALQULUS RMS receives bank statement
5. CALQULUS RMS matches payment by reference
6. Payment is automatically confirmed
7. Tenant receives confirmation
8. Manager receives notification
```

### Automatic Payment Matching

CALQULUS RMS can automatically match bank transfers:
- **By Reference Number**: Match using tenant-specific reference
- **By Amount**: Match using payment amount and date
- **By Description**: Match using payment description
- **Manual Review**: Flag unmatched payments for review

### Testing Bank Transfer Integration

1. Test with small transfer amounts
2. Verify reference number format works
3. Test automatic matching
4. Test manual matching
5. Verify notification system
6. Test refund process

## Stripe Integration

### Overview

Stripe integration enables credit and debit card payments for rent collection. CALQULUS RMS uses Stripe's secure payment processing.

### Prerequisites

- Active Stripe account
- Stripe API keys (Publishable Key, Secret Key)
- Stripe account verified
- Webhook endpoint configured

### Setup Steps

#### 1. Obtain Stripe Credentials

1. Log in to [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to **Developers** → **API Keys**
3. Copy API keys:
   - Publishable Key (pk_live_...)
   - Secret Key (sk_live_...)
4. For testing, use test keys (pk_test_..., sk_test_...)

#### 2. Configure in CALQULUS RMS

1. Navigate to **Settings** → **Payment Methods**
2. Select **Stripe**
3. Enter credentials:
   ```
   Publishable Key: [Your Publishable Key]
   Secret Key: [Your Secret Key]
   Environment: [Test or Production]
   ```
4. Click **Test Connection**
5. Verify connection is successful
6. Click **Save**

#### 3. Configure Webhooks

1. In Stripe Dashboard, navigate to **Developers** → **Webhooks**
2. Add webhook endpoint:
   ```
   URL: https://www.calqulus.site/api/webhooks/stripe
   Events: payment_intent.succeeded, payment_intent.failed, charge.refunded
   ```
3. Copy webhook signing secret
4. Enter signing secret in CALQULUS RMS settings

#### 4. Configure Payment Settings

1. Set up 3D Secure authentication
2. Configure payment methods (card types)
3. Set up recurring payments
4. Configure refund settings
5. Enable for production use

### Stripe Payment Flow

```
1. Tenant enters card details
2. CALQULUS RMS creates payment intent
3. Stripe processes payment
4. 3D Secure authentication if required
5. Stripe sends webhook to CALQULUS RMS
6. CALQULUS RMS updates payment status
7. Tenant receives confirmation
8. Manager receives notification
```

### Testing Stripe Integration

1. Use Stripe test mode for testing
2. Test with Stripe test cards
3. Verify payment flow works end-to-end
4. Test webhook delivery
5. Test refund process
6. Test 3D Secure authentication
7. Move to production after successful testing

### Troubleshooting Stripe

- **Payment declined**: Check card details, verify 3D Secure, check Stripe dashboard
- **Webhook not received**: Verify webhook URL is accessible, check Stripe logs
- **Invalid API key**: Verify Secret Key is correct and active
- **3D Secure failure**: Ensure 3D Secure is properly configured

## SMS Gateway Integration

### Overview

SMS gateway integration enables CALQULUS RMS to send SMS notifications for rent reminders, maintenance updates, and other communications.

### Prerequisites

- SMS gateway account
- API credentials
- Sender ID (optional)
- SMS credits or subscription

### Supported SMS Gateways

- Africa's Talking
- Twilio
- Nexmo
- Custom SMS gateways

### Setup Steps (Africa's Talking Example)

#### 1. Obtain SMS Gateway Credentials

1. Log in to [Africa's Talking](https://africastalking.com)
2. Navigate to **Settings** → **API Credentials**
3. Note your:
   - Username
   - API Key
   - Sender ID (if configured)

#### 2. Configure in CALQULUS RMS

1. Navigate to **Settings** → **Notifications** → **SMS**
2. Select SMS provider (Africa's Talking)
3. Enter credentials:
   ```
   Username: [Your Username]
   API Key: [Your API Key]
   Sender ID: [Your Sender ID]
   ```
4. Click **Test Connection**
5. Send test SMS
6. Click **Save**

#### 3. Configure SMS Templates

1. Set up SMS templates for:
   - Rent reminders
   - Payment confirmations
   - Maintenance notifications
   - Lease expirations
   - General announcements
2. Customize message templates
3. Set up personalization variables

### SMS Notification Flow

```
1. Event triggers notification (e.g., rent due)
2. CALQULUS RMS generates SMS message
3. CALQULUS RMS sends to SMS gateway
4. SMS gateway delivers to recipient
5. Delivery status returned
6. CALQULUS RMS logs delivery status
```

### Testing SMS Integration

1. Send test SMS to your phone
2. Verify message delivery
3. Test delivery status tracking
4. Test message templates
5. Verify personalization works
6. Test bulk SMS sending

### Troubleshooting SMS

- **SMS not delivered**: Check phone number format, verify SMS credits
- **Delivery status unknown**: Check gateway API status, verify webhook
- **Invalid credentials**: Verify API key is correct and active
- **Sender ID not approved**: Wait for sender ID approval from provider

## Email Service Integration

### Overview

Email service integration enables CALQULUS RMS to send transactional emails for notifications, reports, and communications.

### Prerequisites

- Email service account
- SMTP credentials or API keys
- Verified sender domain
- Email templates

### Supported Email Services

- SendGrid
- Mailgun
- AWS SES
- Custom SMTP servers

### Setup Steps (SendGrid Example)

#### 1. Obtain Email Service Credentials

1. Log in to [SendGrid](https://sendgrid.com)
2. Navigate to **Settings** → **API Keys**
3. Create API key with appropriate permissions
4. Note your API key
5. Verify sender domain

#### 2. Configure in CALQULUS RMS

1. Navigate to **Settings** → **Notifications** → **Email**
2. Select email provider (SendGrid)
3. Enter credentials:
   ```
   API Key: [Your API Key]
   From Email: [noreply@yourdomain.com]
   From Name: [Your Company Name]
   ```
4. Click **Test Connection**
5. Send test email
6. Click **Save**

#### 3. Configure Email Templates

1. Set up email templates for:
   - Rent reminders
   - Payment confirmations
   - Maintenance notifications
   - Lease expirations
   - Password resets
   - Welcome emails
2. Customize HTML templates
3. Set up personalization variables

### Email Notification Flow

```
1. Event triggers notification
2. CALQULUS RMS generates email message
3. CALQULUS RMS sends to email service
4. Email service delivers to recipient
5. Delivery status returned
6. CALQULUS RMS logs delivery status
7. Track opens and clicks
```

### Testing Email Integration

1. Send test email to your address
2. Verify email delivery
3. Check email rendering
4. Test email templates
5. Verify personalization works
6. Test bulk email sending

### Troubleshooting Email

- **Email not delivered**: Check recipient address, verify sender domain
- **Email in spam**: Check SPF/DKIM records, verify content
- **Invalid API key**: Verify API key is correct and active
- **Template errors**: Check template syntax, verify variables

## Webhook Integration

### Overview

Webhooks enable real-time notifications from CALQULUS RMS to external systems when events occur. This allows for automated workflows and data synchronization.

### Supported Webhook Events

- **Payment Events**: payment.completed, payment.failed, payment.refunded
- **Tenant Events**: tenant.created, tenant.updated, tenant.deleted
- **Lease Events**: lease.created, lease.updated, lease.expired
- **Maintenance Events**: maintenance.created, maintenance.updated, maintenance.completed
- **Property Events**: property.created, property.updated, property.deleted

### Setup Steps

#### 1. Configure Webhook Endpoint

1. Create webhook endpoint on your server
2. Implement webhook handler
3. Verify endpoint is accessible via HTTPS
4. Implement signature verification

#### 2. Register Webhook in CALQULUS RMS

1. Navigate to **Settings** → **API** → **Webhooks**
2. Click **Add Webhook**
3. Enter webhook details:
   ```
   URL: [Your Webhook URL]
   Events: [Select events to subscribe]
   Secret: [Webhook signing secret]
   Active: [Enable webhook]
   ```
4. Click **Save**

#### 3. Implement Webhook Handler

Example webhook handler (Node.js):

```javascript
const express = require('express');
const crypto = require('crypto');
const app = express();

app.post('/webhook', express.raw({type: 'application/json'}), (req, res) => {
  const signature = req.headers['x-calqulusrms-signature'];
  const payload = req.body;
  
  // Verify signature
  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
  
  if (signature !== expectedSignature) {
    return res.status(401).send('Invalid signature');
  }
  
  // Process webhook
  const event = JSON.parse(payload);
  console.log('Received event:', event.type);
  
  // Handle event based on type
  switch (event.type) {
    case 'payment.completed':
      handlePaymentCompleted(event.data);
      break;
    case 'tenant.created':
      handleTenantCreated(event.data);
      break;
    // Handle other events
  }
  
  res.status(200).send('OK');
});

app.listen(3000);
```

### Webhook Payload Structure

```json
{
  "id": "evt_123456789",
  "type": "payment.completed",
  "data": {
    "payment_id": "pay_123456",
    "amount": 15000,
    "currency": "KES",
    "tenant_id": "tenant_123",
    "property_id": "prop_456",
    "timestamp": "2026-06-03T10:00:00Z"
  },
  "timestamp": "2026-06-03T10:00:00Z"
}
```

### Testing Webhooks

1. Use webhook testing tools (ngrok, localtunnel)
2. Test with sample events
3. Verify signature verification
4. Test error handling
5. Test retry logic

### Troubleshooting Webhooks

- **Webhook not received**: Check URL is accessible, verify network connectivity
- **Invalid signature**: Verify secret is correct, check signature calculation
- **Payload errors**: Validate JSON structure, check data types
- **Timeout errors**: Increase timeout duration, optimize handler performance

## API Integration

### Overview

CALQULUS RMS provides a RESTful API for custom integrations and automation. The API allows programmatic access to all CALQULUS RMS features.

### Prerequisites

- Active CALQULUS RMS account
- API key from CALQULUS RMS
- Understanding of REST APIs
- Development environment

### Authentication

CALQULUS RMS uses API keys for authentication:

```http
Authorization: Bearer YOUR_API_KEY
```

### API Endpoints

#### Properties
- `GET /api/properties` - List all properties
- `POST /api/properties` - Create property
- `GET /api/properties/:id` - Get property details
- `PUT /api/properties/:id` - Update property
- `DELETE /api/properties/:id` - Delete property

#### Tenants
- `GET /api/tenants` - List all tenants
- `POST /api/tenants` - Create tenant
- `GET /api/tenants/:id` - Get tenant details
- `PUT /api/tenants/:id` - Update tenant
- `DELETE /api/tenants/:id` - Delete tenant

#### Leases
- `GET /api/leases` - List all leases
- `POST /api/leases` - Create lease
- `GET /api/leases/:id` - Get lease details
- `PUT /api/leases/:id` - Update lease
- `DELETE /api/leases/:id` - Delete lease

#### Payments
- `GET /api/payments` - List all payments
- `POST /api/payments` - Create payment
- `GET /api/payments/:id` - Get payment details
- `POST /api/payments/:id/refund` - Refund payment

### Example API Calls

#### Get Properties

```bash
curl -X GET https://api.calqulusrms.com/api/properties \
  -H "Authorization: Bearer YOUR_API_KEY"
```

#### Create Tenant

```bash
curl -X POST https://api.calqulusrms.com/api/tenants \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+254712345678",
    "property_id": "prop_123",
    "unit_id": "unit_456"
  }'
```

#### Create Payment

```bash
curl -X POST https://api.calqulusrms.com/api/payments \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "tenant_123",
    "amount": 15000,
    "currency": "KES",
    "payment_method": "mpesa",
    "phone_number": "+254712345678"
  }'
```

### Rate Limiting

CALQULUS RMS API has rate limits:
- **Standard**: 100 requests per minute
- **Premium**: 1000 requests per minute
- **Enterprise**: Custom limits

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1625097600
```

### Error Handling

API errors follow standard HTTP status codes:
- `200` - Success
- `400` - Bad request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not found
- `429` - Rate limit exceeded
- `500` - Server error

Error response format:
```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Invalid request parameters",
    "details": {
      "field": "email",
      "issue": "Invalid email format"
    }
  }
}
```

### Testing API Integration

1. Use API documentation explorer
2. Test with sample data
3. Verify authentication works
4. Test error handling
5. Test rate limiting
6. Use sandbox environment first

## Third-Party Service Integration

### Accounting Software Integration

#### QuickBooks Integration

1. Navigate to **Settings** → **Integrations** → **QuickBooks**
2. Connect QuickBooks account
3. Configure data sync settings
4. Map CALQULUS RMS accounts to QuickBooks
5. Set up automatic sync

#### Xero Integration

1. Navigate to **Settings** → **Integrations** → **Xero**
2. Connect Xero account
3. Configure data sync settings
4. Map CALQULUS RMS accounts to Xero
5. Set up automatic sync

### CRM Integration

#### Salesforce Integration

1. Navigate to **Settings** → **Integrations** → **Salesforce**
2. Connect Salesforce account
3. Configure field mappings
4. Set up data sync
5. Configure automation rules

#### HubSpot Integration

1. Navigate to **Settings** → **Integrations** → **HubSpot**
2. Connect HubSpot account
3. Configure field mappings
4. Set up data sync
5. Configure automation rules

### Custom Integration

For custom integrations:
1. Use CALQULUS RMS API
2. Implement webhooks
3. Use data export features
4. Configure scheduled sync
5. Monitor integration health

## Best Practices

### Security
- Always use HTTPS
- Store credentials securely
- Implement signature verification
- Regularly rotate API keys
- Monitor for unauthorized access
- Use environment variables

### Performance
- Implement retry logic for failed requests
- Use caching where appropriate
- Optimize webhook handlers
- Monitor API usage
- Implement rate limiting in your application

### Reliability
- Implement error handling
- Log all API calls
- Monitor webhook delivery
- Implement fallback mechanisms
- Test thoroughly before production

### Maintenance
- Monitor integration health
- Set up alerts for failures
- Regularly update integrations
- Keep documentation current
- Plan for API changes

## Support

For integration support:
- **Documentation**: https://docs.calqulusrms.com/api
- **API Reference**: https://api.calqulusrms.com/docs
- **Support Email**: api-support@calqulusrms.com
- **Community Forum**: https://community.calqulusrms.com

## Appendix

### Glossary

- **API**: Application Programming Interface
- **Webhook**: HTTP callback for real-time notifications
- **STK Push**: M-Pesa payment prompt sent to phone
- **3D Secure**: Card authentication protocol
- **Rate Limiting**: API request rate restriction

### Additional Resources

- **API Documentation**: https://api.calqulusrms.com/docs
- **Webhook Guide**: https://docs.calqulusrms.com/webhooks
- **SDK Downloads**: https://github.com/calqulusrms/sdk
- **Integration Examples**: https://github.com/calqulusrms/examples

---

**Version**: 1.0  
**Last Updated**: June 2026  
**For questions or feedback, contact api-support@calqulusrms.com**
