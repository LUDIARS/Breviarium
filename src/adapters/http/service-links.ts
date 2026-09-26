// @implements SPEC-br-web-ui
import type { Project } from '../../registry/domain/model.ts';
import { type LinkedService, LINKED_SERVICES, type ServiceLinkBases, type ServiceLinkConfig } from '../config/service-links-config.ts';
import type { AccessLevel } from './http-types.ts';

/** One link out to a service (a plain link: Breviarium does not proxy or embed the service). */
export interface ServiceLink {
  readonly service: LinkedService;
  readonly label: string;
  readonly href: string;
}

const LABELS: Readonly<Record<LinkedService, string>> = {
  praeforma: 'Praeforma で開く',
  anatomia: 'Anatomia で開く',
  actio: 'Actio の計画を開く',
};

/**
 * The path inside each service, taken from its own web routes (spec/feature/web-ui.md): Praeforma's project page
 * `projects/:pid`, Anatomia's project deep link `/?project=<id>`, Actio's planning page `/tasks/planning` (the team
 * is chosen on the page, it reads no query). Without the binding the link opens the service's top page.
 */
function pathOf(service: LinkedService, project: Project): string {
  const b = project.bindings;
  if (service === 'praeforma') return b.praeformaProjectId ? `/projects/${encodeURIComponent(b.praeformaProjectId)}` : '/';
  if (service === 'anatomia') return b.anatomiaProject ? `/?project=${encodeURIComponent(b.anatomiaProject)}` : '/';
  return '/tasks/planning';
}

/** Links for one project, in the fixed service order; a service without a base URL gets none. */
export function serviceLinks(project: Project, bases: ServiceLinkBases): ServiceLink[] {
  return LINKED_SERVICES.flatMap((service) => {
    const base = bases[service];
    return base ? [{ service, label: LABELS[service], href: `${base}${pathOf(service, project)}` }] : [];
  });
}

/** Loopback users get the topology URLs, Access viewers the public ones; without configuration there are no links. */
export function linkBasesFor(config: ServiceLinkConfig | undefined, level: AccessLevel): ServiceLinkBases {
  return config ? config[level] : {};
}
