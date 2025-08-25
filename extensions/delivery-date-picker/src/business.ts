import type { ApiForExtension, CartLine, MailingAddress, Product, RenderExtensionTarget } from "@shopify/ui-extensions/checkout";
import type { AvailableShippingMethod, FutureShippingWeek, Settings } from "./models";
import { poBoxPatterns } from "./models";
import { addDays, dateAsYmd, dateMonth, isDateBetween, toTimezone, truncateToDateOnly, weekdayFrom } from "./utils";

// constants
export const maxDaysForFutureDelivery = 180;
const futureShippingEffectiveDayOfWeek = 4; // the effective day of the week (numeric value per the daysOfWeek constant) when future week orders are placed into the ERP

// shipping day estimates
const isFactoryShipping = (date: Date, isPeak: boolean, isGel: boolean) => {
    const weekday = weekdayFrom(date);

    // the days of the week that the factory ships out orders depends on whether or not this is peak and/or gel season
    if (isPeak) {
        if (isGel) {
            return ['Monday', 'Tuesday', 'Wednesday'].includes(weekday) && isShipperActiveDate(addDays(date, 1), isPeak, isGel) && isShipperActiveDate(addDays(date, 2), isPeak, isGel); // make sure that the two CONSECUTIVE days following the day are shipper active days
        } else {
            return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].includes(weekday);
        }
    } else {
        if (isGel) {
            return ['Monday', 'Tuesday', 'Wednesday'].includes(weekday) && isShipperActiveDate(addDays(date, 1), isPeak, isGel) && isShipperActiveDate(addDays(date, 2), isPeak, isGel); // make sure that the two CONSECUTIVE days following the day are shipper active days
        } else {
            return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].includes(weekday);
        }
    }
}

const isShipperActiveDate = (date: Date, isPeak: boolean, isGel: boolean) => {
    const weekday = weekdayFrom(date);

    if (isPeak) {
        if (isGel) {
            return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].includes(weekday);
        } else {
            return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].includes(weekday);
        }
    } else {
        if (isGel) {
            return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].includes(weekday);
        } else {
            return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].includes(weekday);
        }
    }
}

const numberOfBusinessDaysToShipForNonGel = (isPeak: boolean): [number, number] => {
    if (isPeak) {
        return [1, 3];
    } else {
        return [1, 4];
    }
}

const isShippingDate = (date: Date, settings: Settings, isPeak: boolean, isGel: boolean) => {
    return isShipperActiveDate(date, isPeak, isGel) && isDeliveryDate(date, settings);
}

const shippedDateFor = (currentBusinessDay: Date, settings: Settings) => {
    let testDay = currentBusinessDay;
    let addedDays = 0;
    do { // just start adding one day at a time until we get a day where the factory is open and shipping the specific order
        testDay = addDays(testDay, 1);
        addedDays++;

        if (isFactoryOpen(testDay, settings) && isFactoryShipping(testDay, isPeakSeason(testDay, settings), isGelSeason(testDay, settings))) {
            return testDay;
        }
    } while (addedDays < 100); // guard against an infinite loop
    
    return undefined;
}

const gelDeliveryDate = (currentBusinessDay: Date, isPeak: boolean) => {
  const possibleShippingDates: Date[] = isFactoryShipping(currentBusinessDay, isPeak, true) ? [currentBusinessDay] : []; // if we can ship it today, include the current business day

  const numNeededShippingDays = ['Wednesday', 'Thursday'].includes(weekdayFrom(currentBusinessDay)) ? 1 : 2; // how many possible days we need to be able to ship this to get the full range of possible delivery dates (per the spreadsheet we only need one for Wednesday/Thursday, but two for other days)

  // keep adding a day to the current date until we have found enough days where the order can ship (see the above line for how many days that is)
  let addedDays = 0;
  let numPossibleShipDays = 0;
  do {
    addedDays++;

    const testDate = addDays(currentBusinessDay, addedDays);
    if (isFactoryShipping(testDate, isPeak, true)) {
      numPossibleShipDays++;
      possibleShippingDates.push(testDate);
    }
  } while (addedDays < 100 && numPossibleShipDays < numNeededShippingDays);

  // due to how we construct the array of possible shipping dates, we know that the list of dates is in order, so first will be smallest and last will be largest, to give us the full range
  const possibleDeliveryDates = possibleShippingDates.flatMap(date => [addDays(date, 1), addDays(date, 2)]);
  if (!possibleDeliveryDates.length) {
    return 'Unknown delivery date';
  } else if (possibleDeliveryDates.length === 1) {
    return `Arrives on ${dateAsYmd(possibleDeliveryDates[0])}`;
  } else {
    return `Arrives between ${dateAsYmd(possibleDeliveryDates[0])} and ${dateAsYmd(possibleDeliveryDates[possibleDeliveryDates.length - 1])}`;
  }
}

