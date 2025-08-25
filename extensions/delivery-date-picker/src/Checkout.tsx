import {
  Banner,
  BlockStack,
  Choice,
  ChoiceList,
  DatePicker,
  InlineStack,
  SkeletonText,
  TextBlock,
  reactExtension,
  useApi,
  useApplyAttributeChange,
  useApplyCartLinesChange,
  useCartLines,
  useShippingAddress
} from '@shopify/ui-extensions-react/checkout';
import type { CartLine, MailingAddress, SelectedDate } from '@shopify/ui-extensions/checkout';


import { useCallback, useEffect, useMemo, useState } from 'react';
import { availableFutureWeeks, getSellingPlansForCartLines, isAddressPoBox, isFutureDateEligible, maxDaysForFutureDelivery, orderContainsStrawberries, shippingMethodsAvailableAsap, shippingMethodsAvailableFor, shippingMethodsAvailableWeekOf } from './business';
import type { AvailableShippingMethod, CheckoutNotice, FutureShippingWeek, Settings, ShipSettingType } from './models';
import { addDays, dateAsYmd, truncateToDateOnly } from './utils';

export default reactExtension(
  'purchase.checkout.shipping-option-list.render-before',
  () => <Extension />,
);

// checkout notice generators
const poBoxStrawberryNoticeGenerator = (address: MailingAddress, cartLines: CartLine[], settings: Settings): CheckoutNotice | undefined  =>
  isAddressPoBox(address) && orderContainsStrawberries(cartLines) ?
    {
      text: settings.po_box_strawberry_notice,
      type: 'critical'
    } :
    undefined;

const poBoxFutureDateNoticeGenerator = (address: MailingAddress, settings: Settings): CheckoutNotice | undefined =>
  isAddressPoBox(address) ?
    {
      text: settings.po_box_future_date_notice,
      type: 'info'
    } :
    undefined;

const checkoutNoticeFor = (address: MailingAddress, cartLines: CartLine[], settings: Settings): CheckoutNotice | undefined => {
  // the notice generators, in order of priority
  const generators = [
    () => poBoxStrawberryNoticeGenerator(address, cartLines, settings),
    () => poBoxFutureDateNoticeGenerator(address, settings)
  ];

  let existingNotice: CheckoutNotice | undefined = undefined;
  for (const generator of generators) {
    const notice = generator();

    if (notice) {
      if (existingNotice) {
        // only replace the existing notice if the new one is critical
        if (existingNotice?.type !== 'critical') {
          existingNotice = notice;
        }
      } else {
        existingNotice = notice;
      }
    }
  }

  return existingNotice;
}

const sellingPlanIdFor = (numericId: string) => `gid://shopify/SellingPlan/${numericId}`;

