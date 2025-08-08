import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

export const baseOptions: BaseLayoutProps = {
  // Navigation is now handled by the comprehensive Navbar component
  // This keeps the layout config minimal and focused on docs-specific settings
  links: [],
  nav: {
    enabled: false, // Disable fumadocs navigation since we use our custom Navbar
  },
};