const nonGelDeliveryDate = (shippedDate: Date, isPeak: boolean, settings: Settings) => {
  const [minShippingBusinessDays, maxShippingBusinessDays] = numberOfBusinessDaysToShipForNonGel(isPeakSeason(shippedDate, settings));

  // keep adding days until we have hit the minimum and maximum number of business days
  let addedDays = 0;
  let addedBusinessDays = 0;
  let earlyEstimate: string | undefined;
  do {
    addedDays++;
    const testDay = addDays(shippedDate, addedDays);
    if (isShippingDate(testDay, settings, isPeak, false)) {
        addedBusinessDays++;

        if (addedBusinessDays === minShippingBusinessDays && !earlyEstimate) {
            earlyEstimate = dateAsYmd(addDays(shippedDate, addedDays));
        }

        if (addedBusinessDays === maxShippingBusinessDays) {
            const lateEstimate = dateAsYmd(addDays(shippedDate, addedDays));
            return `Arrives between ${earlyEstimate} and ${lateEstimate} (ships ${dateAsYmd(shippedDate)}, takes ${minShippingBusinessDays}-${maxShippingBusinessDays} business days to ship)`;
        }
    }
  } while (addedDays < 100); // guard against an infinite loop

  return 'Unknown delivery date';
}

const standardShippingDaysEstimate = (currentBusinessDay: Date, settings: Settings) => {
    const shippedDate = shippedDateFor(currentBusinessDay, settings);
    if (!shippedDate) {
        return 'Unknown';
    }

    const isPeak = isPeakSeason(shippedDate, settings);
    const isGel = isGelSeason(shippedDate, settings);

    if (isGel) {
      return gelDeliveryDate(currentBusinessDay, isPeak);
    } else {
      return nonGelDeliveryDate(shippedDate, isPeak, settings);
    }
}

const isPeakSeason = (date: Date, settings: Settings) => isDateBetween(date, new Date(settings.peak_season_start_date), new Date(settings.peak_season_end_date));
const isGelSeason = (date: Date, settings: Settings) => isDateBetween(date, new Date(settings.gel_start_date), new Date(settings.gel_end_date));

// is the factory (warehouse) open and able to ship on a specific day?
const isFactoryOpen = (date: Date, settings: Settings) => {
  // the factory is not open before today
  if (date < truncateToDateOnly(new Date())) {
    return false;
  }
  
  // if the date is today, make sure it's before the cutoff time (if after the cutoff time, then the factory cannot process the order today so it's effective closed for the purposes of handling this order)
  if (dateAsYmd(date) === dateAsYmd(new Date())) {
    if (!isBeforeCutoffTime(new Date(), settings)) {
      return false;
    }
  }

  // make sure the factory isn't closed due to being a denoted closure date
  return !settings.factory_offdays.split('\n').includes(weekdayFrom(date)) &&
    !settings.factory_offdays_specific.split('\n').includes(dateAsYmd(date));
}

// determine if a given day can ship strawberries (i.e. NOT a strawberry blackout date); note that this does not check that the factory is open
const areStrawberriesAvailableToShipOn = (date: Date, settings: Settings) => !settings.strawberry_blackout_dates.split('\n').includes(dateAsYmd(date));

