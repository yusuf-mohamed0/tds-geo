# Tabs Component

Use to alternate among related views within the same context.

## Usage
```tsx
import {Tabs, Card} from '@shopify/polaris';
import {useState, useCallback} from 'react';

function MyTabs() {
  const [selected, setSelected] = useState(0);
  const handleTabChange = useCallback(
    (selectedTabIndex) => setSelected(selectedTabIndex),
    [],
  );

  const tabs = [
    {id: 'all', content: 'All', panelID: 'all-content'},
    {id: 'active', content: 'Active', panelID: 'active-content'},
    {id: 'draft', content: 'Draft', panelID: 'draft-content'},
  ];

  return (
    <Card padding="0">
      <Tabs tabs={tabs} selected={selected} onSelect={handleTabChange}>
        <Card.Section title={tabs[selected].content}>
          <p>Tab {selected} selected</p>
        </Card.Section>
      </Tabs>
    </Card>
  );
}
```

## Key Props
- `tabs`: Array of {id, content, accessibilityLabel, panelID}
- `selected`: Index of currently selected tab
- `onSelect`: Callback when tab changes
- `fitted`: Fit tabs to container width
- `disabled`: Disable all tabs
- `canCreateNewView`: Show "create new view" tab
- `disclosureText`: Custom text for overflow disclosure

## Best Practices
- Represent the same kind of content (different filters on same list)
- Only one active at a time
- Don't force jumping back and forth
- Not for primary navigation
- Short, scannable labels (single word preferred)

Source: https://polaris-react.shopify.com/components/navigation/tabs
