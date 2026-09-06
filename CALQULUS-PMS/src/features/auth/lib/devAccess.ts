// Open-access (no-login) development mode.
//
// Development accounts are configured through environment variables only.
// Credentials are intentionally never stored in source control or bundled
// into the application as defaults. Production builds always disable this.

export interface DevPresetAccount {
  role: 'manager' | 'webhost' | 'tenant' | 'agency' | 'landlord';
  label: string;
  email: string;
  password: string;
  defaultPath: string;
}

export interface DevAccessEnv {
  PROD: boolean;
  DEV: boolean;
  VITE_ENABLE_DEV_ACCESS?: string;
}

type DevPresetRole = DevPresetAccount['role'];

type ImportMetaEnv = {
  PROD: boolean;
  DEV: boolean;
  VITE_ENABLE_DEV_ACCESS?: string;
  VITE_DEV_ACCESS_EMAIL?: string;
  VITE_DEV_ACCESS_PASSWORD?: string;
  VITE_DEV_MANAGER_EMAIL?: string;
  VITE_DEV_MANAGER_PASSWORD?: string;
  VITE_DEV_WEBHOST_EMAIL?: string;
  VITE_DEV_WEBHOST_PASSWORD?: string;
  VITE_DEV_TENANT_EMAIL?: string;
  VITE_DEV_TENANT_PASSWORD?: string;
  VITE_DEV_AGENCY_EMAIL?: string;
  VITE_DEV_AGENCY_PASSWORD?: string;
  VITE_DEV_LANDLORD_EMAIL?: string;
  VITE_DEV_LANDLORD_PASSWORD?: string;
};

const env = import.meta.env as ImportMetaEnv;

/** Pure gate used by tests. Production (`PROD`) always wins. */
export function isDevAccessEnabledFromEnv(env: DevAccessEnv): boolean {
  if (env.PROD) return false;
  if (env.VITE_ENABLE_DEV_ACCESS === "false") return false;
  if (env.VITE_ENABLE_DEV_ACCESS === "true") return true;
  return env.DEV;
}

const PRESET_META: Array<Pick<DevPresetAccount, 'role' | 'label' | 'defaultPath'>> = [
  { role: 'manager', label: 'Manager (Full Ops)', defaultPath: '/' },
  { role: 'webhost', label: 'Webhost / Admin', defaultPath: '/webhost' },
  { role: 'tenant', label: 'Tenant Portal', defaultPath: '/portal' },
  { role: 'agency', label: 'Agency Portal', defaultPath: '/agency' },
  { role: 'landlord', label: 'Landlord Portal', defaultPath: '/landlord/dashboard' },
];

function readPreset(role: DevPresetRole): DevPresetAccount | null {
  if (env.PROD) return null;

  const prefix = role.toUpperCase();
  const email = env[`VITE_DEV_${prefix}_EMAIL` as keyof ImportMetaEnv] as string | undefined;
  const password = env[`VITE_DEV_${prefix}_PASSWORD` as keyof ImportMetaEnv] as string | undefined;

  if (!email || !password) return null;
  const meta = PRESET_META.find((entry) => entry.role === role);
  if (!meta) return null;

  return { ...meta, email, password };
}

// Redundant, statically-analyzable guard: `import.meta.env.PROD` (unlike the
// aliased `env.PROD` above) is replaced with a literal boolean by Vite at
// build time, so bundlers can dead-code-eliminate this entire branch — and
// the preset credentials with it — out of production bundles.
export const DEV_PRESET_ACCOUNTS: DevPresetAccount[] = import.meta.env.PROD
  ? []
  : isDevAccessEnabledFromEnv(env)
    ? PRESET_META.map((entry) => readPreset(entry.role)).filter(
        (account): account is DevPresetAccount => account !== null,
      )
    : [];

const EMPTY_DEV_ACCOUNT: DevPresetAccount = {
  role: 'manager',
  label: '',
  email: '',
  password: '',
  defaultPath: '/',
};

/** Account used for silent auto-login. Generic overrides take precedence. */
export function getDevDefaultAccount(): DevPresetAccount {
  const overrideEmail = env.VITE_DEV_ACCESS_EMAIL?.trim();
  const overridePassword = env.VITE_DEV_ACCESS_PASSWORD;
  const base = DEV_PRESET_ACCOUNTS.find((account) => account.role === 'manager') ?? EMPTY_DEV_ACCOUNT;

  if (!overrideEmail && !overridePassword) return base;

  return {
    ...base,
    email: overrideEmail || base.email,
    password: overridePassword || base.password,
  };
}

export function isDevAccessEnabled(): boolean {
  return isDevAccessEnabledFromEnv({
    PROD: env.PROD,
    DEV: env.DEV,
    VITE_ENABLE_DEV_ACCESS: env.VITE_ENABLE_DEV_ACCESS,
  });
}
