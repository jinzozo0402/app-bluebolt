import type { Status } from "@shopify/ui-extensions/checkout";

export type ShipSettingType = 'ASAP' | 'FutureDate' | 'WeekOf';

export interface AvailableShippingMethod {
  name: string;
  days: string;
}

export interface Settings {
  allow_future_delivery_dates?: boolean;
  show_date_override_textbox?: boolean;
  peak_season_start_date: string;
  peak_season_end_date: string;
  gel_start_date: string;
  gel_end_date: string;
  time_day_cutoff: string;
  factory_offdays: string;
  factory_offdays_specific: string;
  non_delivery_days: string;
  non_delivery_days_specific: string;
  strawberry_blackout_dates: string;
  zip_code_method_ineligibility: string;
  zip_code_future_date_ineligibility: string;
  po_box_future_date_notice: string;
  po_box_strawberry_notice: string;
  future_date_selling_plan_id: string;
}

export interface CheckoutNotice {
  text: string;
  type: Status;
}

export interface FutureShippingWeek {
  month: string; // the month (for display and grouping purposes only)
  displayTitle: string; // how it's displayed (again, for display purposes only)
  effectiveDate: string; // the date the order actually gets entered into the ERP
}

// constants
type DayOfWeek = 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';

export const daysOfWeek: Record<number, DayOfWeek> = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday'
};

export const poBoxPatterns = [
  /pobox/,
  /postofficebox/
];