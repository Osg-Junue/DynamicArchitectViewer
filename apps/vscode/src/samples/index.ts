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
  dsl: string;
}

export const SAMPLE_TEMPLATES: readonly SampleTemplate[] = [
  {
    id: 'infra-ha-failover',
    name: 'Infrastructure: redundant web stack and database failover',
    dsl: infraHaFailover,
  },
  {
    id: 'screen-flow-checkout',
    name: 'Screen flow with API calls: sign-in to checkout',
    dsl: screenFlowCheckout,
  },
  {
    id: 'event-driven-async',
    name: 'Microservices: event-driven async pipeline',
    dsl: eventDrivenAsync,
  },
  {
    id: 'enterprise-zero-trust-10anim',
    name: 'Large system: zero-trust payments and AI fraud detection',
    dsl: enterpriseZeroTrustPayment,
  },
  {
    id: 'sequence-payment-retry',
    name: 'Sequence: payment retries and async delivery',
    dsl: sequencePaymentRetry,
  },
  {
    id: 'lan-office-network',
    name: 'Office LAN: site-to-site VPN and link failover',
    dsl: lanOfficeNetwork,
  },
  {
    id: 'dynamic-architect-viewer',
    name: 'Software pipeline: DSL parsing, live preview and HTML export',
    dsl: dynamicArchitectViewer,
  },
];

export const DEFAULT_SAMPLE: SampleTemplate = SAMPLE_TEMPLATES[0] ?? {
  id: 'default',
  name: 'Default',
  dsl: 'dav 1\n',
};
