import type { RunInput, Operation } from "../../generated/api";

interface AvailableShippingMethod {
  name: string;
  days: string;
}

// helpers
const titleForShippingMethod = (shippingMethod: AvailableShippingMethod) =>
  shippingMethod.name;

const deliveryModificationsFromCheckout = (input: RunInput): Operation[] => {
  const shippingMethodsShown = input.cart.availableShippingMethods?.value ? 
    JSON.parse(input.cart.availableShippingMethods?.value ?? '[]') as AvailableShippingMethod[] :
    [];

  return input.cart.deliveryGroups[0].deliveryOptions.map(shippingMethod => {
    // find the shipping method provided by the checkout UI (the ASAP/future date selector)
    const relevantCheckoutProvidedShippingMethod = shippingMethodsShown.find(option => option.name === shippingMethod.title);

    if (relevantCheckoutProvidedShippingMethod) { // if the method IS marked as available, then rename it to show the amount of days
      return {
        rename: {
          deliveryOptionHandle: shippingMethod.handle,
          title: titleForShippingMethod(relevantCheckoutProvidedShippingMethod)
        }
      };
    } else { // if the method isn't marked as available (i.e. not in the list) from the selector, hide it from the available list
      return {
        hide: {
          deliveryOptionHandle: shippingMethod.handle
        }
      };
    }
  });
}

export default deliveryModificationsFromCheckout;
