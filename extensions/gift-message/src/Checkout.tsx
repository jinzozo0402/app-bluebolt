import {
  BlockStack,
  Checkbox,
  TextField,
  reactExtension,
  useApplyAttributeChange,
  useBuyerJourneyIntercept,
  useSettings,
} from '@shopify/ui-extensions-react/checkout';
import type { Interceptor } from '@shopify/ui-extensions/build/ts/surfaces/checkout/api/standard/standard';
import { useCallback, useEffect, useState } from 'react';

interface Settings {
  max_lines?: number;
  max_lines_error?: string;
  max_chars_per_line?: number;
  max_chars_per_line_error?: string;
}

const giftMessageAttributeName = 'giftMessage';

const errorForGiftMessage = (giftMessage: string, settings: Settings): string | undefined => {
  const lines = giftMessage.split(/\n/);
  if (settings.max_lines && lines.length > settings.max_lines) {
    return settings.max_lines_error ?? `The gift message can only be up to ${settings.max_lines} lines long.`;
  }

  if (settings.max_chars_per_line && lines.some(line => line.trim().length > settings.max_chars_per_line)) {
    return settings.max_chars_per_line_error ?? `Each line of the gift message can only be ${settings.max_chars_per_line} characters long.`;
  }

  return undefined;
}

export default reactExtension(
  'purchase.checkout.block.render',
  () => <Extension />,
);

function Extension() {
  const [hasGiftNote, setHasGiftNote] = useState(false);
  const [giftNote, setGiftNote] = useState('');
  const [error, setError] = useState<string | undefined>();
  const applyAttributeChange = useApplyAttributeChange();
  const settings = useSettings() as Settings;

  const interceptCallback: Interceptor = useCallback(({ canBlockProgress }) => {
    if (!canBlockProgress) {
      console.error('You need to be able to block progress');
      return;
    }

    if (error) {
      return {
        behavior: 'block',
        reason: 'Please make sure the gift message is valid.'
      };
    } else {
      return {
        behavior: 'allow'
      }
    }
  }, [error]);

  // don't let the user continue if there's an error
  useBuyerJourneyIntercept(interceptCallback);

  useEffect(() => {
    if (hasGiftNote) {
      const errorMessage = errorForGiftMessage(giftNote, settings);
      setError(errorMessage);

      if (errorMessage) {
        return;
      }

      applyAttributeChange({
        key: giftMessageAttributeName,
        value: giftNote,
        type: 'updateAttribute'
      }); // note: no need to debounce since Shopify only fires an update when the user leaves the textbox (not when they update any character)
    } else {
      setGiftNote('');
      applyAttributeChange({
        key: giftMessageAttributeName,
        value: '',
        type: 'updateAttribute'
      });
    }
  }, [hasGiftNote, giftNote, setGiftNote, applyAttributeChange, settings]);

  const handleTextInput = useCallback((value: string) => {
    setError(errorForGiftMessage(value, settings)); // if there's an error set it (no error will set it to undefined)
  }, [settings, setError]);

  return (
    <BlockStack>
      <Checkbox
        name="has-gift-note"
        checked={hasGiftNote}
        onChange={setHasGiftNote}
      >
        Add a gift message
      </Checkbox>
      {
        hasGiftNote ?
          <TextField
            name="gift-note"
            label="Gift Message"
            onChange={setGiftNote}
            multiline={settings.max_lines ?? 5}
            error={error}
            onInput={handleTextInput}
          />
        : null
      }
    </BlockStack>
  );
}