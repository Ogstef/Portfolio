export type Project = {
  id: string
  title: string
  position: [number, number, number]
  triggerRadius: number
  signX: number   // billboard X offset: -7 = left of road, +7 = right
  accent: string  // brand color for this project's billboard + thumbnail
  tagline: string
  description: string
  highlights: string[]
  stack: string[]
  links?: { label: string; url: string }[]
}

export const projects: Project[] = [
  {
    id: 'ledgerx',
    title: 'LedgerX',
    position: [0, 0, 30],
    triggerRadius: 8,
    signX: -7,
    accent: '#38bdf8',
    tagline: 'CQRS / Event Sourcing banking ledger',
    description:
      'A portfolio project built to demonstrate advanced backend architecture patterns. LedgerX implements a full CQRS + Event Sourcing ledger service: commands mutate state via an append-only event store, projections rebuild read models from the event log, and the API separates reads from writes entirely. Built as a deliberate signal toward senior-engineering roles.',
    highlights: [
      'Append-only event store with optimistic concurrency control',
      'Projection rebuilds from arbitrary historical snapshots',
      'Command/query bus with explicit handler registration',
      'Full audit trail — every balance change is a first-class event',
    ],
    stack: ['Java', 'Spring Boot', 'PostgreSQL', 'Axon Framework'],
  },
  {
    id: 'eurobank-crm',
    title: 'Eurobank CRM Migration',
    position: [0, 0, 90],
    triggerRadius: 8,
    signX: 7,
    accent: '#f97316',
    tagline: 'Legacy AOP → modern CRM · via Accenture',
    description:
      'A large-scale migration from a legacy AOP-based customer system to a modern CRM database, delivered as a consultant at Accenture. Involved 15+ Spring Boot microservices handling customer management across multiple countries. No source code can be shared (client work), but the scale and technical decisions are the story.',
    highlights: [
      '15+ microservices across multi-country customer management',
      'JPQL query optimisation — N+1 elimination, JOIN FETCH, pagination',
      'JPA/Hibernate best practices: lazy loading, entity graphs',
      'MapStruct for DTO mapping, Flyway for migrations, Spock/Groovy for testing',
    ],
    stack: ['Java', 'Spring Boot', 'JPA/Hibernate', 'MapStruct', 'Flyway', 'Spock'],
  },
  {
    id: 'trigono',
    title: 'Trigono Website',
    position: [0, 0, 130],
    triggerRadius: 8,
    signX: -7,
    accent: '#22c55e',
    tagline: 'Demo restaurant site · Next.js + Tailwind · live on Vercel',
    description:
      'A demo restaurant website — proof of full-stack and frontend ability alongside the backend focus. Designed and built end to end: layout, content, responsiveness, deployment. Live at trigono-website.vercel.app.',
    highlights: [
      'Full responsive layout with Tailwind CSS',
      'Next.js App Router, TypeScript throughout',
      'Deployed and live on Vercel',
    ],
    stack: ['Next.js', 'TypeScript', 'Tailwind CSS', 'Vercel'],
    links: [{ label: 'Live site', url: 'https://trigono-website.vercel.app' }],
  },
  {
    id: 'gumroad',
    title: 'Gumroad Storefront',
    position: [0, 0, 170],
    triggerRadius: 8,
    signX: 7,
    accent: '#a855f7',
    tagline: 'Digital products published during military service',
    description:
      'Digital products written and shipped during mandatory military service: a JPQL performance guide for Java developers, and anafora.html — an offline single-file HTML/JS/localStorage military personnel tracker designed to run via Microsoft Edge on an iPhone with zero server dependency.',
    highlights: [
      'JPQL performance guide: practical query tuning for Spring Boot devs',
      'anafora.html: fully offline, zero-install, localStorage-backed tracker',
      'Shipped and selling on Gumroad while in active service',
    ],
    stack: ['HTML', 'JavaScript', 'localStorage', 'Gumroad'],
    links: [
      { label: 'X/Twitter thread', url: 'https://x.com' },
      { label: 'Dev.to article', url: 'https://dev.to' },
    ],
  },
]
