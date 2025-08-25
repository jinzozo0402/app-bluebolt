import {
  reactExtension,
  useDiscountCodes
} from "@shopify/ui-extensions-react/checkout";

// 1. Choose an extension target
export default reactExtension("purchase.checkout.block.render", () => (
  <Extension />
));

function Extension() {
  const discountCodes = useDiscountCodes();

  console.log('applied discount codes', discountCodes);

  return null;
}