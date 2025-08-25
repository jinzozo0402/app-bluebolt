import type {
  RunInput,
  FunctionRunResult,
} from "../generated/api";
import deliveryModificationsFromCheckout from "./modifications/fromCheckout";

//type Configuration = {};

// to get this to work, I needed to:
// 1. create the app from Shopify CLI
// 2. install the app
// 3. create the extension for delivery customization
// 4. npm run deploy
// 5. add the delivery customization via GraphQL (see https://shopify.dev/docs/apps/checkout/delivery-shipping/delivery-customizations/getting-started)

// for configuration see: https://shopify.dev/docs/apps/checkout/delivery-shipping/delivery-customizations/config

export function run(input: RunInput): FunctionRunResult {
  console.log('input');
  console.log(JSON.stringify(input, null, 4));

  return {
    operations: [
      ...deliveryModificationsFromCheckout(input)
    ]
  };
};
