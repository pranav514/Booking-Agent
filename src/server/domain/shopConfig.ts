import { z } from 'zod';

export interface ServicePackage {
  id: string;
  name: string;
  durationMinutes: number;
  price: number;
  description: string;
}

export interface VehicleCategory {
  id: string;
  name: string;
  durationAdjustmentMinutes: number;
  priceAdjustment: number;
  supported: boolean;
  notes?: string;
}

export const SHOP_SERVICES: Record<string, ServicePackage> = {
  'interior-wash': {
    id: 'interior-wash',
    name: 'Interior Detail and Wash',
    durationMinutes: 90,
    price: 150,
    description: 'Deep interior shampoo, steam cleaning, leather wipe, plus full exterior hand wash.',
  },
  'express-wash': {
    id: 'express-wash',
    name: 'Express Wash & Vacuum',
    durationMinutes: 45,
    price: 60,
    description: 'Exterior hand wash, wheels cleaned, interior vacuum, and clean windows.',
  },
  'exterior-polish': {
    id: 'exterior-polish',
    name: 'Exterior Polish & Seal',
    durationMinutes: 90,
    price: 160,
    description: 'Decontamination clay bar, single-stage paint polish, and 6-month ceramic sealant.',
  },
  'signature-detail': {
    id: 'signature-detail',
    name: 'Full Signature Detail',
    durationMinutes: 180,
    price: 275,
    description: 'Complete bumper-to-bumper detailing: full interior deep clean + exterior polish & sealant.',
  },
  'headlight-restoration': {
    id: 'headlight-restoration',
    name: 'Headlight Restoration',
    durationMinutes: 45,
    price: 50,
    description: 'Multi-stage wet sanding and UV clear coat sealant to restore cloudy headlights.',
  },
};

export const VEHICLE_CATEGORIES: Record<string, VehicleCategory> = {
  sedan: {
    id: 'sedan',
    name: 'Coupe / Sedan / Hatchback',
    durationAdjustmentMinutes: 0,
    priceAdjustment: 0,
    supported: true,
  },
  suv: {
    id: 'suv',
    name: 'Standard SUV / Crossover / Pickup Truck',
    durationAdjustmentMinutes: 30,
    priceAdjustment: 30,
    supported: true,
  },
  large_truck: {
    id: 'large_truck',
    name: '3-Row Large SUV / Minivan / Extended Truck',
    durationAdjustmentMinutes: 45,
    priceAdjustment: 50,
    supported: true,
  },
  commercial_rv: {
    id: 'commercial_rv',
    name: 'Commercial Van / RV / Boat / Semi',
    durationAdjustmentMinutes: 0,
    priceAdjustment: 0,
    supported: false,
    notes: 'Requires custom quote and shop owner evaluation. Not booked automatically.',
  },
};

export const SHOP_CONFIG = {
  name: 'Cedar Lane Auto Detailing',
  phone: '(415) 555-0100',
  address: '1420 Cedar Lane, Suite B',
  timezone: 'America/Los_Angeles',
  businessHours: {
    // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    daysOpen: [1, 2, 3, 4, 5, 6], // Mon - Sat
    openHour: 8, // 8:00 AM
    closeHour: 18, // 6:00 PM (18:00)
    slotIntervalMinutes: 30,
    bays: parseInt(process.env.SHOP_BAYS || '1', 10), // 1 bay by default so 1 booking creates a conflict
  },
  policies: {
    lateGracePeriodMinutes: 15,
    latePolicyDescription:
      'We have a 15-minute grace period. If running more than 15 minutes late, please call ahead so we can either adjust the service or reschedule your slot.',
    prepRequirements: [
      'Remove all personal belongings and valuables from glovebox, center console, and trunk.',
      'Remove child car seats if you want the upholstery underneath thoroughly cleaned.',
      'Inform us in advance if there is heavy pet hair, mold, or biohazard spills so we can allocate proper chemicals and time.',
    ],
    billingDisputes: {
      action: 'escalate_to_human',
      policy:
        'All charge questions and billing complaints are immediately forwarded to the shop owner or manager for direct callback within 2 hours.',
    },
  },
};

export function matchServiceByName(query: string): ServicePackage | undefined {
  const q = query.toLowerCase();
  for (const s of Object.values(SHOP_SERVICES)) {
    if (s.name.toLowerCase().includes(q) || q.includes(s.name.toLowerCase())) {
      return s;
    }
  }
  if (q.includes('interior') && q.includes('wash')) return SHOP_SERVICES['interior-wash'];
  if (q.includes('interior')) return SHOP_SERVICES['interior-wash'];
  if (q.includes('express') || q.includes('vacuum') || q.includes('vac')) return SHOP_SERVICES['express-wash'];
  if (q.includes('exterior') || q.includes('polish')) return SHOP_SERVICES['exterior-polish'];
  if (q.includes('full') || q.includes('signature')) return SHOP_SERVICES['signature-detail'];
  if (q.includes('headlight')) return SHOP_SERVICES['headlight-restoration'];
  return undefined;
}

