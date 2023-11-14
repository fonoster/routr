// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const lightCodeTheme = require('prism-react-renderer/themes/github');
const darkCodeTheme = require('prism-react-renderer/themes/dracula');

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Routr Docs',
  tagline: 'The future of programmable SIP servers',
  favicon: 'img/favicon.ico',

  // Set the production url of your site here
  url: 'https://routr.io',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'fonoster', // Usually your GitHub org/user name.
  projectName: 'routr', // Usually your repo name.

  onBrokenLinks: 'warn',
  onBrokenMarkdownLinks: 'warn',

  // Even if you don't use internalization, you can use this field to set useful
  // metadata like html lang. For example, if your site is Chinese, you may want
  // to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  // Needs gtag
  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          lastVersion: 'current',
          versions: {
            current: {
              label: '2.0.0',
              path: '2.0.0',
            },
          },
          sidebarPath: require.resolve('./sidebars.js'),
          // Remove this to remove the "edit this page" links.
          editUrl:
            'https://github.com/fonoster/routr-website/edit/main',
        },
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
        gtag: {
          trackingID: 'G-JX93S6PKN4',
          anonymizeIP: true,
        },
      })
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      // Replace with your project's social card
      image: 'img/docusaurus-social-card.jpg',
      navbar: {
        logo: {
          alt: 'Routr Logo',
          src: 'img/logo.svg',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'tutorialSidebar',
            position: 'left',
            label: 'Docs',
          },
          {
            href: 'https://fonoster.gumroad.com/l/the-future-of-programmable-sip-servers',
            label: 'Training',
            position: 'left',
          },
          {
            type: 'docsVersionDropdown',
            position: 'right',
            // dropdownItemsAfter: [{to: '/versions', label: 'All versions'}],
            dropdownActiveClassDisabled: true,
          },
          {
            href: 'https://github.com/fonoster/routr',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Quick Links',
            items: [
              {
                label: 'Docs',
                to: '/docs/2.0.0/overview/introduction',
              },
              {
                label: 'Training',
                href: 'https://fonoster.gumroad.com/l/the-future-of-programmable-sip-servers',
              }
            ],
          },
          {
            title: 'Community',
            items: [
              {
                label: 'GitHub Discussions',
                href: 'https://github.com/fonoster/routr/discussions',
              },
              {
                label: 'Discord',
                href: 'https://discord.gg/4QWgSz4hTC',
              },
              {
                label: 'Twitter',
                href: 'https://twitter.com/fonoster',
              },
            ],
          },
          {
            title: 'More',
            items: [
              {
                label: 'Blog',
                to: 'https://learn.fonoster.com/blog',
              },
              {
                label: 'GitHub',
                href: 'https://github.com/fonoster/routr',
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} Fonoster, Inc. Built with Docusaurus.`,
      },
      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
      },
      colorMode: {
        defaultMode: 'light',
        disableSwitch: true,
        respectPrefersColorScheme: false,
      },
    }),
};

module.exports = config;