function Extension() {
  const applyAttributeChange = useApplyAttributeChange();
  const applyCartLinesChange = useApplyCartLinesChange();

  const { settings, query } = useApi();
  const typedSettings = (settings.current as unknown) as Settings;

  const cartLines = useCartLines();
  const shippingAddress = useShippingAddress();

  const shippingMethodsAvailableByDay = useMemo(() => {
    const today = truncateToDateOnly(new Date());
    const availableShippingMethods: { [dmy: string]: AvailableShippingMethod[] } = {};
    
    for (let dayOffset = 1; dayOffset <= maxDaysForFutureDelivery; dayOffset++) {
      const date = addDays(today, dayOffset);

      availableShippingMethods[dateAsYmd(date)] = shippingMethodsAvailableFor(date, shippingAddress, cartLines, typedSettings);
    }

    return availableShippingMethods;
  }, [cartLines, typedSettings, shippingAddress]);

  const futureWeeksForShipping = useMemo(() => availableFutureWeeks(), []);

  const blackoutDates = useMemo(() => 
    Object.entries(shippingMethodsAvailableByDay)
      .filter(([, availableMethods]) => !availableMethods.length)
      .map(([dmy]) => dmy)
  , [shippingMethodsAvailableByDay]);

  const firstAvailableDate = useMemo(() =>
    Object.entries(shippingMethodsAvailableByDay).find(([date, availableShippingMethods]) => availableShippingMethods.length)[0],
  [shippingMethodsAvailableByDay]);

  const [shipSetting, setShipSetting] = useState<ShipSettingType>('ASAP');
  const [selectedDate, setSelectedDate] = useState<SelectedDate | undefined>(firstAvailableDate);
  const [selectedWeek, setSelectedWeek] = useState<FutureShippingWeek>(Object.entries(futureWeeksForShipping)[0][1][0]);
  const [currentDateOverride, setCurrentDateOverride] = useState<SelectedDate | undefined>();
  const [isLoadingCartShippingPlans, setIsLoadingCartShippingPlans] = useState<boolean>(true);
  const [isFutureShippingAvailableForCartItems, setIsFutureShippingAvailableForCartItems] = useState<boolean>(false);

  // for each variant in the cart, make sure that it actually has a selling plan ID attached to it before allowing future date shipping
  useEffect(() => {
    getSellingPlansForCartLines(cartLines, query)
      .then(plansApplicableForCart => {
        console.log('plans applicable for variants', plansApplicableForCart);
        console.log('cart lines', cartLines);

        setIsLoadingCartShippingPlans(false);
        setIsFutureShippingAvailableForCartItems(
          cartLines.every((cartLine) =>
            plansApplicableForCart.find(
              (variant) =>
                variant.id === cartLine.merchandise.id &&
                variant.sellingPlanAllocations.nodes.find(
                  (sellingPlanAllocation) =>
                    sellingPlanAllocation.sellingPlan.id === sellingPlanIdFor(typedSettings.future_date_selling_plan_id)
                )
            )
          )
        );

        console.log('future shipping available', cartLines.every((cartLine) =>
            plansApplicableForCart.find(
              (variant) =>
                variant.id === cartLine.merchandise.id &&
                variant.sellingPlanAllocations.nodes.find(
                  (sellingPlanAllocation) =>
                    sellingPlanAllocation.sellingPlan.id === sellingPlanIdFor(typedSettings.future_date_selling_plan_id)
                )
            )
          ));

        console.log('matching plans', cartLines.map((cartLine) =>
            plansApplicableForCart.find(
              (variant) =>
                variant.id === cartLine.merchandise.id
            )
          ));

          console.log('selling plan ID', sellingPlanIdFor(typedSettings.future_date_selling_plan_id));
      })
      .catch(() => {
        setIsLoadingCartShippingPlans(false);
      })
  }, [cartLines, query, typedSettings]);

  const setShippingMethodAsap = useCallback((dateOverride: SelectedDate | undefined) => {
    setShipSetting('ASAP');

    applyAttributeChange({
      key: 'shipSetting',
      type: 'updateAttribute',
      value: 'ASAP'
    });

    applyAttributeChange({
      key: 'availableMethods',
      type: 'updateAttribute',
      value: JSON.stringify(shippingMethodsAvailableAsap(dateOverride ? new Date(dateOverride as string) : new Date(), cartLines, shippingAddress, typedSettings))
    });

    applyAttributeChange({
      key: 'shipDate',
      type: 'updateAttribute',
      value: ''
    });

    applyAttributeChange({
      key: 'shipWeek',
      type: 'updateAttribute',
      value: ''
    });
  }, [applyAttributeChange, cartLines, shippingAddress, typedSettings]);

  // for debugging purposes, if we override the current date, update the shipping method
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setShippingMethodAsap(currentDateOverride), [currentDateOverride]);

  const setShippingMethodWeekOf = useCallback((week: FutureShippingWeek) => {
    setShipSetting('WeekOf');
    setSelectedWeek(week);

    applyAttributeChange({
      key: 'shipSetting',
      type: 'updateAttribute',
      value: 'WeekOf'
    });

    applyAttributeChange({
      key: 'availableMethods',
      type: 'updateAttribute',
      value: JSON.stringify(shippingMethodsAvailableWeekOf(cartLines, shippingAddress, typedSettings))
    });

    applyAttributeChange({
      key: 'shipDate',
      type: 'updateAttribute',
      value: ''
    });

    applyAttributeChange({
      key: 'shipWeek',
      type: 'updateAttribute',
      value: week.effectiveDate
    });
  }, [setShipSetting, applyAttributeChange, shippingAddress, typedSettings, cartLines]);

  const setShippingMethodFutureDate = useCallback((date: SelectedDate | undefined) => {
    // if no date is selected, then just ignore trying to select one (and it will force back the previously selected value since it's still in the useState value)
    if (date) {
      setShipSetting('FutureDate');
      setSelectedDate(date);

      applyAttributeChange({
        key: 'availableMethods',
        type: 'updateAttribute',
        value: JSON.stringify(shippingMethodsAvailableByDay[date as string])
      });
  
      applyAttributeChange({
        key: 'shipDate',
        type: 'updateAttribute',
        value: date as string
      });

      applyAttributeChange({
        key: 'shipWeek',
        type: 'updateAttribute',
        value: ''
      });
    }
  }, [setShipSetting, setSelectedDate, applyAttributeChange, shippingMethodsAvailableByDay]);

  const checkoutNotice = checkoutNoticeFor(shippingAddress, cartLines, typedSettings);

  // make sure that we actually CAN ship on a future date, based on both the cart lines support future shipping AND the address supporting it
  const canShipOnFutureDate = useMemo(
    () => isFutureShippingAvailableForCartItems && isFutureDateEligible(shippingAddress, typedSettings),
    [isFutureShippingAvailableForCartItems, shippingAddress, typedSettings]
  );

  // if the ZIP code is ineligible for shipping as a future date, force it back to ASAP
  useEffect(() => {
    if (!canShipOnFutureDate && shipSetting !== 'ASAP') {
      setShippingMethodAsap(currentDateOverride);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shippingAddress, shipSetting, typedSettings, setShippingMethodAsap, isFutureShippingAvailableForCartItems]);

  // if any cart lines use the wrong selling plan (if it's ASAP then we want to charge right away, if it's future date then we want to charge when the item is actually shipped), then update them
  useEffect(() => {
    const correctSellingPlanId = shipSetting === 'ASAP' ? null : sellingPlanIdFor(typedSettings.future_date_selling_plan_id);
    const firstCartLineWithWrongSellingPlan = cartLines.find(line => line.merchandise.requiresShipping && line.merchandise.sellingPlan?.id != correctSellingPlanId);

    if (firstCartLineWithWrongSellingPlan) {
      applyCartLinesChange({
        id: firstCartLineWithWrongSellingPlan.id,
        type: 'updateCartLine',
        sellingPlanId: correctSellingPlanId
      });
    }
  }, [shipSetting, cartLines, applyCartLinesChange, typedSettings]);

  const onChangeShipSetting = useCallback((setting: ShipSettingType) => {
    if (setting === 'ASAP') {
      setShippingMethodAsap(currentDateOverride);
    } else if (setting === 'FutureDate') {
      setShippingMethodFutureDate(firstAvailableDate);
    } else if (setting === 'WeekOf') {
      setShippingMethodWeekOf(Object.values(futureWeeksForShipping).flatMap(x => x)[0]);
    }
  }, [setShippingMethodAsap, setShippingMethodFutureDate, setShippingMethodWeekOf, firstAvailableDate, futureWeeksForShipping, currentDateOverride]);

  return typedSettings.allow_future_delivery_dates ? (
    <BlockStack>
      {checkoutNotice ? (
        <Banner status={checkoutNotice.type} title={checkoutNotice.text} />
      ) : null}

      <ChoiceList
        name="ship-setting"
        value={shipSetting}
        onChange={onChangeShipSetting}
      >
        <BlockStack>
          {
            isLoadingCartShippingPlans ? (
              <SkeletonText inlineSize="large" />
            ) : (
              <>
                <Choice id="ASAP">Ship Now</Choice>
                {canShipOnFutureDate ? (
                  <>
                    <Choice id="FutureDate">Future Date</Choice>
                    <Choice id="WeekOf">Specific Week</Choice>
                  </>
                ) : null}
              </>
            )
          }
          
        </BlockStack>
      </ChoiceList>

      {(shipSetting === 'ASAP' && typedSettings.show_date_override_textbox) ? (
        <BlockStack>
          <TextBlock>Override current date</TextBlock>
          <DatePicker
            selected={currentDateOverride}
            onChange={setCurrentDateOverride}
          />
        </BlockStack>
      ) : null}

      {shipSetting === "FutureDate" ? (
        <DatePicker
          selected={selectedDate}
          onChange={setShippingMethodFutureDate}
          disabled={[
            { end: dateAsYmd(new Date()) },
            ...blackoutDates,
            { start: dateAsYmd(addDays(new Date(), maxDaysForFutureDelivery)) },
          ]}
          defaultYearMonth={{
            month: +firstAvailableDate.split("-")[1],
            year: +firstAvailableDate.split("-")[0],
          }}
        />
      ) : null}
      {shipSetting === "WeekOf" ? (
        <InlineStack spacing="base">
          <ChoiceList
            name="week-of-month"
            variant="group"
            value={selectedWeek.month}
            onChange={(value: string) => {
              setShippingMethodWeekOf(futureWeeksForShipping[value][0]);
            }}
          >
            {Object.keys(futureWeeksForShipping).map((month) => (
              <Choice key={month} id={month}>
                {month}
              </Choice>
            ))}
          </ChoiceList>
          <ChoiceList
            name="week-of-week"
            variant="group"
            value={selectedWeek.displayTitle}
            onChange={(value: string) =>
              setShippingMethodWeekOf(
                Object.values(futureWeeksForShipping)
                  .flatMap((x) => x)
                  .find((week) => week.displayTitle === value)
              )
            }
          >
            {futureWeeksForShipping[selectedWeek.month].map((week) => (
              <Choice key={week.displayTitle} id={week.displayTitle}>
                {week.displayTitle}
              </Choice>
            ))}
          </ChoiceList>
        </InlineStack>
      ) : null}
    </BlockStack>
  ) : null;
}
