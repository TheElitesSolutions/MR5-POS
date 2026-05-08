// Mirrors the Supabase row shapes returned by main/services/websiteManagerService.ts
// Keep in sync with that file's `WebsiteItem`, `WebsiteCategory`, `WebsiteSettings`.

export interface WebsiteItem {
  uuid: string;
  id: number;
  name: string;
  description: string | null;
  price: string;
  category_id: number;
  display_order: number;
  is_featured: boolean;
  is_special: boolean;
  isVisibleOnWebsite: boolean;
  image_url: string | null;
  image_lqip: string | null;
  updated_at: string;
}

export interface WebsiteCategory {
  uuid: string;
  id: number;
  name: string;
  display_order: number;
  is_visible: boolean;
  image_url: string | null;
  updated_at: string;
}

export interface WebsiteAddOn {
  addon_uuid: string;
  id: number;
  description: string;
  price: string;
  category_id: number;
}

export interface DayHours {
  open: string; // "HH:MM"
  close: string; // "HH:MM"
  closed?: boolean;
}

export type WeeklyHours = Partial<Record<
  'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun',
  DayHours | null
>>;

export interface WebsiteSettings {
  id: 1;
  phone: string | null;
  address: string | null;
  google_maps_url: string | null;
  hero_tagline: string | null;
  header_subtitle: string | null;
  hours: WeeklyHours;
  social: { instagram?: string; facebook?: string; tiktok?: string };
  updated_at: string;
}

export type WebsiteSettingsPatch = Partial<Omit<WebsiteSettings, 'id' | 'updated_at'>>;
