import type {
  FunctionRunResult,
  RunInput
} from "../generated/api";

const EMPTY_DISCOUNT: FunctionRunResult = {
  discounts: [],
};

const DISCOUNTED_METHOD_KEY = 'Overnight';
const ORDER_MINIMUM = 60;
const ORDER_MAXIMUM = 600;

const lineContainsStrawberries = (cartLine: RunInput['cart']['lines'][number]) => cartLine.merchandise.__typename === 'ProductVariant' && cartLine.merchandise.product.productType === 'Strawberry';
const cartContainsStrawberries = (cart: RunInput['cart']) => cart.lines.some(lineContainsStrawberries);

export function run(input: RunInput): FunctionRunResult {
  // check for strawberries
  if (cartContainsStrawberries(input.cart)) {
    return EMPTY_DISCOUNT;
  }

  // check discount min/max
  if (input.cart.cost.subtotalAmount.amount < ORDER_MINIMUM || input.cart.cost.subtotalAmount.amount > ORDER_MAXIMUM) {
    return EMPTY_DISCOUNT;
  }

  const applicableDeliveryOption = input.cart.deliveryGroups.flatMap(group => group.deliveryOptions).find(option => option.title?.includes(DISCOUNTED_METHOD_KEY));

  return applicableDeliveryOption ? {
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
  } : EMPTY_DISCOUNT;
};