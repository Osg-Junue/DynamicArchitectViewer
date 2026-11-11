import infraHaFailover from '../../../../examples/01-infra-ha-failover.dav?raw';
import screenFlowCheckout from '../../../../examples/02-screen-flow-checkout.dav?raw';
import eventDrivenAsync from '../../../../examples/03-event-driven-async.dav?raw';
import enterpriseZeroTrustPayment from '../../../../examples/04-enterprise-zero-trust-payment.dav?raw';
import sequencePaymentRetry from '../../../../examples/05-sequence-payment-retry.dav?raw';
import lanOfficeNetwork from '../../../../examples/06-lan-office-network.dav?raw';
import dynamicArchitectViewer from '../../../../examples/07-dynamic-architect-viewer.dav?raw';

export interface SampleTemplate {
  id: string;
  name: string;
  category: 'infra' | 'screen';
  description: string;
  dsl: string;
}

export const SAMPLE_TEMPLATES: readonly SampleTemplate[] = [
  {
    id: 'infra-ha-failover',
    name: 'Infrastructure: redundant web stack and database failover',
    category: 'infra',
    description:
      'CDN, load balancer, API, Redis cache and primary/standby databases, with normal traffic and a failover',
    dsl: infraHaFailover,
  },
  {
    id: 'screen-flow-checkout',
    name: 'Screen flow with API calls: sign-in to checkout',
    category: 'screen',
    description: 'Screen transitions together with the backend calls behind them',
    dsl: screenFlowCheckout,
  },
  {
    id: 'event-driven-async',
    name: 'Microservices: event-driven async pipeline',
    category: 'infra',
    description: 'A queue, a worker and object storage for slow background jobs',
    dsl: eventDrivenAsync,
  },
  {
    id: 'enterprise-zero-trust-10anim',
    name: 'Large system: zero-trust payments and AI fraud detection',
    category: 'infra',
    description: 'A long flow across five zones, with a fraud case that rolls back',
    dsl: enterpriseZeroTrustPayment,
  },
  {
    id: 'sequence-payment-retry',
    name: 'Sequence: payment retries and async delivery',
    category: 'infra',
    description:
      'Rate limiting, retries with backoff, and a dead letter queue, with icons on packets',
    dsl: sequencePaymentRetry,
  },
  {
    id: 'lan-office-network',
    name: 'Office LAN: site-to-site VPN and link failover',
    category: 'infra',
    description: 'Switches, Wi-Fi, a printer and a file server, with a VPN and failover to LTE',
    dsl: lanOfficeNetwork,
  },
  {
    id: 'dynamic-architect-viewer',
    name: 'Software pipeline: DSL parsing, live preview and HTML export',
    category: 'infra',
    description:
      'How this extension turns a .dav file into a live preview and a standalone HTML file',
    dsl: dynamicArchitectViewer,
  },
];

export const DEFAULT_SAMPLE: SampleTemplate = SAMPLE_TEMPLATES[0] ?? {
  id: 'default',
  name: 'Default',
  category: 'infra',
  description: '',
  dsl: 'dav 1\n',
};
