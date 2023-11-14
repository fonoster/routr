// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  tutorialSidebar: [
    {
      type: 'category',
      label: 'Overview',
      collapsible: true,
      collapsed: true,
      items: [
        'overview/introduction',
        'overview/architecture',
        'overview/concepts',
        'overview/deploy-with-docker',
      ],
    },
    {
      type: 'category',
      label: 'Development',
      collapsible: true,
      collapsed: true,
      items: [
        'development/introduction',
        'development/quick-start',
        'development/development-mode-with-gitpod',
        {
          type: 'category',
          label: 'Components',
          collapsible: true,
          collapsed: true,
          items: [
            'development/components/overview',
            'development/components/edgeport',
            'development/components/dispatcher',
            'development/components/location',
            'development/components/registry',
            'development/components/requester',
            'development/components/rtprelay',
            'development/components/apiserver',
            'development/components/simpleauth',
          ],
        },
        {
          type: 'category',
          label: 'Alterations API',
          collapsible: true,
          collapsed: true,
          items: [
            'development/alterations/overview',
            'development/alterations/methods',
          ],
        },
        'development/building-a-processor',
        'development/building-a-middleware',
        'development/custom-data-with-the-apiserver',
        'development/extending-the-ctl',
        // 'development/testing-with-seet',
        // 'development/metrics-events-logs-and-traces',
        // 'development/building-a-chat-application',
        // 'development/building-a-scaip-processor',
      ],
    },
    {
      type: 'category',
      label: 'Connect Mode',
      collapsible: true,
      collapsed: true,
      items: [
        'connect/introduction',
        'connect/concepts',
        {
          type: 'category',
          label: 'Quick Start',
          collapsible: true,
          collapsed: true,
          items: [
            'connect/quick-start/docker',
            'connect/quick-start/kubernetes',
          ]
        },
        {
          type: 'category',
          label: 'Command-Line Tool',
          collapsible: true,
          collapsed: true,
          items: [
            'connect/command-line/overview',
            'connect/command-line/ctl',
          ]
        },
        {
          type: 'category',
          label: 'Node.js SDK',
          collapsible: true,
          collapsed: true,
          items: [
            'connect/nodesdk/overview',
            'connect/nodesdk/sdk',
          ]
        },
        'connect/home-or-office-setup',
        'connect/webrtc-support',
        'connect/securing-the-server',
        'connect/sending-call-events-to-nats'
      ],
    },
    // {
    //   type: 'category',
    //   label: 'Enterprise',
    //   collapsible: true,
    //   collapsed: true,
    //   items: [
    //     'enterprise/connecting-routr-to-aws-chime',
    //     'enterprise/connecting-routr-microsoft-teams',
    //     'enterprise/siprecording-with-routr+rtpengine',
    //   ]
    // },    
    // {
    //   type: 'category',
    //   label: 'Tutorials',
    //   collapsible: true,
    //   collapsed: true,
    //   items: [
    //     'tutorials/load-balancing-asterisk-with-routr',
    //     'tutorials/intercom-system-with-routr-and-kubernetes',
    //     'tutorials/ephemeral-agents-in-the-browser',
    //     'tutorials/deploying-to-civo-with-helm',
    //     'tutorials/deploying-to-docker-desktop-with-helm',
    //     'tutorials/connecting-routr-to-twilio',
    //   ]
    // },
    'community',
    'contributing',
    'faqs',
    'changelog'
  ],
};

module.exports = sidebars;
