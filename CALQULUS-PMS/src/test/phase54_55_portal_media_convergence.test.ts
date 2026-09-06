import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const migration54 = fs.readFileSync('supabase/migrations/20260903000025_phase54_unit_photo_atomic.sql','utf8');
const migration55 = fs.readFileSync('supabase/migrations/20260903000026_phase55_landlord_portal_atomic.sql','utf8');
const gallery = fs.readFileSync('src/features/units/components/UnitPhotoGallery.tsx','utf8');
const bank = fs.readFileSync('src/features/landlord/components/LandlordBankDetails.tsx','utf8');
const prefs = fs.readFileSync('src/features/landlord/components/LandlordNotificationPreferences.tsx','utf8');
const messages = fs.readFileSync('src/features/landlord/components/LandlordMessages.tsx','utf8');

describe('Phase 54-55 mutation convergence', () => {
  it('defines and grants unit photo atomic RPCs', () => {
    for (const fn of ['save_unit_photo_atomic','delete_unit_photo_atomic','set_unit_cover_photo_atomic']) {
      expect(migration54).toContain(`FUNCTION public.${fn}`);
      expect(migration54).toContain(`GRANT EXECUTE ON FUNCTION public.${fn}`);
    }
    expect(migration54).toContain('REVOKE INSERT,UPDATE,DELETE ON public.unit_photos FROM authenticated');
  });
  it('defines and grants landlord portal atomic RPCs', () => {
    for (const fn of ['save_landlord_bank_details_atomic','save_landlord_notification_preferences','send_landlord_message_atomic','mark_landlord_messages_read_atomic']) {
      expect(migration55).toContain(`FUNCTION public.${fn}`);
      expect(migration55).toContain(`GRANT EXECUTE ON FUNCTION public.${fn}`);
    }
    for (const table of ['landlord_bank_details','landlord_notification_preferences','landlord_messages']) {
      expect(migration55).toContain(`REVOKE INSERT,UPDATE,DELETE ON public.${table} FROM authenticated`);
    }
  });
  it('removes direct portal/media DML from production UI', () => {
    expect(gallery).not.toMatch(/from\(['"]unit_photos['"]\).*\.(insert|update|upsert|delete)\s*\(/s);
    expect(bank).not.toMatch(/from\(['"]landlord_bank_details['"]\).*\.(insert|update|upsert|delete)\s*\(/s);
    expect(prefs).not.toMatch(/from\(['"]landlord_notification_preferences['"]\).*\.(insert|update|upsert|delete)\s*\(/s);
    expect(messages).not.toMatch(/from\(['"]landlord_messages['"]\).*\.(insert|update|upsert|delete)\s*\(/s);
  });
});
