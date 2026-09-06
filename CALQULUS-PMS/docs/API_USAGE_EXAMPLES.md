# API Usage Examples

## Table of Contents
1. [Introduction](#introduction)
2. [Authentication](#authentication)
3. [Properties API](#properties-api)
4. [Tenants API](#tenants-api)
5. [Leases API](#leases-api)
6. [Payments API](#payments-api)
7. [Maintenance API](#maintenance-api)
8. [Webhooks](#webhooks)
9. [Error Handling](#error-handling)
10. [Rate Limiting](#rate-limiting)
11. [Best Practices](#best-practices)

## Introduction

This guide provides practical examples for using the CALQULUS RMS API. Each example includes code samples in multiple languages and explains common use cases.

### Prerequisites

- Active CALQULUS RMS account
- API key from CALQULUS RMS dashboard
- Understanding of REST APIs
- Development environment

### Base URL

```
Production: https://api.calqulusrms.com
Sandbox: https://api-sandbox.calqulusrms.com
```

### API Versioning

The current API version is `v1`. Include the version in your requests:

```
https://api.calqulusrms.com/v1/...
```

## Authentication

### Getting Your API Key

1. Log in to CALQULUS RMS dashboard
2. Navigate to Settings → API
3. Generate new API key
4. Copy the key securely

### Using API Key

Include the API key in the Authorization header:

```http
Authorization: Bearer YOUR_API_KEY
```

### Example: Authentication

#### cURL

```bash
curl -X GET https://api.calqulusrms.com/v1/properties \
  -H "Authorization: Bearer YOUR_API_KEY"
```

#### JavaScript (Fetch)

```javascript
const response = await fetch('https://api.calqulusrms.com/v1/properties', {
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY'
  }
});
const data = await response.json();
```

#### Python (Requests)

```python
import requests

headers = {
    'Authorization': 'Bearer YOUR_API_KEY'
}

response = requests.get('https://api.calqulusrms.com/v1/properties', headers=headers)
data = response.json()
```

#### Node.js (Axios)

```javascript
const axios = require('axios');

const response = await axios.get('https://api.calqulusrms.com/v1/properties', {
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY'
  }
});
const data = response.data;
```

## Properties API

### List All Properties

Retrieve all properties for your account.

#### cURL

```bash
curl -X GET https://api.calqulusrms.com/v1/properties \
  -H "Authorization: Bearer YOUR_API_KEY"
```

#### JavaScript

```javascript
const response = await fetch('https://api.calqulusrms.com/v1/properties', {
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY'
  }
});
const properties = await response.json();
```

#### Response

```json
{
  "data": [
    {
      "id": "prop_123",
      "name": "Sunset Apartments",
      "address": "123 Main St, Nairobi",
      "type": "apartment",
      "units": 50,
      "created_at": "2026-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "per_page": 20
  }
}
```

### Create Property

Create a new property.

#### cURL

```bash
curl -X POST https://api.calqulusrms.com/v1/properties \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sunset Apartments",
    "address": "123 Main St, Nairobi",
    "type": "apartment",
    "units": 50
  }'
```

#### JavaScript

```javascript
const response = await fetch('https://api.calqulusrms.com/v1/properties', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'Sunset Apartments',
    address: '123 Main St, Nairobi',
    type: 'apartment',
    units: 50
  })
});
const property = await response.json();
```

#### Response

```json
{
  "data": {
    "id": "prop_123",
    "name": "Sunset Apartments",
    "address": "123 Main St, Nairobi",
    "type": "apartment",
    "units": 50,
    "created_at": "2026-06-03T10:00:00Z"
  }
}
```

### Get Property Details

Retrieve details for a specific property.

#### cURL

```bash
curl -X GET https://api.calqulusrms.com/v1/properties/prop_123 \
  -H "Authorization: Bearer YOUR_API_KEY"
```

#### JavaScript

```javascript
const response = await fetch('https://api.calqulusrms.com/v1/properties/prop_123', {
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY'
  }
});
const property = await response.json();
```

### Update Property

Update an existing property.

#### cURL

```bash
curl -X PUT https://api.calqulusrms.com/v1/properties/prop_123 \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sunset Apartments - Updated",
    "units": 60
  }'
```

#### JavaScript

```javascript
const response = await fetch('https://api.calqulusrms.com/v1/properties/prop_123', {
  method: 'PUT',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'Sunset Apartments - Updated',
    units: 60
  })
});
const property = await response.json();
```

### Delete Property

Delete a property.

#### cURL

```bash
curl -X DELETE https://api.calqulusrms.com/v1/properties/prop_123 \
  -H "Authorization: Bearer YOUR_API_KEY"
```

#### JavaScript

```javascript
const response = await fetch('https://api.calqulusrms.com/v1/properties/prop_123', {
  method: 'DELETE',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY'
  }
});
```

## Tenants API

### List All Tenants

Retrieve all tenants for your account.

#### cURL

```bash
curl -X GET https://api.calqulusrms.com/v1/tenants \
  -H "Authorization: Bearer YOUR_API_KEY"
```

#### JavaScript

```javascript
const response = await fetch('https://api.calqulusrms.com/v1/tenants', {
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY'
  }
});
const tenants = await response.json();
```

#### Response

```json
{
  "data": [
    {
      "id": "tenant_123",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+254712345678",
      "property_id": "prop_123",
      "unit_id": "unit_456",
      "created_at": "2026-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "per_page": 20
  }
}
```

### Create Tenant

Create a new tenant.

#### cURL

```bash
curl -X POST https://api.calqulusrms.com/v1/tenants \
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

#### JavaScript

```javascript
const response = await fetch('https://api.calqulusrms.com/v1/tenants', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'John Doe',
    email: 'john@example.com',
    phone: '+254712345678',
    property_id: 'prop_123',
    unit_id: 'unit_456'
  })
});
const tenant = await response.json();
```

#### Response

```json
{
  "data": {
    "id": "tenant_123",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+254712345678",
    "property_id": "prop_123",
    "unit_id": "unit_456",
    "created_at": "2026-06-03T10:00:00Z"
  }
}
```

### Get Tenant Details

Retrieve details for a specific tenant.

#### cURL

```bash
curl -X GET https://api.calqulusrms.com/v1/tenants/tenant_123 \
  -H "Authorization: Bearer YOUR_API_KEY"
```

#### JavaScript

```javascript
const response = await fetch('https://api.calqulusrms.com/v1/tenants/tenant_123', {
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY'
  }
});
const tenant = await response.json();
```

### Update Tenant

Update an existing tenant.

#### cURL

```bash
curl -X PUT https://api.calqulusrms.com/v1/tenants/tenant_123 \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@example.com",
    "phone": "+254712345679"
  }'
```

#### JavaScript

```javascript
const response = await fetch('https://api.calqulusrms.com/v1/tenants/tenant_123', {
  method: 'PUT',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: 'john.doe@example.com',
    phone: '+254712345679'
  })
});
const tenant = await response.json();
```

## Leases API

### List All Leases

Retrieve all leases for your account.

#### cURL

```bash
curl -X GET https://api.calqulusrms.com/v1/leases \
  -H "Authorization: Bearer YOUR_API_KEY"
```

#### JavaScript

```javascript
const response = await fetch('https://api.calqulusrms.com/v1/leases', {
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY'
  }
});
const leases = await response.json();
```

#### Response

```json
{
  "data": [
    {
      "id": "lease_123",
      "tenant_id": "tenant_123",
      "property_id": "prop_123",
      "unit_id": "unit_456",
      "start_date": "2026-01-01",
      "end_date": "2026-12-31",
      "rent_amount": 15000,
      "status": "active"
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "per_page": 20
  }
}
```

### Create Lease

Create a new lease.

#### cURL

```bash
curl -X POST https://api.calqulusrms.com/v1/leases \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "tenant_123",
    "property_id": "prop_123",
    "unit_id": "unit_456",
    "start_date": "2026-01-01",
    "end_date": "2026-12-31",
    "rent_amount": 15000
  }'
```

#### JavaScript

```javascript
const response = await fetch('https://api.calqulusrms.com/v1/leases', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    tenant_id: 'tenant_123',
    property_id: 'prop_123',
    unit_id: 'unit_456',
    start_date: '2026-01-01',
    end_date: '2026-12-31',
    rent_amount: 15000
  })
});
const lease = await response.json();
```

#### Response

```json
{
  "data": {
    "id": "lease_123",
    "tenant_id": "tenant_123",
    "property_id": "prop_123",
    "unit_id": "unit_456",
    "start_date": "2026-01-01",
    "end_date": "2026-12-31",
    "rent_amount": 15000,
    "status": "active",
    "created_at": "2026-06-03T10:00:00Z"
  }
}
```

### Get Lease Details

Retrieve details for a specific lease.

#### cURL

```bash
curl -X GET https://api.calqulusrms.com/v1/leases/lease_123 \
  -H "Authorization: Bearer YOUR_API_KEY"
