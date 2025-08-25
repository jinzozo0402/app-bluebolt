import type {
  RunInput,
  FunctionRunResult,
  FunctionError,
} from "../generated/api";

// tutorial: https://shopify.dev/docs/apps/checkout/validation/server-side
// to activate: go to checkout rules, click "add rule", then add this rule and activate it

const poBoxPatterns = [
  /pobox/,
  /postofficebox/
];

const addressContainsPoBox = (address1: string) => {
  const normalizedAddress = address1.toLowerCase().replace(/[^a-zA-Z]/g, '');

  return poBoxPatterns.some(pattern => normalizedAddress.match(pattern));
}

export function run(input: RunInput): FunctionRunResult {
  /*
  // block PO boxes
  const addressLine1 = input.cart.deliveryGroups[0].deliveryAddress?.address1 ?? '';
  const addressLine2 = input.cart.deliveryGroups[0].deliveryAddress?.address1 ?? '';

  if (addressContainsPoBox(addressLine1) || addressContainsPoBox(addressLine2)) {
    return {
      errors: [
        {
          localizedMessage: 'We cannot deliver to post office boxes. Please provide a physical address.',
          target: 'address1'
        }
      ]
    }
  } else {
    return {
      errors: [
      ]
    }
  }
  */

  return {
    errors: []
  };
};