# Banner Component

Informs merchants about important changes or persistent conditions.

## Usage
```tsx
import {Banner} from '@shopify/polaris';

// Default (info)
<Banner title="Order archived" onDismiss={() => {}}>
  <p>This order was archived on March 7, 2017.</p>
</Banner>

// Success
<Banner title="Order fulfilled" tone="success" onDismiss={() => {}}>
  <p>All items have been fulfilled.</p>
</Banner>

// Warning
<Banner title="Inventory low" tone="warning">
  <p>Some items are running low on stock.</p>
</Banner>

// Critical
<Banner title="Payment failed" tone="critical">
  <p>Unable to process payment.</p>
</Banner>

// With action
<Banner
  title="Set up payments"
  tone="warning"
  action={{content: 'Set up', onAction: () => {}}}
>
  <p>Set up a payment provider to accept payments.</p>
</Banner>
```

## Tones
- Default (info): General information
- `success`: Success messages
- `warning`: Warning messages
- `critical`: Errors/critical issues

## Key Props
- `title`: Banner title
- `tone`: success | info | warning | critical
- `onDismiss`: Callback for dismiss button
- `action`: Primary action button
- `secondaryAction`: Secondary action
- `icon`: Custom icon (major only)
- `hideIcon`: Remove status icon

## Placement
- Full page: Top of page, below header
- Section: Inside card/popover/modal, below section heading
- Dismissible unless containing critical information

Source: https://polaris-react.shopify.com/components/feedback-indicators/banner
