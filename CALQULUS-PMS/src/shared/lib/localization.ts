/**
 * Localization Infrastructure
 *
 * Implements multi-language support with:
 * - Translation management
 * - RTL language support
 * - Date/time localization
 * - Number formatting
 * - Pluralization
 * - Message formatting
 */

// Supported locales
export const SUPPORTED_LOCALES = ['en', 'sw', 'ar', 'fr'] as const;
export type SupportedLocale = typeof SUPPORTED_LOCALES[number];

// RTL languages
export const RTL_LANGUAGES: SupportedLocale[] = ['ar'];

// Locale configuration
export const LOCALE_CONFIG: Record<SupportedLocale, {
  name: string;
  nativeName: string;
  direction: 'ltr' | 'rtl';
  dateFormat: string;
  currencyCode: string;
}> = {
  en: {
    name: 'English',
    nativeName: 'English',
    direction: 'ltr',
    dateFormat: 'MM/DD/YYYY',
    currencyCode: 'USD',
  },
  sw: {
    name: 'Swahili',
    nativeName: 'Kiswahili',
    direction: 'ltr',
    dateFormat: 'DD/MM/YYYY',
    currencyCode: 'KES',
  },
  ar: {
    name: 'Arabic',
    nativeName: 'العربية',
    direction: 'rtl',
    dateFormat: 'DD/MM/YYYY',
    currencyCode: 'AED',
  },
  fr: {
    name: 'French',
    nativeName: 'Français',
    direction: 'ltr',
    dateFormat: 'DD/MM/YYYY',
    currencyCode: 'EUR',
  },
};

// Translation keys type
export type TranslationKey = 
  // Common
  | 'common.save'
  | 'common.cancel'
  | 'common.delete'
  | 'common.edit'
  | 'common.search'
  | 'common.loading'
  | 'common.error'
  | 'common.success'
  | 'common.confirm'
  | 'common.close'
  // Navigation
  | 'nav.dashboard'
  | 'nav.properties'
  | 'nav.tenants'
  | 'nav.billing'
  | 'nav.reports'
  | 'nav.settings'
  // Authentication
  | 'auth.login'
  | 'auth.logout'
  | 'auth.signup'
  | 'auth.forgotPassword'
  | 'auth.resetPassword'
  // Payments
  | 'payment.makePayment'
  | 'payment.paymentHistory'
  | 'payment.amount'
  | 'payment.date'
  | 'payment.status'
  | 'payment.pending'
  | 'payment.completed'
  | 'payment.failed'
  // Properties
  | 'property.name'
  | 'property.address'
  | 'property.units'
  | 'property.occupancy'
  // Tenants
  | 'tenant.name'
  | 'tenant.email'
  | 'tenant.phone'
  | 'tenant.leaseStart'
  | 'tenant.leaseEnd'
  | 'tenant.balance';

// Translation messages
type Translations = Record<TranslationKey, string>;

// English translations (default)
const enTranslations: Translations = {
  // Common
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.delete': 'Delete',
  'common.edit': 'Edit',
  'common.search': 'Search',
  'common.loading': 'Loading...',
  'common.error': 'An error occurred',
  'common.success': 'Success',
  'common.confirm': 'Confirm',
  'common.close': 'Close',
  // Navigation
  'nav.dashboard': 'Dashboard',
  'nav.properties': 'Properties',
  'nav.tenants': 'Tenants',
  'nav.billing': 'Billing',
  'nav.reports': 'Reports',
  'nav.settings': 'Settings',
  // Authentication
  'auth.login': 'Log In',
  'auth.logout': 'Log Out',
  'auth.signup': 'Sign Up',
  'auth.forgotPassword': 'Forgot Password?',
  'auth.resetPassword': 'Reset Password',
  // Payments
  'payment.makePayment': 'Make Payment',
  'payment.paymentHistory': 'Payment History',
  'payment.amount': 'Amount',
  'payment.date': 'Date',
  'payment.status': 'Status',
  'payment.pending': 'Pending',
  'payment.completed': 'Completed',
  'payment.failed': 'Failed',
  // Properties
  'property.name': 'Property Name',
  'property.address': 'Address',
  'property.units': 'Units',
  'property.occupancy': 'Occupancy',
  // Tenants
  'tenant.name': 'Tenant Name',
  'tenant.email': 'Email',
  'tenant.phone': 'Phone',
  'tenant.leaseStart': 'Lease Start',
  'tenant.leaseEnd': 'Lease End',
  'tenant.balance': 'Balance',
};