```

#### JavaScript

```javascript
const response = await fetch('https://api.calqulusrms.com/v1/leases/lease_123', {
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY'
  }
});
const lease = await response.json();
```

## Payments API

### List All Payments

Retrieve all payments for your account.

#### cURL

```bash
curl -X GET https://api.calqulusrms.com/v1/payments \
  -H "Authorization: Bearer YOUR_API_KEY"
```

#### JavaScript

```javascript
const response = await fetch('https://api.calqulusrms.com/v1/payments', {
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY'
  }
});
const payments = await response.json();
```

#### Response

```json
{
  "data": [
    {
      "id": "pay_123",
      "tenant_id": "tenant_123",
      "lease_id": "lease_123",
      "amount": 15000,
      "currency": "KES",
      "payment_method": "mpesa",
      "status": "completed",
      "created_at": "2026-06-01T10:00:00Z"
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "per_page": 20
  }
}
```

### Create Payment

Create a new payment.

#### cURL

```bash
curl -X POST https://api.calqulusrms.com/v1/payments \
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

#### JavaScript

```javascript
const response = await fetch('https://api.calqulusrms.com/v1/payments', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    tenant_id: 'tenant_123',
    amount: 15000,
    currency: 'KES',
    payment_method: 'mpesa',
    phone_number: '+254712345678'
  })
});
const payment = await response.json();
```

#### Response

```json
{
  "data": {
    "id": "pay_123",
    "tenant_id": "tenant_123",
    "amount": 15000,
    "currency": "KES",
    "payment_method": "mpesa",
    "status": "pending",
    "created_at": "2026-06-03T10:00:00Z"
  }
}
```

### Refund Payment

Refund a payment.

#### cURL

```bash
curl -X POST https://api.calqulusrms.com/v1/payments/pay_123/refund \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 15000,
    "reason": "Tenant request"
  }'
```

#### JavaScript

```javascript
const response = await fetch('https://api.calqulusrms.com/v1/payments/pay_123/refund', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    amount: 15000,
    reason: 'Tenant request'
  })
});
const refund = await response.json();
```

## Maintenance API

### List All Maintenance Requests

Retrieve all maintenance requests.

#### cURL

```bash
curl -X GET https://api.calqulusrms.com/v1/maintenance \
  -H "Authorization: Bearer YOUR_API_KEY"
```

#### JavaScript

```javascript
const response = await fetch('https://api.calqulusrms.com/v1/maintenance', {
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY'
  }
});
const requests = await response.json();
```

#### Response

```json
{
  "data": [
    {
      "id": "maint_123",
      "property_id": "prop_123",
      "unit_id": "unit_456",
      "category": "plumbing",
      "description": "Leaking faucet",
      "priority": "medium",
      "status": "pending",
      "created_at": "2026-06-03T10:00:00Z"
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "per_page": 20
  }
}
```

### Create Maintenance Request

Create a new maintenance request.

#### cURL

```bash
curl -X POST https://api.calqulusrms.com/v1/maintenance \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "property_id": "prop_123",
    "unit_id": "unit_456",
    "category": "plumbing",
    "description": "Leaking faucet",
    "priority": "medium"
  }'
```

#### JavaScript

```javascript
const response = await fetch('https://api.calqulusrms.com/v1/maintenance', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    property_id: 'prop_123',
    unit_id: 'unit_456',
    category: 'plumbing',
    description: 'Leaking faucet',
    priority: 'medium'
  })
});
const request = await response.json();
```

#### Response

```json
{
  "data": {
    "id": "maint_123",
    "property_id": "prop_123",
    "unit_id": "unit_456",
    "category": "plumbing",
    "description": "Leaking faucet",
    "priority": "medium",
    "status": "pending",
    "created_at": "2026-06-03T10:00:00Z"
  }
}
```

## Webhooks

### Setting Up Webhooks

Webhooks allow you to receive real-time notifications when events occur in CALQULUS RMS.

### Register Webhook

Register a new webhook endpoint.

#### cURL

```bash
curl -X POST https://api.calqulusrms.com/v1/webhooks \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-server.com/webhook",
    "events": ["payment.completed", "tenant.created"],
    "secret": "your_webhook_secret"
  }'
```

#### JavaScript

```javascript
const response = await fetch('https://api.calqulusrms.com/v1/webhooks', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    url: 'https://your-server.com/webhook',
    events: ['payment.completed', 'tenant.created'],
    secret: 'your_webhook_secret'
  })
});
const webhook = await response.json();
```

#### Response

```json
{
  "data": {
    "id": "webhook_123",
    "url": "https://your-server.com/webhook",
    "events": ["payment.completed", "tenant.created"],
    "active": true,
    "created_at": "2026-06-03T10:00:00Z"
  }
}
```

### Handling Webhooks

Example webhook handler in Node.js:

```javascript
const express = require('express');
const crypto = require('crypto');
const app = express();

app.post('/webhook', express.raw({type: 'application/json'}), (req, res) => {
  const signature = req.headers['x-calqulusrms-signature'];
  const payload = req.body;
  
  // Verify signature
  const expectedSignature = crypto
    .createHmac('sha256', 'your_webhook_secret')
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
  }
  
  res.status(200).send('OK');
});

function handlePaymentCompleted(data) {
  console.log('Payment completed:', data.payment_id);
  // Your custom logic here
}

function handleTenantCreated(data) {
  console.log('Tenant created:', data.tenant_id);
  // Your custom logic here
}

app.listen(3000);
```

### Webhook Payload Structure

```json
{
  "id": "evt_123456789",
  "type": "payment.completed",
  "data": {
    "payment_id": "pay_123",
    "amount": 15000,
    "currency": "KES",
    "tenant_id": "tenant_123",
    "property_id": "prop_123",
    "timestamp": "2026-06-03T10:00:00Z"
  },
  "timestamp": "2026-06-03T10:00:00Z"
}
```

## Error Handling

### Error Response Format

All errors follow this format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field": "field_name",
      "issue": "Specific issue description"
    }
  }
}
```

### Common Error Codes

- `INVALID_REQUEST` - Invalid request parameters
- `UNAUTHORIZED` - Invalid or missing API key
- `FORBIDDEN` - Insufficient permissions
- `NOT_FOUND` - Resource not found
- `RATE_LIMIT_EXCEEDED` - API rate limit exceeded
- `SERVER_ERROR` - Internal server error

### Error Handling Example

#### JavaScript

```javascript
try {
  const response = await fetch('https://api.calqulusrms.com/v1/properties', {
    headers: {
      'Authorization': 'Bearer YOUR_API_KEY'
    }
  });
  
  if (!response.ok) {
    const error = await response.json();
    console.error('API Error:', error.error);
    throw new Error(error.error.message);
  }
  
  const data = await response.json();
  console.log('Success:', data);
} catch (error) {
  console.error('Request failed:', error);
}
```

#### Python

```python
import requests

