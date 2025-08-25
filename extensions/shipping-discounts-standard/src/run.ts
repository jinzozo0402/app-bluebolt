import type {
  FunctionRunResult,
  RunInput
} from "../generated/api";

const EMPTY_DISCOUNT: FunctionRunResult = {
  discounts: [],
};

const DISCOUNTED_METHOD_KEY = 'Standard';

const lineContainsStrawberries = (cartLine: RunInput['cart']['lines'][number]) => cartLine.merchandise.__typename === 'ProductVariant' && cartLine.merchandise.product.productType === 'Strawberry';
const cartContainsStrawberries = (cart: RunInput['cart']) => cart.lines.some(lineContainsStrawberries);

export function run(input: RunInput): FunctionRunResult {
  // check for strawberries
  if (cartContainsStrawberries(input.cart)) {
    return EMPTY_DISCOUNT;
  }

  const deliveryOptions = input.cart.deliveryGroups.flatMap(group => group.deliveryOptions);
  
  const applicableDeliveryOption = deliveryOptions.find(option => option.title?.includes(DISCOUNTED_METHOD_KEY) && !option.title.startsWith('Free:'));
  if (!applicableDeliveryOption) {
    return EMPTY_DISCOUNT;
  }

  const applicableFreeOption = deliveryOptions.find(option => option.title === `Free: ${applicableDeliveryOption.title}`);
  if (!applicableFreeOption) {
    return EMPTY_DISCOUNT;
  }

  return {
    discounts: [
      {
        targets: [
          {
            deliveryOption: {
              handle: applicableDeliveryOption.handle
            }
          }
        ],
        value: {
          percentage: {
            value: 100
          }
        }
      }
    ]
  };
};