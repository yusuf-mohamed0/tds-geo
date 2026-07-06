# Spinner Component

Notify merchants that their action is being processed.

## Usage
```tsx
import {Spinner} from '@shopify/polaris';

// Large (default)
<Spinner accessibilityLabel="Loading" size="large" />

// Small (use in buttons, inline)
<Spinner accessibilityLabel="Saving" size="small" />

// With focus management
<Spinner accessibilityLabel="Loading results" hasFocusableParent />
```

## Key Props
- `size`: 'small' | 'large' (defaults to 'large')
- `accessibilityLabel`: Required - describes the loading state
- `hasFocusableParent`: Set when parent is focusable for proper ARIA roles

## Best Practices
- Use for content that can't use skeleton components (charts, graphs)
- Not for full page loads (use SkeletonPage)
- Small + white for use on buttons
- Accurate accessibility labels ("Loading", "Submitting", "Processing")

Source: https://polaris-react.shopify.com/components/feedback-indicators/spinner