// determine if an order contains any items with strawberries
export const orderContainsStrawberries = (cartLines: CartLine[]) => cartLines.some(line => line.merchandise.title.toLowerCase().includes('strawberries'));

// determine if the factory can ship on a given date
const canFactoryShipOnDate = (date: Date, cartLines: CartLine[], settings: Settings) => 
  isFactoryOpen(date, settings) && 
  (!orderContainsStrawberries(cartLines) || areStrawberriesAvailableToShipOn(date, settings));

// is the shipper able to deliver on a specific day?
const isDeliveryDate = (date: Date, settings: Settings) =>
  !settings.non_delivery_days.split('\n').includes(weekdayFrom(date)) &&
  !settings.non_delivery_days_specific.split('\n').includes(dateAsYmd(date));

const zipCodeMethodRestrictionsFor = (settings: Settings) => 
  Object.fromEntries(
    settings.zip_code_method_ineligibility
    .split('\n')
    .map(restrictionStr => restrictionStr.split(':', 2))
    .map(([zip, restrictedMethodsStr]) => [zip.trim(), restrictedMethodsStr.split(',').map(restrictedMethod => restrictedMethod.trim())])
  );

const zipCodesIneligibleForFutureDatesFrom = (settings: Settings) => settings.zip_code_future_date_ineligibility.split('\n').map(zip => zip.trim());

const addressPartIsPoBox = (addressPart: string) => {
  const normalizedAddress = addressPart.toLowerCase().replace(/[^a-zA-Z]/g, '');

  return poBoxPatterns.some(pattern => normalizedAddress.match(pattern));
}

export const isAddressPoBox = (address: MailingAddress) => [address.address1, address.address2].some(addressPart => addressPart && addressPartIsPoBox(addressPart));

export const isFutureDateEligible = (address: MailingAddress, settings: Settings) => !zipCodesIneligibleForFutureDatesFrom(settings).includes(address.zip ?? '') && !isAddressPoBox(address);

// apply a series of filters to a list of shipping methods
const shippingMethodsWithFilters = (startingMethods: AvailableShippingMethod[], filters: ((methods: AvailableShippingMethod[]) => AvailableShippingMethod[])[]) => filters.reduce((remainingMethods, filter) => filter(remainingMethods), startingMethods);

export const shippingMethodsAvailableFor = (selectedDate: Date, shippingAddress: MailingAddress, cartLines: CartLine[], settings: Settings): AvailableShippingMethod[] => {
  // don't allow shipping on or before today
  if (selectedDate <= truncateToDateOnly(new Date())) {
    return [];
  }

  // don't allow shipping on non-delivery days
  if (!isDeliveryDate(selectedDate, settings)) {
    return [];
  }

  return shippingMethodsWithFilters([
    {
      name: 'Saturday Specific Date Delivery',
      days: ''
    },
    {
      name: 'Specific Date Delivery',
      days: ''
    }
  ], [
    // TODO: factor out filters common across ASAP and future date
    methods => poBoxFilter(methods, shippingAddress, cartLines),
    methods => shippingEligibilityRulesFilter(methods, shippingAddress, settings),
    methods => strawberryMethodFilter(methods, cartLines),
    methods => dateBasedFilter(methods, selectedDate, cartLines, settings),
    cheapestMethodFilter
  ]);
}

// filters
const weekOfFilter = (methods: AvailableShippingMethod[]) => {
  return methods.filter(method => method.name === 'Week of Delivery');
}

// any filters based on the contents of the order
const strawberryMethodFilter = (availableMethods: AvailableShippingMethod[], cartLines: CartLine[]) => {
  // orders with strawberries can only ship overnight or saturday overnight
  if (orderContainsStrawberries(cartLines)) {
    return availableMethods.filter(method => ['Overnight', 'Saturday Overnight'].includes(method.name));
  } else {
    return availableMethods;
  }
}

