# App Assets Specification for Store Deployment

## Overview
This document outlines all required app assets for iOS App Store and Google Play Store deployment.

## iOS App Store Assets

### App Icon
- **Required Size**: 1024x1024 pixels
- **Format**: PNG
- **Color Space**: sRGB
- **No Transparency**: Must be opaque
- **Path**: `assets/app-icons/ios-app-icon.png`
- **Design Guidelines**:
  - Clean, recognizable brand identity
  - Use CALQULUS PMS brand colors (navy: #0A1628, gold accent: #C9A84C)
  - Simple icon representing property/home
  - No text, gradients, or complex patterns
  - Rounded corners will be applied by Apple

### Screenshots
- **Required Devices**: iPhone 6.7", iPhone 6.5", iPhone 5.5"
- **Format**: PNG or JPEG
- **Resolution**:
  - 6.7" Display: 1290x2796 pixels
  - 6.5" Display: 1242x2688 pixels
  - 5.5" Display: 1242x2208 pixels
- **Minimum**: 3 screenshots per device
- **Maximum**: 10 screenshots per device
- **Path**: `assets/screenshots/ios/`

#### Screenshot List
1. **Dashboard** - Main dashboard showing property overview
   - Shows: Property cards, stats, navigation
   - Caption: "Manage all your properties from one dashboard"

2. **Properties** - Property management interface
   - Shows: Property list, property details, unit management
   - Caption: "Easily manage multiple properties and units"

3. **Payments** - Payment and billing interface
   - Shows: Payment history, invoice list, payment methods
   - Caption: "Track payments and send automated reminders"

4. **Maintenance** - Maintenance request management
   - Shows: Request list, request details, status tracking
   - Caption: "Handle maintenance requests efficiently"

5. **Reports** - Financial reports and analytics
   - Shows: Revenue charts, occupancy stats, financial summaries
   - Caption: "Generate comprehensive financial reports"

6. **Settings** - App settings and profile
   - Shows: Profile settings, notifications, preferences
   - Caption: "Customize your app experience"

### App Preview Videos (Optional but Recommended)
- **Format**: MOV or MP4
- **Duration**: 15-30 seconds
- **Resolution**: Same as screenshots
- **Content**: Demonstrate key features
- **Path**: `assets/previews/ios/`

## Google Play Store Assets

### App Icon
- **Required Size**: 512x512 pixels
- **Format**: PNG
- **Color Space**: sRGB
- **No Transparency**: Must be opaque
- **Path**: `assets/app-icons/google-play-icon.png`
- **Design Guidelines**:
  - Same design as iOS icon
  - Clean, simple, recognizable
  - Use brand colors
  - No text or complex patterns

### Feature Graphic
- **Required Size**: 1024x500 pixels
- **Format**: PNG or JPG
- **Purpose**: Featured in Google Play Store listing
- **Path**: `assets/screenshots/google-play/feature-graphic.png`
- **Design Guidelines**:
  - Showcase app's main value proposition
  - Include app icon and tagline
  - Use brand colors
  - Clean, professional design
  - Suggested text: "CALQULUS PMS - Modern Property Management"

### Screenshots
- **Required Devices**: Phone and Tablet
- **Format**: PNG or JPG
- **Resolution**:
  - Phone: 1080x1920 pixels (minimum 320px width)
  - Tablet: 1920x1200 pixels (minimum 800px width)
- **Minimum**: 2 screenshots
- **Maximum**: 8 screenshots
- **Path**: `assets/screenshots/google-play/`

#### Phone Screenshots (6 required)
1. **phone-1.png** - Dashboard overview
   - Caption: "Property management dashboard"

2. **phone-2.png** - Property management
   - Caption: "Manage properties and units"

3. **phone-3.png** - Payment processing
   - Caption: "Secure payments via M-Pesa"

4. **phone-4.png** - Maintenance requests
   - Caption: "Track maintenance requests"

5. **phone-5.png** - Financial reports
   - Caption: "Financial reporting and analytics"

6. **phone-6.png** - Settings and profile
   - Caption: "Customize your experience"

#### Tablet Screenshots (2 required)
1. **tablet-1.png** - Dashboard on tablet
   - Caption: "Optimized for tablets"

2. **tablet-2.png** - Properties on tablet
   - Caption: "Manage properties on larger screens"

### Promotional Graphics (Optional)
- **Format**: PNG or JPG
- **Sizes**: Various (180x120, 320x180, 1024x500)
- **Purpose**: Used in Google Play promotional materials
- **Path**: `assets/promotional/google-play/`

## Brand Guidelines

### Color Palette
- **Primary**: #0A1628 (Navy)
- **Secondary**: #C9A84C (Gold)
- **Accent**: #10b981 (Green)
- **Background**: #ffffff (White)
- **Text**: #1e293b (Dark Gray)

### Typography
- **Font Family**: Inter or similar sans-serif
- **Headings**: Bold, 600-700 weight
- **Body**: Regular, 400 weight
- **UI Elements**: Medium, 500 weight

### Icon Style
- **Style**: Outline or filled, consistent throughout
- **Stroke Width**: 2px
- **Corner Radius**: 4-8px
- **Color**: Primary brand color

## Asset Creation Checklist

### iOS App Store
- [ ] App icon 1024x1024
- [ ] Screenshots for iPhone 6.7" (3-10)
- [ ] Screenshots for iPhone 6.5" (3-10)
- [ ] Screenshots for iPhone 5.5" (3-10)
- [ ] App preview videos (optional)

### Google Play Store
- [ ] App icon 512x512
- [ ] Feature graphic 1024x500
- [ ] Phone screenshots (2-8)
- [ ] Tablet screenshots (2-8)
- [ ] Promotional graphics (optional)

## Asset Naming Convention

### iOS
```
ios-app-icon.png
screenshots/ios/iphone-67-1.png
screenshots/ios/iphone-67-2.png
...
screenshots/ios/iphone-65-1.png
...
screenshots/ios/iphone-55-1.png
...
previews/ios/preview-1.mov
```

### Google Play
```
google-play-icon.png
screenshots/google-play/feature-graphic.png
screenshots/google-play/phone-1.png
...
screenshots/google-play/tablet-1.png
...
promotional/google-play/promo-180x120.png
promotional/google-play/promo-320x180.png
```

## Screenshot Content Guidelines

### What to Include
- Actual app UI (no mockups or wireframes)
- Real data (or realistic placeholder data)
- Clear, readable text
- Appropriate device frame (optional)
- Consistent styling across all screenshots

### What to Avoid
- Blurry or low-quality images
- Watermarks or overlays
- Competitor branding
- Outdated UI elements
- Text that's too small to read
- Inconsistent branding

## Localization

### Supported Languages
- English (en-US) - Primary
- Consider adding:
  - Swahili (sw-KE) for Kenya market
  - Other regional languages as needed

### Localized Assets
- Screenshots with localized UI
- Localized descriptions in store listings
- Localized keywords for ASO

## Asset Quality Standards

### Resolution
- All assets must be at minimum required resolution
- Prefer higher resolution for future-proofing
- Maintain aspect ratio

### File Size
- iOS screenshots: < 5MB each
- Google Play screenshots: < 10MB each
- Icons: < 1MB

### Compression
- Use lossless compression for icons
- Use appropriate compression for screenshots
- Balance quality and file size

## Delivery Format

### Folder Structure
```
deployment/
├── assets/
│   ├── app-icons/
│   │   ├── ios-app-icon.png
│   │   └── google-play-icon.png
│   ├── screenshots/
│   │   ├── ios/
│   │   │   ├── iphone-67-1.png
│   │   │   ├── iphone-67-2.png
│   │   │   └── ...
│   │   └── google-play/
│   │       ├── feature-graphic.png
│   │       ├── phone-1.png
│   │       ├── phone-2.png
│   │       └── ...
│   └── previews/
│       └── ios/
│           └── preview-1.mov
├── ios-app-store-config.json
└── google-play-store-config.json
```

## Validation

### Pre-Submission Checklist
- [ ] All assets meet size requirements
- [ ] All assets are in correct format
- [ ] All assets follow naming convention
- [ ] Screenshots show current app version
- [ ] No placeholder or test data visible
- [ ] Branding is consistent
- [ ] Text is readable
- [ ] Assets are properly organized

### Tools for Validation
- iOS App Store Connect asset validator
- Google Play Console asset validator
- Image quality check tools
- File size verification

## Notes

### Asset Updates
- Update assets with each major app version
- Maintain consistency across updates
- Document changes in release notes

### Seasonal Assets
- Consider seasonal promotional graphics
- Holiday-themed screenshots (optional)
- Limited-time feature highlights

### A/B Testing
- Test different screenshot sets
- Monitor conversion rates
- Optimize based on performance data

## Support

For questions about asset requirements:
- iOS: https://developer.apple.com/app-store/
- Google Play: https://support.google.com/googleplay/android-developer/
