import {
  reactExtension,
  Text,
  useAttributeValues,
  useShippingOptionTarget
} from "@shopify/ui-extensions-react/checkout";

export interface AvailableShippingMethod {
  name: string;
  days: string;
}

export default reactExtension("purchase.checkout.shipping-option-item.render-after", () => (
  <Extension />
));

function Extension() {
  const target = useShippingOptionTarget();
  const [availableMethodsJson] = useAttributeValues(['availableMethods']);
  const availableMethods = availableMethodsJson ? JSON.parse(availableMethodsJson) as AvailableShippingMethod[]: [];

  const applicableMethodInfo = availableMethods.find(availableMethod => target.shippingOptionTarget.title === availableMethod.name);
  if (!applicableMethodInfo) {
    return null;
  }

  return (
    <Text appearance="subdued" size="small">{applicableMethodInfo.days}</Text>
  );
}