// any filters based on the selected date
const dateBasedFilter = (availableMethods: AvailableShippingMethod[], selectedDate: Date, cartLines: CartLine[], settings: Settings): AvailableShippingMethod[] => {
  const oneDayBefore = addDays(selectedDate, -1);

  // apply filters based on the day and shipping date restrictions (factory closures, non-delivery days, etc.)
  if (selectedDate.getDay() === 6) {
    // if it's a Saturday, then Saturday Specific Date Delivery is the only option and that is only available if the day before is both a delivery day (otherwise, cannot ship that day)
    if (canFactoryShipOnDate(oneDayBefore, cartLines, settings) && isDeliveryDate(oneDayBefore, settings)) {
      return availableMethods.filter(method => method.name === 'Saturday Specific Date Delivery');
    } else {
      return [];
    }
  } else {
    // otherwise it's not a Saturday
    // if the warehouse can ship one day before AND one day before is a delivery day, then allow shipping using Specific Date Delivery
    if (canFactoryShipOnDate(oneDayBefore, cartLines, settings) && isDeliveryDate(oneDayBefore, settings)) {
      return availableMethods.filter(method => method.name === 'Specific Date Delivery');
    } else {
      // if neither two-day nor overnight are available, then order cannot be shipped on this date
      return [];
    }
  }
}

// remove any shipping methods blocked for the current address
const shippingEligibilityRulesFilter = (availableMethods: AvailableShippingMethod[], address: MailingAddress, settings: Settings): AvailableShippingMethod[] => {
  const restrictedMethodsByZip = zipCodeMethodRestrictionsFor(settings);
  const restrictedMethodsForCurrentZip = restrictedMethodsByZip[address.zip ?? ''] ?? [];

  // if there are any restrictions for the current zip then remove them from the list; otherwise just return the list as-is
  return restrictedMethodsForCurrentZip ? availableMethods.filter(method => !restrictedMethodsForCurrentZip.includes(method.name)) : availableMethods;
}

// pick the cheapest method and ignroe all others
const cheapestMethodFilter = (availableMethods: AvailableShippingMethod[]) => {
  const methodsByPriority = ['Two-Day', 'Overnight', 'Saturday Overnight']; // the methods sorted from cheapest to most expensive

  // TODO: handle the case where one is not found
  return availableMethods.sort((m1, m2) => methodsByPriority.indexOf(m1.name) - methodsByPriority.indexOf(m2.name)).filter((_, idx) => idx === 0);
}

// only allow standard shipping for PO Boxes and don't allow strawberries
const poBoxFilter = (availableMethods: AvailableShippingMethod[], address: MailingAddress, cartLines: CartLine[]) => {
  if (!isAddressPoBox(address)) {
    return availableMethods;
  }

  if (orderContainsStrawberries(cartLines)) {
    return [];
  }

  return availableMethods.filter(method => method.name === 'Standard');
}

// shipping methods available for the various settings

export const shippingMethodsAvailableAsap = (date: Date, cartLines: CartLine[], shippingAddress: MailingAddress, settings: Settings): AvailableShippingMethod[] => {
  const businessDay = businessDateFor(date, settings);

  return shippingMethodsWithFilters([
    {
      name: 'Standard',
      days: standardShippingDaysEstimate(businessDay, settings)
    },
    {
      name: 'Overnight',
      days: ''
    },
    {
      name: 'Two-Day',
      days: ''
    }
  ], [
    methods => poBoxFilter(methods, shippingAddress, cartLines),
    methods => shippingEligibilityRulesFilter(methods, shippingAddress, settings),
    methods => strawberryMethodFilter(methods, cartLines)
  ]);
}

export const shippingMethodsAvailableWeekOf = (cartLines: CartLine[], shippingAddress: MailingAddress, settings: Settings): AvailableShippingMethod[] => {
  return shippingMethodsWithFilters([
    {
      name: 'Week of Delivery',
      days: 'Delivers during the selected week'
    }
  ], [
    methods => poBoxFilter(methods, shippingAddress, cartLines),
    methods => shippingEligibilityRulesFilter(methods, shippingAddress, settings),
    methods => strawberryMethodFilter(methods, cartLines),
    methods => weekOfFilter(methods)
  ]);
}

