# Webhost User Manual

## Table of Contents
1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Dashboard Overview](#dashboard-overview)
4. [Manager Management](#manager-management)
5. [Properties Overview](#properties-overview)
6. [Billing and Subscriptions](#billing-and-subscriptions)
7. [Platform Oversight](#platform-oversight)
8. [Compliance and Security](#compliance-and-security)
9. [Platform Administration](#platform-administration)
10. [Settings](#settings)
11. [Troubleshooting](#troubleshooting)

## Introduction

CALQULUS RMS Webhost Dashboard is the platform administration interface for managing the CALQULUS RMS SaaS platform. As a Webhost, you oversee the entire platform, manage managers, handle subscriptions, and ensure platform compliance and security.

### Key Features
- Manager account management
- Subscription and billing management
- Platform oversight and analytics
- Compliance monitoring (SOC2, ISO 27001)
- Security administration
- Platform configuration
- System monitoring
- Unlinked landlord management

### Access Your Dashboard
- **URL**: https://www.calqulus.site/webhost/login
- **Role**: Platform Administrator

### Important Security Notice
As a Webhost, you have elevated platform access. You can view system-level data but **cannot access tenant data**. Tenant data is strictly protected and only accessible to their respective managers.

## Getting Started

### Account Setup

1. **Login to Webhost Dashboard**
   - Navigate to https://www.calqulus.site/webhost/login
   - Enter your email and password
   - Complete two-factor authentication
   - Click "Sign In"

2. **Initial Configuration**
   - Review platform settings
   - Configure billing tiers
   - Set up security policies
   - Review compliance requirements

### Navigation

The Webhost Dashboard is organized into the following sections:

- **Overview** - Platform-wide metrics and quick actions
- **Managers** - Manage manager accounts and subscriptions
- **Properties** - Platform-wide property overview
- **Billing** - Subscription management and revenue
- **Tiers** - Subscription tier configuration
- **Contracts** - Manager contract management
- **Security** - Platform security administration
- **Oversight** - Platform oversight and analytics
- **Platform Admins** - Platform administrator management
- **Error Logs** - System error monitoring
- **Settings** - Platform configuration

## Dashboard Overview

### Platform Metrics
- **Total Managers** - Number of active manager accounts
- **Total Properties** - Total properties across all managers
- **Total Units** - Total units across all properties
- **Active Tenants** - Total active tenants platform-wide
- **Monthly Revenue** - Total platform revenue this month
- **Platform Uptime** - Current platform uptime percentage

### Quick Actions
- **Add Manager** - Create new manager account
- **View Billing** - Access billing overview
- **Security Audit** - Run security audit
- **Compliance Check** - View compliance status
- **System Status** - Check system health

### Platform Health
- System status indicators
- Service availability
- Performance metrics
- Error rates
- API response times

### Recent Activity
- New manager signups
- Subscription changes
- Security events
- System alerts
- Compliance updates

## Manager Management

### Adding a Manager

1. Navigate to **Managers** → **Add Manager**
2. Enter manager details:
   - Company name
   - Contact name
   - Email address
   - Phone number
   - Business address
3. Select subscription tier
4. Set initial properties limit
5. Configure billing preferences
6. Click **Create Manager Account**
7. Manager receives onboarding email

### Viewing Manager Accounts

1. Navigate to **Managers**
2. View all managers with:
   - Company name
   - Contact information
   - Subscription tier
   - Properties count
   - Units count
   - Revenue contribution
   - Account status
   - Subscription status

### Manager Account Details

For each manager, view:
- **Account Information**
  - Company details
  - Contact information
  - Account creation date
  - Last login date

- **Subscription Details**
  - Current tier
  - Billing cycle
  - Next billing date
  - Payment method
  - Subscription status

- **Usage Statistics**
  - Properties count
  - Units count
  - Active tenants
  - Monthly revenue
  - Platform usage

### Managing Manager Subscriptions

1. Navigate to **Managers** → Select manager
2. Click **Manage Subscription**
3. Update subscription:
   - Change tier
   - Adjust properties limit
   - Update billing cycle
   - Modify pricing
4. Click **Save Changes**

### Suspending Manager Accounts

1. Navigate to **Managers** → Select manager
2. Click **Suspend Account**
3. Select suspension reason:
   - Non-payment
   - Policy violation
   - Security concern
   - Other
4. Add notes
5. Click **Suspend**
6. Manager receives suspension notification

### Terminating Manager Accounts

1. Navigate to **Managers** → Select manager
2. Click **Terminate Account**
3. Review termination checklist:
   - Data export
   - Billing finalization
   - Tenant notifications
   - Property handover
4. Confirm termination
5. Account is terminated after 30-day notice period

## Properties Overview

### Platform-Wide Property View

1. Navigate to **Properties**
2. View platform-wide statistics:
   - Total properties
   - Total units
   - Total occupancy rate
   - Properties by region
   - Properties by type

### Property Analytics

View platform-wide property analytics:
- Property growth trends
- Occupancy trends
- Regional distribution
- Property type distribution
- Manager distribution

### Unlinked Landlords

View system landlords (not linked to any manager):
1. Navigate to **Properties** → **Unlinked Landlords**
2. View landlords with `manager_id IS NULL`
3. These are visible only to webhosts
4. Can be linked to managers or managed directly

## Billing and Subscriptions

### Subscription Tiers

CALQULUS RMS offers three subscription tiers:

#### Lite Tier
- **Properties**: Up to 10
- **Units**: Up to 50
- **Price**: KES 40/unit/month
- **Features**: Basic property management

#### Pro Tier
- **Properties**: Up to 50
- **Units**: Up to 500
- **Price**: KES 30/unit/month
- **Features**: Advanced features, analytics

#### Enterprise Tier
- **Properties**: Unlimited
- **Units**: Unlimited
- **Price**: KES 20/unit/month
- **Features**: Full platform access, dedicated support

### Managing Subscription Tiers

1. Navigate to **Tiers**
2. View all tiers with:
   - Tier name
   - Properties limit
   - Units limit
   - Price per unit
   - Features list
   - Active managers count

3. Click **Edit Tier** to modify:
   - Pricing
   - Limits
   - Features
   - Add-ons

### Billing Overview

1. Navigate to **Billing**
2. View platform billing:
   - Total monthly revenue
   - Revenue by tier
   - Revenue by manager
   - Payment status
   - Churn rate

### Customer Billing Blocks

1. Navigate to **Billing** → **Billing Blocks**
2. Create custom pricing blocks:
   - Per-unit pricing overrides
   - Registration fee waivers
   - Percentage discounts
   - Flat discounts
   - Custom negotiated rates

### Invoice Management

1. Navigate to **Billing** → **Invoices**
2. View all invoices:
   - Invoice number
   - Manager
   - Amount
   - Due date
   - Payment status
3. Send invoice reminders
4. View payment history

### Revenue Analytics

View revenue analytics:
- Revenue trends over time
- Revenue by tier
- Revenue by region
- Revenue growth rate
- Revenue forecasting

## Platform Oversight

### Platform Analytics

1. Navigate to **Oversight**
2. View platform-wide analytics:
   - Manager performance
   - Property performance
   - Regional performance
   - Growth metrics
   - Usage patterns

### Manager Performance

View manager-level statistics:
- Properties managed
- Units managed
- Active tenants
- Revenue contribution
- Growth rate
- Platform usage

### Regional Analytics

View regional breakdown:
- Managers by region
- Properties by region
- Revenue by region
- Growth by region

### Platform Health Monitoring

Monitor platform health:
- System uptime
- API performance
- Error rates
- Response times
- Resource utilization

## Compliance and Security

### SOC2 Compliance

1. Navigate to **Security** → **SOC2 Compliance**
2. View compliance status:
   - Overall compliance score
   - Control implementation status
   - Evidence collection
   - Audit trail
   - Incident management

### ISO 27001 Compliance

1. Navigate to **Security** → **ISO 27001**
2. View compliance status:
   - ISMS implementation
   - Risk assessment
   - Asset management
   - Control implementation
   - Audit reports

### Data Retention

1. Navigate to **Security** → **Data Retention**
2. View retention policies:
   - Data categories
   - Retention periods
   - Disposal methods
   - Legal holds
   - Compliance status

### Privacy Compliance

1. Navigate to **Security** → **Privacy**
2. View privacy compliance:
   - Consent management
   - Data subject requests
   - Privacy policies
   - Data breach notifications
   - Regulatory compliance

### Security Administration

1. Navigate to **Security** → **Administration**
2. Manage security:
   - Access controls
   - Authentication policies
   - Encryption settings
   - Security monitoring
   - Incident response

### Penetration Testing

1. Navigate to **Security** → **Penetration Testing**
2. View security testing:
   - Test schedules
   - Vulnerability findings
   - Remediation status
   - Security posture
   - Test reports

## Platform Administration

### Platform Admins

CALQULUS RMS has three tiers of platform administrators:

#### Owner (Super Webhost)
- **Is Immutable**: Cannot be suspended or deleted
- **Full Access**: All platform features
- **Can Create**: Business and Admin accounts
- **Can Suspend**: Business and Admin accounts

#### Business Admin
- **Full Access**: Most platform features
- **Can Create**: Admin accounts
- **Can Be Suspended**: By Owner only

#### Admin
- **Limited Access**: Basic platform features
- **Cannot Create**: Other admin accounts
- **Can Be Suspended**: By Owner or Business

### Managing Platform Admins

1. Navigate to **Platform Admins**
2. View all platform admins:
   - Name
   - Email
   - Role tier
   - Status
   - Creation date
3. Add new admins (if authorized)
4. Suspend admins (if authorized)
5. View admin activity

### Error Logs

1. Navigate to **Error Logs**
2. View system errors:
   - Error timestamp
   - Error type
   - Error message
   - Stack trace
   - Affected user
   - Resolution status

### System Configuration

1. Navigate to **Settings** → **System**
2. Configure platform settings:
   - Platform name
   - Support email
   - Emergency contacts
   - System limits
   - Feature flags

## Settings

### Platform Settings

1. Navigate to **Settings** → **Platform**
2. Configure:
   - Platform branding
   - Default settings
   - Feature availability
   - System limits

### Billing Settings

1. Navigate to **Settings** → **Billing**
2. Configure:
   - Payment gateways
   - Invoice settings
   - Tax configuration
   - Currency settings
   - Billing cycles

### Security Settings

1. Navigate to **Settings** → **Security**
2. Configure:
   - Password policies
   - Two-factor authentication
   - Session settings
   - IP restrictions
   - Audit logging

### Notification Settings

1. Navigate to **Settings** → **Notifications**
2. Configure:
   - Email notifications
   - SMS notifications
   - System alerts
   - Compliance alerts
   - Security alerts

### API Settings

1. Navigate to **Settings** → **API**
2. Configure:
   - API keys
   - Rate limiting
   - Webhook settings
   - API documentation
   - Developer portal

## Troubleshooting

### Common Issues

#### Manager Account Issues
- **Problem**: Cannot create manager account
- **Solution**:
  - Verify all required fields are filled
  - Check email format is valid
  - Verify subscription tier is selected
  - Check system limits
  - Contact technical support

#### Billing Issues
- **Problem**: Manager not receiving invoices
- **Solution**:
  - Verify manager email is correct
  - Check invoice generation settings
  - Verify payment gateway is active
  - Check email delivery logs
  - Contact payment processor if needed

#### Compliance Issues
- **Problem**: Compliance score decreased
- **Solution**:
  - Review compliance report
  - Identify failing controls
  - Implement required changes
  - Collect evidence
  - Re-run compliance check

#### System Performance Issues
- **Problem**: Platform slow or unresponsive
- **Solution**:
  - Check system status dashboard
  - Review error logs
  - Check resource utilization
  - Review recent deployments
  - Contact technical support

### Getting Help

If you encounter issues not covered in this manual:
- **Technical Support**: tech-support@calqulusrms.com
- **Security Team**: security@calqulusrms.com
- **Compliance Team**: compliance@calqulusrms.com

### Emergency Contacts

- **Platform Emergency**: [Emergency phone number]
- **Security Emergency**: security@calqulusrms.com
- **Critical Issues**: Available 24/7

## Best Practices

### Manager Management
- Review manager performance regularly
- Monitor subscription usage
- Proactively address payment issues
- Provide excellent support
- Track manager satisfaction

### Platform Security
- Regularly review security logs
- Monitor compliance status
- Keep software updated
- Conduct regular security audits
- Respond to security incidents promptly

### Platform Health
- Monitor system uptime
- Track performance metrics
- Review error rates
- Plan capacity upgrades
- Maintain backup systems

### Compliance Management
- Maintain compliance documentation
- Regular compliance reviews
- Stay updated on regulations
- Conduct regular audits
- Maintain evidence collection

## Security Best Practices

- Use strong, unique passwords
- Enable two-factor authentication
- Regularly rotate credentials
- Never share login credentials
- Use secure connections only
- Report security incidents immediately
- Follow principle of least privilege
- Regular security training

## Compliance Requirements

As a Webhost, you must ensure:
- SOC2 Type II compliance
- ISO 27001 certification
- GDPR compliance (for EU data)
- Data protection compliance
- Regular security audits
- Privacy policy maintenance
- Data retention policy adherence
- Incident response procedures

## System Updates

CALQULUS RMS is regularly updated with:
- Security patches
- Feature enhancements
- Performance improvements
- Compliance updates
- Bug fixes

Check dashboard for:
- Update notifications
- Maintenance windows
- Feature announcements
- Security advisories

## Appendix

### Glossary

- **Manager**: Property management company using CALQULUS RMS
- **Subscription Tier**: Pricing plan for managers
- **Platform Oversight**: Monitoring of platform-wide metrics
- **Compliance**: Adherence to security and privacy standards
- **SOC2**: Service Organization Control 2 compliance framework
- **ISO 27001**: Information Security Management System standard

### Keyboard Shortcuts

- **Ctrl/Cmd + K**: Quick search
- **Ctrl/Cmd + N**: New manager
- **Ctrl/Cmd + B**: Billing overview
- **Ctrl/Cmd + S**: System status
- **Esc**: Close modal

### Support Resources

- **Documentation**: https://docs.calqulusrms.com
- **API Documentation**: https://api.calqulusrms.com/docs
- **Security Center**: https://security.calqulusrms.com
- **Compliance Portal**: https://compliance.calqulusrms.com

---

**Version**: 1.0  
**Last Updated**: June 2026  
**For questions or feedback, contact support@calqulusrms.com**