// Swahili translations
const swTranslations: Translations = {
  // Common
  'common.save': 'Hifadhi',
  'common.cancel': 'Ghairi',
  'common.delete': 'Futa',
  'common.edit': 'Hariri',
  'common.search': 'Tafuta',
  'common.loading': 'Inapakia...',
  'common.error': 'Hitilafu imetokea',
  'common.success': 'Mafanikio',
  'common.confirm': 'Thibitisha',
  'common.close': 'Funga',
  // Navigation
  'nav.dashboard': 'Dashibodi',
  'nav.properties': 'Mali',
  'nav.tenants': 'Wapangaji',
  'nav.billing': 'Bilisi',
  'nav.reports': 'Ripoti',
  'nav.settings': 'Mipangilio',
  // Authentication
  'auth.login': 'Ingia',
  'auth.logout': 'Toka',
  'auth.signup': 'Jisajili',
  'auth.forgotPassword': 'Umesahau Nywila?',
  'auth.resetPassword': 'Weka Nywila Tena',
  // Payments
  'payment.makePayment': 'Fanya Malipo',
  'payment.paymentHistory': 'Historia ya Malipo',
  'payment.amount': 'Kiasi',
  'payment.date': 'Tarehe',
  'payment.status': 'Hali',
  'payment.pending': 'Inasubiri',
  'payment.completed': 'Imemalizika',
  'payment.failed': 'Imeshindwa',
  // Properties
  'property.name': 'Jina la Mali',
  'property.address': 'Anwani',
  'property.units': 'Vipande',
  'property.occupancy': 'Kupatikana',
  // Tenants
  'tenant.name': 'Jina la Mpangaji',
  'tenant.email': 'Barua Pepe',
  'tenant.phone': 'Simu',
  'tenant.leaseStart': 'Mwanzo wa Makubaliano',
  'tenant.leaseEnd': 'Mwisho wa Makubaliano',
  'tenant.balance': 'Salio',
};

// Arabic translations
const arTranslations: Translations = {
  // Common
  'common.save': 'حفظ',
  'common.cancel': 'إلغاء',
  'common.delete': 'حذف',
  'common.edit': 'تعديل',
  'common.search': 'بحث',
  'common.loading': 'جاري التحميل...',
  'common.error': 'حدث خطأ',
  'common.success': 'نجاح',
  'common.confirm': 'تأكيد',
  'common.close': 'إغلاق',
  // Navigation
  'nav.dashboard': 'لوحة التحكم',
  'nav.properties': 'العقارات',
  'nav.tenants': 'المستأجرين',
  'nav.billing': 'الفواتير',
  'nav.reports': 'التقارير',
  'nav.settings': 'الإعدادات',
  // Authentication
  'auth.login': 'تسجيل الدخول',
  'auth.logout': 'تسجيل الخروج',
  'auth.signup': 'التسجيل',
  'auth.forgotPassword': 'نسيت كلمة المرور؟',
  'auth.resetPassword': 'إعادة تعيين كلمة المرور',
  // Payments
  'payment.makePayment': 'إجراء الدفع',
  'payment.paymentHistory': 'سجل الدفع',
  'payment.amount': 'المبلغ',
  'payment.date': 'التاريخ',
  'payment.status': 'الحالة',
  'payment.pending': 'قيد الانتظار',
  'payment.completed': 'مكتمل',
  'payment.failed': 'فشل',
  // Properties
  'property.name': 'اسم العقار',
  'property.address': 'العنوان',
  'property.units': 'الوحدات',
  'property.occupancy': 'الإشغال',
  // Tenants
  'tenant.name': 'اسم المستأجر',
  'tenant.email': 'البريد الإلكتروني',
  'tenant.phone': 'الهاتف',
  'tenant.leaseStart': 'بداية الإيجار',
  'tenant.leaseEnd': 'نهاية الإيجار',
  'tenant.balance': 'الرصيد',
};