try:
    response = requests.get('https://api.calqulusrms.com/v1/properties', headers={
        'Authorization': 'Bearer YOUR_API_KEY'
    })
    
    response.raise_for_status()
    
    data = response.json()
    print('Success:', data)
    
except requests.exceptions.HTTPError as error:
    print('HTTP Error:', error)
    if response.json():
        print('Error details:', response.json()['error'])
        
except requests.exceptions.RequestException as error:
    print('Request failed:', error)
```

## Rate Limiting

### Rate Limit Headers

CALQULUS RMS includes rate limit information in response headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1625097600
```

### Handling Rate Limits

#### JavaScript

```javascript
async function makeRequest(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      'Authorization': 'Bearer YOUR_API_KEY',
      ...options.headers
    },
    ...options
  });
  
  const remaining = response.headers.get('X-RateLimit-Remaining');
  const reset = response.headers.get('X-RateLimit-Reset');
  
  if (response.status === 429) {
    const resetTime = new Date(reset * 1000);
    const waitTime = resetTime - new Date();
    console.log(`Rate limited. Waiting ${waitTime}ms`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
    return makeRequest(url, options);
  }
  
  return response;
}
```

#### Python

```python
import requests
import time

def make_request(url, headers=None):
    response = requests.get(url, headers=headers)
    
    remaining = int(response.headers.get('X-RateLimit-Remaining', 0))
    reset = int(response.headers.get('X-RateLimit-Reset', 0))
    
    if response.status_code == 429:
        reset_time = reset - time.time()
        print(f"Rate limited. Waiting {reset_time} seconds")
        time.sleep(reset_time)
        return make_request(url, headers)
    
    return response
```

