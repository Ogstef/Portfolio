import { getFrameAtDistance } from '@/lib/trackPath'
import { SIGN_APPROACH } from '@/components/scene/sceneConstants'

export type Project = {
  id: string
  title: string
  position: [number, number, number]        // road-centerline trigger point (arc-length distance baked to world XYZ)
  signPosition: [number, number, number]     // baked world position of the sign/pole anchor
  cameraApproach: [number, number, number]   // baked world position FollowCamera parks at in sign mode
  triggerRadius: number
  signX: number   // billboard offset from centerline along the curve's "right" vector: -7 = left of road, +7 = right
  accent: string  // brand color for this project's billboard + thumbnail
  tagline: string
  description: string
  highlights: string[]
  stack: string[]
  links?: { label: string; url: string }[]
}

// The only literals a human tunes per project: the arc-length distance along
// the track and signX. Everything else is derived from the curve's frame at
// that distance (see lib/trackPath.ts).
function stopAt(distance: number, signX: number) {
  const { position, tangent, right } = getFrameAtDistance(distance)
  const side = Math.sign(signX)
  const signPos = position.clone().addScaledVector(right, signX)
  const cameraApproach = position
    .clone()
    .addScaledVector(right, -side * SIGN_APPROACH)
    .addScaledVector(tangent, -4)
  return {
    position: [position.x, position.y, position.z] as [number, number, number],
    signPosition: [signPos.x, signPos.y, signPos.z] as [number, number, number],
    cameraApproach: [cameraApproach.x, 5, cameraApproach.z] as [number, number, number],
  }
}

export const projects: Project[] = [
  {
    id: 'ledgerx',
    title: 'LedgerX',
    ...stopAt(30, -7),
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
    ...stopAt(90, 7),
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
    // Past TRIGONO_GAP's downRampEnd (172) — this stop is only reachable by
    // clearing that canyon jump (see lib/gapJump.ts).
    ...stopAt(187, -7),
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
    // Past GUMROAD_GAP's downRampEnd (292) — this stop is only reachable by
    // clearing that canyon jump (see lib/gapJump.ts); there's no ground to
    // drive around it on.
    ...stopAt(307, 7),
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
      { label: 'X/Twitter thread', url: 'https://x.com/theDogeg48/status/2089769164093161767' },
      { label: 'Dev.to article', url: 'https://dev.to/thedogeg48/java-spring-boot-performance-issues-and-solutions-5ege' },
    ],
  },
]
