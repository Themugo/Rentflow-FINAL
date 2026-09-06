# Troubleshooting Guide

## Table of Contents
1. [Introduction](#introduction)
2. [Authentication Issues](#authentication-issues)
3. [Payment Processing Issues](#payment-processing-issues)
4. [Data Synchronization Issues](#data-synchronization-issues)
5. [Performance Issues](#performance-issues)
6. [Integration Issues](#integration-issues)
7. [Mobile App Issues](#mobile-app-issues)
8. [Notification Issues](#notification-issues)
9. [Reporting Issues](#reporting-issues)
10. [Security Issues](#security-issues)
11. [System Maintenance](#system-maintenance)
12. [Contacting Support](#contacting-support)

## Introduction

This troubleshooting guide covers common issues you may encounter while using CALQULUS RMS and provides step-by-step solutions to resolve them.

### Before Troubleshooting

Before attempting to resolve an issue:
1. Check if the issue is affecting other users
2. Verify your internet connection is stable
3. Clear your browser cache and cookies
4. Try using a different browser
5. Check the CALQULUS RMS status page for known issues

### Reporting Issues

When reporting an issue, include:
- Your role (Manager, Landlord, Tenant, Webhost, Agency)
- Steps to reproduce the issue
- Expected behavior vs actual behavior
- Screenshots or error messages
- Browser and device information
- Time the issue occurred

## Authentication Issues

### Cannot Login to Dashboard

#### Problem
Unable to login to CALQULUS RMS dashboard with correct credentials.

#### Possible Causes
- Incorrect email or password
- Account locked due to multiple failed attempts
- Account suspended by administrator
- Browser cache issues
- Network connectivity problems

#### Solutions

**Solution 1: Verify Credentials**
1. Double-check email address for typos
2. Ensure caps lock is not enabled
3. Reset password if unsure:
   - Click "Forgot Password"
   - Enter email address
   - Check email for reset link
   - Create new password

**Solution 2: Clear Browser Cache**
1. Open browser settings
2. Clear browsing data
3. Select "Cookies and other site data"
4. Select "Cached images and files"
5. Click "Clear data"
6. Try logging in again

**Solution 3: Try Different Browser**
1. Try logging in with Chrome, Firefox, Safari, or Edge
2. If successful, the issue is browser-specific
3. Update your browser to latest version

**Solution 4: Check Account Status**
1. Contact your administrator if account is locked
2. Verify account is not suspended
3. Check if account requires approval

**Solution 5: Check Network Connection**
1. Verify internet connection is working
2. Try accessing other websites
3. Restart your router if needed
4. Try using mobile data as alternative

### Two-Factor Authentication Issues

#### Problem
Unable to complete two-factor authentication (2FA).

#### Possible Causes
- Authenticator app not synchronized
- SMS not received
- Time synchronization issues
- Backup codes lost

#### Solutions

**Solution 1: Resync Authenticator App**
1. Open authenticator app
2. Remove CALQULUS RMS account
3. Add CALQULUS RMS account again
4. Scan QR code or enter secret key
5. Try authentication again

**Solution 2: Request New SMS Code**
1. Click "Resend Code" on login screen
2. Wait for SMS to arrive
3. Enter code within 5 minutes
4. If still not received, check phone signal

**Solution 3: Use Backup Code**
1. Use one of your backup codes
2. Each code can only be used once
3. Generate new backup codes after using

**Solution 4: Check Device Time**
1. Ensure device time is correct
2. Enable automatic time synchronization
3. Try authentication again

**Solution 5: Contact Support**
If all else fails, contact support to disable 2FA temporarily

## Payment Processing Issues

### M-Pesa Payment Not Processing

#### Problem
M-Pesa STK Push not received or payment not completing.

#### Possible Causes
- Incorrect phone number format
- M-Pesa service downtime
- Insufficient funds
- Network connectivity issues
- API configuration errors

#### Solutions

**Solution 1: Verify Phone Number**
1. Ensure phone number format: +2547XXXXXXXX
2. Remove leading zeros
3. Include country code
4. Verify tenant phone number is correct

**Solution 2: Check M-Pesa Service Status**
1. Check Safaricom service status
2. Verify M-Pesa is operational
3. Wait for service restoration if down

**Solution 3: Verify Sufficient Funds**
1. Ensure tenant has sufficient M-Pesa balance
2. Check account limits
3. Verify transaction amount is within limits

**Solution 4: Check API Configuration**
1. Navigate to Settings → Payment Methods → M-Pesa
2. Verify Consumer Key and Secret are correct
3. Verify Business Shortcode is correct
4. Verify Passkey is correct
5. Test connection

**Solution 5: Check Network Coverage**
1. Ensure tenant phone has network coverage
2. Verify Safaricom network is available
3. Try again when coverage improves

### Bank Transfer Not Recognized

#### Problem
Bank transfer made but not recognized by CALQULUS RMS.

#### Possible Causes
- Incorrect reference number
- Payment not yet processed by bank
- Reference number format mismatch
- Automatic matching not configured

#### Solutions

**Solution 1: Verify Reference Number**
1. Check tenant used correct reference format
2. Verify reference matches tenant's assigned format
3. Reference should be: RENT-[TENANT_ID]-[DATE]

**Solution 2: Wait for Bank Processing**
1. Bank transfers take 1-3 business days
2. Check if payment has cleared
3. Wait for processing to complete

**Solution 3: Manually Match Payment**
1. Navigate to Billing → Payment History
2. Click Unmatched Payments
3. Find the payment
4. Click Match
5. Select correct tenant
6. Confirm match

### Stripe Payment Declined

#### Problem
Stripe card payment declined.

#### Possible Causes
- Insufficient funds
- Card expired
- Incorrect card details
- 3D Secure authentication failed
- Card blocked by bank

#### Solutions

**Solution 1: Check Card Details**
1. Verify card number is correct
2. Verify expiry date is valid
3. Verify CVV is correct
4. Verify cardholder name matches

**Solution 2: Check Sufficient Funds**
1. Ensure card has sufficient funds
2. Check credit limit
3. Verify daily spending limit

**Solution 3: Complete 3D Secure**
1. Complete 3D Secure authentication when prompted
2. Enter OTP sent by bank
3. Complete authentication within time limit

**Solution 4: Try Different Card**
1. Use a different card
2. Ensure card is enabled for online transactions
3. Verify card is not blocked

## Data Synchronization Issues

### Data Not Syncing Between Devices

#### Problem
Changes made on one device not appearing on other devices.

#### Possible Causes
- Offline mode active
- Sync not triggered
- Network connectivity issues
- Cache issues
- Sync conflicts

#### Solutions

**Solution 1: Check Internet Connection**
1. Verify device has internet connection
2. Test connection by loading other websites
3. Restart router if needed

**Solution 2: Trigger Manual Sync**
1. Navigate to Settings → Sync
2. Click Sync Now
3. Wait for sync to complete
4. Refresh page

**Solution 3: Clear Cache**
1. Clear browser cache
2. Clear app cache (mobile)
3. Restart application
4. Try sync again

**Solution 4: Check Offline Mode**
1. Verify offline mode is not enabled
2. Disable offline mode if enabled
3. Connect to internet
4. Trigger sync

## Performance Issues

### Slow Page Load Times

#### Problem
Pages loading slowly or taking long to respond.

#### Possible Causes
- Slow internet connection
- Server load
- Large data sets
- Browser issues
- Cache issues

#### Solutions

**Solution 1: Check Internet Speed**
1. Test internet speed
2. Use speedtest.net or similar
3. Upgrade internet plan if needed
4. Use wired connection

**Solution 2: Check Server Status**
1. Check CALQULUS RMS status page
2. Verify no server issues
3. Check for scheduled maintenance

**Solution 3: Reduce Data Load**
1. Use filters to reduce data displayed
2. Limit date ranges in reports
3. Use pagination
4. Export large datasets instead of viewing in browser

**Solution 4: Clear Cache**
1. Clear browser cache
2. Clear application cache
3. Restart browser
4. Try again

### Application Freezing or Crashing

#### Problem
Application freezes or crashes frequently.

#### Possible Causes
- Memory issues
- Browser compatibility
- Corrupted cache
- JavaScript errors
- Device limitations

#### Solutions

**Solution 1: Clear Cache and Cookies**
1. Clear browser cache
2. Clear cookies
3. Restart browser
4. Try again

**Solution 2: Try Different Browser**
1. Try Chrome, Firefox, Safari, or Edge
2. Update browser to latest version
3. Disable hardware acceleration

**Solution 3: Check Device Resources**
1. Close other applications
2. Check available memory
3. Restart device
4. Try again

## Integration Issues

### Webhook Not Receiving Events

#### Problem
Webhook endpoint not receiving events from CALQULUS RMS.

#### Possible Causes
- Webhook URL incorrect
- Webhook not active
- Network firewall blocking
- Signature verification failing
- Server downtime

#### Solutions

**Solution 1: Verify Webhook URL**
1. Navigate to Settings → API → Webhooks
2. Verify webhook URL is correct
3. Test URL accessibility
4. Update if incorrect

**Solution 2: Check Webhook Status**
1. Verify webhook is active
2. Check if webhook is paused
3. Enable webhook if disabled
4. Save changes

**Solution 3: Test Webhook Endpoint**
1. Use webhook testing tool (ngrok, localtunnel)
2. Send test webhook
3. Verify endpoint receives request
4. Check response is 200 OK

### API Authentication Failing

#### Problem
API requests returning 401 Unauthorized errors.

#### Possible Causes
- Invalid API key
- API key expired
- API key revoked
- Incorrect authentication header
- Rate limit exceeded

#### Solutions

**Solution 1: Verify API Key**
1. Navigate to Settings → API
2. Verify API key is correct
3. Regenerate API key if needed
4. Update application with new key

**Solution 2: Check API Key Status**
1. Verify API key is active
2. Check if key has expired
3. Verify key has not been revoked
4. Generate new key if needed

**Solution 3: Check Authentication Header**
1. Verify header format: Authorization: Bearer YOUR_API_KEY
2. Ensure no extra spaces
3. Check case sensitivity
4. Verify key is not truncated

**Solution 4: Check Rate Limits**
1. Check rate limit headers in response
2. Wait if limit exceeded
3. Implement retry logic with backoff
4. Request higher limit if needed

## Mobile App Issues

### App Not Installing

#### Problem
Unable to install CALQULUS RMS mobile app.

#### Possible Causes
- Device compatibility
- Insufficient storage
- App store issues
- Network issues
- OS version too old

#### Solutions

**Solution 1: Check Device Compatibility**
1. Verify device meets minimum requirements
2. Check OS version is supported
3. Update OS if needed
4. Try installing on compatible device

**Solution 2: Check Storage Space**
1. Verify sufficient storage available
2. Clear space if needed
3. Delete unused apps
4. Try installation again

**Solution 3: Restart Device**
1. Restart device
2. Clear app store cache
3. Try installation again

### App Not Syncing

#### Problem
Mobile app not syncing with server.

#### Possible Causes
- No internet connection
- Sync disabled
- Server issues
- App cache issues
- Authentication issues

#### Solutions

**Solution 1: Check Internet Connection**
1. Verify internet connection
2. Test connection with other apps
3. Switch between Wi-Fi and mobile data
4. Try again

**Solution 2: Enable Sync**
1. Open app settings
2. Enable sync
3. Set sync frequency
4. Trigger manual sync

**Solution 3: Clear App Cache**
1. Navigate to device settings
2. Find CALQULUS RMS app
3. Clear cache
4. Clear data if needed
5. Login again

### Push Notifications Not Working

#### Problem
Not receiving push notifications on mobile app.

#### Possible Causes
- Notifications disabled
- App permissions denied
- Do Not Disturb mode
- Battery optimization
- Server issues

#### Solutions

**Solution 1: Enable Notifications**
1. Open device settings
2. Find CALQULUS RMS app
3. Enable notifications
4. Allow all notification types

**Solution 2: Check Permissions**
1. Navigate to device settings
2. Find CALQULUS RMS app
3. Enable all permissions
4. Restart app

**Solution 3: Disable Do Not Disturb**
1. Check if Do Not Disturb is enabled
2. Disable if needed
3. Allow notifications from CALQULUS RMS

**Solution 4: Disable Battery Optimization**
1. Navigate to device settings
2. Find CALQULUS RMS app
3. Disable battery optimization
4. Allow background activity

## Notification Issues

### Not Receiving Email Notifications

#### Problem
Not receiving email notifications from CALQULUS RMS.

#### Possible Causes
- Email address incorrect
- Email in spam folder
- Email service down
- Notifications disabled
- Email quota exceeded

#### Solutions

**Solution 1: Check Email Address**
1. Navigate to Settings → Notifications
2. Verify email address is correct
3. Update if incorrect
4. Save changes

**Solution 2: Check Spam Folder**
1. Check spam/junk folder
2. Mark emails as not spam
3. Add noreply@calqulusrms.com to contacts
4. Check email filters

**Solution 3: Enable Notifications**
1. Navigate to Settings → Notifications
2. Enable email notifications
3. Select notification types
4. Save changes

**Solution 4: Check Email Service**
1. Check email service status
2. Verify email provider is operational
3. Wait for service restoration if down

### Not Receiving SMS Notifications

#### Problem
Not receiving SMS notifications from CALQULUS RMS.

#### Possible Causes
- Phone number incorrect
- SMS service down
- Notifications disabled
- SMS credits exhausted
- Network issues

#### Solutions

**Solution 1: Check Phone Number**
1. Navigate to Settings → Notifications
2. Verify phone number is correct
3. Update if incorrect
4. Save changes

**Solution 2: Enable SMS Notifications**
1. Navigate to Settings → Notifications
2. Enable SMS notifications
3. Select notification types
4. Save changes

**Solution 3: Check SMS Credits**
1. Navigate to Settings → Billing
2. Check SMS credit balance
3. Purchase more credits if needed
4. Verify auto-recharge is enabled

**Solution 4: Check SMS Service**
1. Check SMS gateway status
2. Verify service is operational
3. Wait for service restoration if down

## Reporting Issues

### Reports Not Generating

#### Problem
Unable to generate reports from CALQULUS RMS.

#### Possible Causes
- Invalid date range
- No data available
- Server load
- Browser issues
- Permission issues

#### Solutions

**Solution 1: Check Date Range**
1. Verify date range is valid
2. Ensure end date is after start date
3. Try smaller date range
4. Check for date format errors

**Solution 2: Check Data Availability**
1. Verify data exists for selected period
2. Check if properties/tenants are selected
3. Ensure you have access to data
4. Try different filters

**Solution 3: Check Permissions**
1. Verify you have report generation permissions
2. Contact administrator if needed
3. Check role-based access

**Solution 4: Try Different Browser**
1. Try Chrome, Firefox, Safari, or Edge
2. Update browser to latest version
3. Clear cache
4. Try again

### Report Data Incorrect

#### Problem
Report showing incorrect or incomplete data.

#### Possible Causes
- Data not synced
- Filters applied incorrectly
- Data entry errors
- Calculation errors
- Cache issues

#### Solutions

**Solution 1: Refresh Data**
1. Click refresh button
2. Trigger manual sync
3. Wait for sync to complete
4. Regenerate report

**Solution 2: Check Filters**
1. Review applied filters
2. Reset filters to default
3. Apply correct filters
4. Regenerate report

**Solution 3: Verify Data Entry**
1. Check source data for errors
2. Verify data was entered correctly
3. Correct any data entry errors
4. Regenerate report

**Solution 4: Clear Cache**
1. Clear browser cache
2. Clear application cache
3. Restart application
4. Regenerate report

## Security Issues

### Suspicious Account Activity

#### Problem
Noticed suspicious activity on your account.

#### Possible Causes
- Account compromised
- Unauthorized access
- Phishing attempt
- Shared credentials

#### Solutions

**Solution 1: Change Password Immediately**
1. Navigate to Settings → Security
2. Change password
3. Use strong, unique password
4. Enable two-factor authentication

**Solution 2: Review Login History**
1. Navigate to Settings → Security
2. Review login history
3. Identify suspicious logins
4. Report to support

**Solution 3: Revoke Sessions**
1. Navigate to Settings → Security
2. Revoke all active sessions
3. Login again from trusted device
4. Monitor account activity

**Solution 4: Contact Support**
1. Report suspicious activity immediately
2. Provide details of suspicious activity
3. Request account review
4. Follow security recommendations

### Data Privacy Concerns

#### Problem
Concerns about data privacy or unauthorized data access.

#### Possible Causes
- Data breach
- Unauthorized access
- Privacy settings misconfigured
- Data sharing concerns

#### Solutions

**Solution 1: Review Privacy Settings**
1. Navigate to Settings → Privacy
2. Review data sharing preferences
3. Update privacy settings
4. Save changes

**Solution 2: Review Data Access**
1. Review who has access to your data
2. Check third-party integrations
3. Revoke unnecessary access
4. Contact support for concerns

**Solution 3: Request Data Export**
1. Navigate to Settings → Privacy
2. Request data export
3. Review exported data
4. Report any discrepancies

**Solution 4: Contact Support**
1. Report privacy concerns
2. Request data access review
3. Request data deletion if needed
4. Follow privacy procedures

## System Maintenance

### Scheduled Maintenance

CALQULUS RMS performs regular maintenance to ensure system reliability and security.

#### Maintenance Windows
- **Weekly**: Sunday 2:00 AM - 4:00 AM EAT
- **Monthly**: First Sunday of month 12:00 AM - 6:00 AM EAT
- **Emergency**: As needed with advance notice

#### During Maintenance
- System may be unavailable
- Features may be limited
- Data sync may be delayed
- Reports may be delayed

#### Maintenance Notifications
- Email notifications 7 days in advance
- Dashboard notifications 24 hours in advance
- Status page updates during maintenance

### System Updates

CALQULUS RMS is regularly updated with:
- Security patches
- Feature enhancements
- Performance improvements
- Bug fixes

#### Update Notifications
- Email announcements for major updates
- Dashboard notifications for all updates
- Release notes available in documentation

#### Update Process
- Updates deployed during maintenance windows
- No action required from users
- Features may change slightly after updates
- Review release notes for changes

## Contacting Support

### When to Contact Support

Contact CALQULUS RMS support when:
- Issue not resolved by troubleshooting
- Error message not covered in documentation
- System-wide outage suspected
- Security concern
- Feature request
- Billing inquiry

### Support Channels

**Email Support**
- General: support@calqulusrms.com
- API Support: api-support@calqulusrms.com
- Security: security@calqulusrms.com
- Billing: billing@calqulusrms.com

**Phone Support**
- Business Hours: Monday - Friday, 8:00 AM - 6:00 PM EAT
- Emergency: Available 24/7 for critical issues
- Phone: [Support phone number]

**Live Chat**
- Available in dashboard
- Business hours only
- Response time: < 5 minutes

**Community Forum**
- URL: https://community.calqulusrms.com
- Peer support and discussions
- Feature requests and feedback
- Best practices and tips

### Information to Provide

When contacting support, provide:
- Your role and account email
- Description of the issue
- Steps to reproduce
- Error messages or screenshots
- Browser and device information
- Time the issue occurred
- Impact on your operations

### Support Response Times

- **Critical Issues**: < 1 hour
- **High Priority**: < 4 hours
- **Medium Priority**: < 24 hours
- **Low Priority**: < 48 hours

### Escalation Process

If issue not resolved within expected time:
1. Request escalation via support channel
2. Provide ticket number
3. Explain business impact
4. Escalate to manager if needed

## Best Practices

### Proactive Monitoring

- Monitor system status page regularly
- Set up alerts for critical issues
- Review error logs periodically
- Track performance metrics
- Stay informed about updates

### Regular Maintenance

- Keep browser updated
- Clear cache regularly
- Review security settings monthly
- Update contact information
- Review permissions quarterly

### Backup and Recovery

- Export important data regularly
- Keep offline copies of critical documents
- Document custom configurations
- Test recovery procedures
- Maintain backup contact information

### Security Hygiene

- Use strong, unique passwords
- Enable two-factor authentication
- Regularly update passwords
- Never share credentials
- Report suspicious activity immediately
- Keep software updated

## Appendix

### Glossary

- **API**: Application Programming Interface
- **STK Push**: M-Pesa payment prompt sent to phone
- **3D Secure**: Card authentication protocol
- **Webhook**: HTTP callback for real-time notifications
- **Cache**: Temporary storage for faster access
- **Sync**: Data synchronization between devices

### Error Codes

- **400**: Bad Request - Invalid parameters
- **401**: Unauthorized - Authentication failed
- **403**: Forbidden - Insufficient permissions
- **404**: Not Found - Resource not found
- **429**: Too Many Requests - Rate limit exceeded
- **500**: Server Error - Internal server error
- **503**: Service Unavailable - Service temporarily down

### Additional Resources

- **Documentation**: https://docs.calqulusrms.com
- **API Documentation**: https://api.calqulusrms.com/docs
- **Status Page**: https://status.calqulusrms.com
- **Community Forum**: https://community.calqulusrms.com
- **Video Tutorials**: https://youtube.com/calqulusrms

---

**Version**: 1.0  
**Last Updated**: June 2026  
**For questions or feedback, contact support@calqulusrms.com**
