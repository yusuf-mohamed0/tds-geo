# App Provider

**Required component** that enables sharing global settings throughout the hierarchy of your application.

## Usage
```tsx
import {AppProvider} from '@shopify/polaris';
import translations from '@shopify/polaris/locales/en.json';

function App() {
  return (
    <AppProvider i18n={translations} theme="dark-experimental">
      {/* App content */}
    </AppProvider>
  );
}
```

## Key Props
- `i18n`: Translation dictionary (required - import from `@shopify/polaris/locales/en.json`)
- `theme`: "light" | "light-mobile" | "light-high-contrast-experimental" | "dark-experimental"
- `linkComponent`: Custom component for links (for use with react-router)
- `features`: Feature flags

## Best Practices
- Wrap the root of your application
- Required for Polaris components to function correctly
- Provide translations via the i18n prop

Source: https://polaris-react.shopify.com/components/utilities/app-provider