// French translations
const frTranslations: Translations = {
  // Common
  'common.save': 'Enregistrer',
  'common.cancel': 'Annuler',
  'common.delete': 'Supprimer',
  'common.edit': 'Modifier',
  'common.search': 'Rechercher',
  'common.loading': 'Chargement...',
  'common.error': 'Une erreur est survenue',
  'common.success': 'Succès',
  'common.confirm': 'Confirmer',
  'common.close': 'Fermer',
  // Navigation
  'nav.dashboard': 'Tableau de bord',
  'nav.properties': 'Propriétés',
  'nav.tenants': 'Locataires',
  'nav.billing': 'Facturation',
  'nav.reports': 'Rapports',
  'nav.settings': 'Paramètres',
  // Authentication
  'auth.login': 'Connexion',
  'auth.logout': 'Déconnexion',
  'auth.signup': "S'inscrire",
  'auth.forgotPassword': 'Mot de passe oublié ?',
  'auth.resetPassword': 'Réinitialiser le mot de passe',
  // Payments
  'payment.makePayment': 'Effectuer un paiement',
  'payment.paymentHistory': 'Historique des paiements',
  'payment.amount': 'Montant',
  'payment.date': 'Date',
  'payment.status': 'Statut',
  'payment.pending': 'En attente',
  'payment.completed': 'Complété',
  'payment.failed': 'Échoué',
  // Properties
  'property.name': 'Nom de la propriété',
  'property.address': 'Adresse',
  'property.units': 'Unités',
  'property.occupancy': 'Occupation',
  // Tenants
  'tenant.name': "Nom de l'occupant",
  'tenant.email': 'Email',
  'tenant.phone': 'Téléphone',
  'tenant.leaseStart': 'Début du bail',
  'tenant.leaseEnd': 'Fin du bail',
  'tenant.balance': 'Solde',
};

// All translations
const translations: Record<SupportedLocale, Translations> = {
  en: enTranslations,
  sw: swTranslations,
  ar: arTranslations,
  fr: frTranslations,
};

/**
 * Get translation for a key
 */
export function t(key: TranslationKey, locale: SupportedLocale = 'en'): string {
  return translations[locale]?.[key] || translations.en[key] || key;
}

/**
 * Get translation with interpolation
 */
export function tInterpolate(
  key: TranslationKey,
  params: Record<string, string | number>,
  locale: SupportedLocale = 'en'
): string {
  let message = t(key, locale);
  
  for (const [param, value] of Object.entries(params)) {
    message = message.replace(new RegExp(`\\{${param}\\}`, 'g'), String(value));
  }
  
  return message;
}

/**
 * Get plural form
 */
export function getPlural(
  count: number,
  options: { zero?: string; one: string; two?: string; few?: string; many?: string; other: string },
  locale: SupportedLocale = 'en'
): string {
  // Simple plural rules (for production, use a library like formatjs)
  if (count === 0 && options.zero) return options.zero;
  if (count === 1) return options.one;
  if (locale === 'ar') {
    if (count === 2) return options.two || options.other;
    if (count >= 3 && count <= 10) return options.few || options.other;
    return options.many || options.other;
  }
  return options.other;
}

/**
 * Format date according to locale
 */
export function formatDate(
  date: Date | string,
  locale: SupportedLocale = 'en',
  options?: Intl.DateTimeFormatOptions
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const localeMap: Record<SupportedLocale, string> = {
    en: 'en-US',
    sw: 'sw-TZ',
    ar: 'ar-SA',
    fr: 'fr-FR',
  };
  
  return new Intl.DateTimeFormat(localeMap[locale], options).format(d);
}

/**
 * Format relative time
 */