// time and date
const businessTimezone = 'America/New_York';

const toBusinessTimezone = (date: Date = new Date()) => toTimezone(date, businessTimezone);

// get the business date for a given date (i.e. if after the cutoff time, treat it as the next day)
const businessDateFor = (date: Date, settings: Settings) => {
  const [cutoffTimeHourEt, cutoffTimeMinuteEt] = settings.time_day_cutoff.split(':').map(part => +part);

  const dateInBusinessTimezone = toBusinessTimezone(date);

  if (dateInBusinessTimezone.getHours() < cutoffTimeHourEt || (dateInBusinessTimezone.getHours() == cutoffTimeHourEt && dateInBusinessTimezone.getMinutes() <= cutoffTimeMinuteEt)) {
    return truncateToDateOnly(date);
  } else {
    return addDays(truncateToDateOnly(date), 1);
  }
}

// determine if the time for a specific day is before the cutoff time to fall on the next business day
const isBeforeCutoffTime = (date: Date, settings: Settings) => businessDateFor(date, settings).getDay() === truncateToDateOnly(date).getDay();

// future shipping
const futureWeekForDate = (effectiveDate: Date): FutureShippingWeek => {
  const displayWeekStartDate = addDays(effectiveDate, 7 - effectiveDate.getDay()); // the Sunday AFTER the effective date 
  const displayRangeStartDate = addDays(displayWeekStartDate, 2); // the Tuesday after the effective date
  const displayRangeEndDate = addDays(displayWeekStartDate, 6); // the Saturday after the effective date

  return {
      effectiveDate: dateAsYmd(effectiveDate),
      month: dateMonth(displayRangeStartDate),
      displayTitle: `${dateMonth(displayRangeStartDate)} ${displayRangeStartDate.getDate()} to ${dateMonth(displayRangeEndDate)} ${displayRangeEndDate.getDate()}`
  }
}

export const availableFutureWeeks = () => {
  const weeks: FutureShippingWeek[] = [];
  const today = truncateToDateOnly(new Date());

  for (let dayOffset = 1; dayOffset <= maxDaysForFutureDelivery; dayOffset++) {
    const date = addDays(today, dayOffset);
    
    if (date.getDay() === futureShippingEffectiveDayOfWeek) { // select any days in the future that are on the selected effective weekday (i.e. when actually entered into the ERP) for future week orders
      weeks.push(futureWeekForDate(date));
    }
  }

  // group weeks by month
  return weeks.reduce((acc, week) => {
    if (acc[week.month]) {
      acc[week.month].push(week);
    } else {
      acc[week.month] = [week];
    }

    return acc;
  }, {} as {[key: string]: FutureShippingWeek[]});
}

interface GetProductSellingPlanAllocationsResult {
  products: {
    nodes: {
      variants: {
        nodes: {
          id: string;
          sellingPlanAllocations: {
            nodes: {
              sellingPlan: {
                id: string;
              }
            }[]
          }
        }[]
      }
    }[]
  }
}

const numericIdFromProduct = (product: Product) => product.id.match(/^gid:\/\/shopify\/Product\/(\d+)$/)[1];

export const getSellingPlansForCartLines = async (cartLines: CartLine[], query: ApiForExtension<RenderExtensionTarget>['query']) => {
  const result = await query<GetProductSellingPlanAllocationsResult>(`
query GetProducts($query: String!) {
  products(query: $query, first: 250) {
    nodes {
      variants(first: 25) {
        nodes {
          id
          sellingPlanAllocations(first: 5) {
            nodes {
              sellingPlan {
                id
              }
            }
          }
        }
      }
    }
  }
}`, {
    variables: {
      query: cartLines.map(line => `id:${numericIdFromProduct(line.merchandise.product)}`).join(' OR ')
    }
  });

  if (result.errors) {
    throw new Error(JSON.stringify(result.errors, null, 4));
  }
  
  return result.data.products.nodes.flatMap(product => product.variants.nodes).filter(variant => cartLines.find(cartLine => cartLine.merchandise.id === variant.id));
}