## Best Practices

### Security

1. **Never expose API keys** in client-side code
2. **Use environment variables** for API keys
3. **Rotate API keys** regularly
4. **Use HTTPS** for all API calls
5. **Validate webhook signatures**

### Performance

1. **Implement caching** for frequently accessed data
2. **Use pagination** for large datasets
3. **Batch requests** when possible
4. **Implement retry logic** with exponential backoff
5. **Monitor API usage** to avoid rate limits

### Reliability

1. **Handle errors gracefully**
2. **Log all API calls** for debugging
3. **Implement timeout handling**
4. **Use idempotent operations** where possible
5. **Test with sandbox environment** first

### Code Organization

1. **Create API client class** to encapsulate API logic
2. **Use constants** for API endpoints
3. **Implement type checking** for responses
4. **Write unit tests** for API interactions
5. **Document custom integrations**

### Example API Client Class

```javascript
class CALQULUSRMSAPI {
  constructor(apiKey, baseUrl = 'https://api.calqulusrms.com/v1') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }
  
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error.message);
    }
    
    return response.json();
  }
  
  async getProperties() {
    return this.request('/properties');
  }
  
  async createProperty(data) {
    return this.request('/properties', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
  
  async getTenants() {
    return this.request('/tenants');
  }
  
  async createTenant(data) {
    return this.request('/tenants', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
}

// Usage
const api = new CALQULUSRMSAPI('YOUR_API_KEY');
const properties = await api.getProperties();
```

## Additional Resources

- **API Documentation**: https://api.calqulusrms.com/docs
- **Integration Guides**: https://docs.calqulusrms.com/integration
- **SDK Downloads**: https://github.com/calqulusrms/sdk
- **Community Forum**: https://community.calqulusrms.com
- **Support Email**: api-support@calqulusrms.com

---

**Version**: 1.0  
**Last Updated**: June 2026  
**For questions or feedback, contact api-support@calqulusrms.com**