export function formatRelativeTime(
  date: Date | string,
  locale: SupportedLocale = 'en'
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHour = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHour / 24);

  const localeMap: Record<SupportedLocale, string> = {
    en: 'en-US',
    sw: 'sw-TZ',
    ar: 'ar-SA',
    fr: 'fr-FR',
  };

  const rtf = new Intl.RelativeTimeFormat(localeMap[locale], { numeric: 'auto' });

  if (Math.abs(diffSec) < 60) {
    return rtf.format(diffSec, 'second');
  } else if (Math.abs(diffMin) < 60) {
    return rtf.format(diffMin, 'minute');
  } else if (Math.abs(diffHour) < 24) {
    return rtf.format(diffHour, 'hour');
  } else {
    return rtf.format(diffDay, 'day');
  }
}

/**
 * Format number according to locale
 */
export function formatNumber(
  value: number,
  locale: SupportedLocale = 'en',
  options?: Intl.NumberFormatOptions
): string {
  const localeMap: Record<SupportedLocale, string> = {
    en: 'en-US',
    sw: 'sw-KE',
    ar: 'ar-SA',
    fr: 'fr-FR',
  };
  
  return new Intl.NumberFormat(localeMap[locale], options).format(value);
}

/**
 * Format currency according to locale
 */
export function formatCurrency(
  amount: number,
  locale: SupportedLocale = 'en',
  currency?: string
): string {
  const currencyCode = currency || LOCALE_CONFIG[locale].currencyCode;
  const localeMap: Record<SupportedLocale, string> = {
    en: 'en-US',
    sw: 'sw-KE',
    ar: 'ar-SA',
    fr: 'fr-FR',
  };
  
  return new Intl.NumberFormat(localeMap[locale], {
    style: 'currency',
    currency: currencyCode,
  }).format(amount);
}

/**
 * Get text direction for locale
 */
export function getDirection(locale: SupportedLocale = 'en'): 'ltr' | 'rtl' {
  return LOCALE_CONFIG[locale]?.direction || 'ltr';
}

/**
 * Check if locale is RTL
 */
export function isRTL(locale: SupportedLocale): boolean {
  return RTL_LANGUAGES.includes(locale);
}

/**
 * Get locale from browser
 */
export function getBrowserLocale(): SupportedLocale {
  const browserLang = navigator.language.split('-')[0];
  return (SUPPORTED_LOCALES.includes(browserLang as SupportedLocale) 
    ? browserLang 
    : 'en') as SupportedLocale;
}

/**
 * Create RTL-aware styles
 */
export function getRTLAwareStyles(
  styles: React.CSSProperties,
  locale: SupportedLocale
): React.CSSProperties {
  if (!isRTL(locale)) return styles;

  const rtlStyles: React.CSSProperties = { ...styles };

  // Swap horizontal padding/margin
  if ('paddingLeft' in rtlStyles) {
    rtlStyles.paddingRight = rtlStyles.paddingLeft;
    delete rtlStyles.paddingLeft;
  }
  if ('paddingRight' in rtlStyles) {
    rtlStyles.paddingLeft = rtlStyles.paddingRight;
    delete rtlStyles.paddingRight;
  }
  if ('marginLeft' in rtlStyles) {
    rtlStyles.marginRight = rtlStyles.marginLeft;
    delete rtlStyles.marginLeft;
  }
  if ('marginRight' in rtlStyles) {
    rtlStyles.marginLeft = rtlStyles.marginRight;
    delete rtlStyles.marginRight;
  }

  return rtlStyles;
}

/**
 * Hook for using translations in components
 */
export function useTranslations(locale: SupportedLocale = 'en') {
  return {
    t: (key: TranslationKey) => t(key, locale),
    tInterpolate: (key: TranslationKey, params: Record<string, string | number>) => 
      tInterpolate(key, params, locale),
    getPlural: (count: number, options: Parameters<typeof getPlural>[1]) => 
      getPlural(count, options, locale),
    formatDate: (date: Date | string, options?: Intl.DateTimeFormatOptions) => 
      formatDate(date, locale, options),
    formatNumber: (value: number, options?: Intl.NumberFormatOptions) => 
      formatNumber(value, locale, options),
    formatCurrency: (amount: number, currency?: string) => 
      formatCurrency(amount, locale, currency),
    direction: getDirection(locale),
    isRTL: isRTL(locale),
    locale,
  };
}
