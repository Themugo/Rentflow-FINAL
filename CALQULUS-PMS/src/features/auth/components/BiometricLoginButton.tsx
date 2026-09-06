import { Fingerprint, ScanFace } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';

interface BiometricLoginButtonProps {
  biometryType: 'fingerprint' | 'faceId' | 'iris' | 'none';
  onPress: () => void;
  isLoading?: boolean;
  className?: string;
  variant?: 'default' | 'outline' | 'ghost';
}

export function BiometricLoginButton({
  biometryType,
  onPress,
  isLoading = false,
  className,
  variant = 'outline',
}: BiometricLoginButtonProps) {
  const getIcon = () => {
    switch (biometryType) {
      case 'faceId':
        return <ScanFace className="h-5 w-5" />;
      case 'fingerprint':
      case 'iris':
      default:
        return <Fingerprint className="h-5 w-5" />;
    }
  };

  const getLabel = () => {
    switch (biometryType) {
      case 'faceId':
        return 'Sign in with Face ID';
      case 'fingerprint':
        return 'Sign in with Fingerprint';
      case 'iris':
        return 'Sign in with Iris';
      default:
        return 'Sign in with Biometrics';
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      onClick={onPress}
      disabled={isLoading}
      className={cn(
        'w-full flex items-center justify-center gap-2 touch-manipulation',
        className
      )}
    >
      {isLoading ? (
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current" />
      ) : (
        getIcon()
      )}
      <span>{isLoading ? 'Authenticating...' : getLabel()}</span>
    </Button>
  );
}
