import { z } from 'zod';
import { contributionCompanySchema } from './contributions';
import { githubLoginSchema, normalizeGithubLogin } from './github-account';
import { calendarDateSchema } from './reporting-period';

/**
 * Company attribution for database sources: the company each GitHub account belongs to, from the
 * maintainers' "Github Mapping – User List" sheet (`npm run data:companies`). It carries lowercased
 * logins, company ids and display names only. An account it does not list is Unmapped.
 */

/**
 * Company ids are bare ASCII slugs, stored in saved scopes and URLs, and permanent: a refresh keeps
 * an existing company's id, matched by its spelling key, even if its chosen display name changes. A
 * company whose spelling key changes (a real rename) gets a new id, and the import lists the id it
 * drops. `unmapped` is the Unmapped bucket's URL token.
 */
export const companyMappingIdSchema = z
  .string()
  .max(200)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Expected a lowercase ASCII slug')
  .refine((id) => id !== 'unmapped', 'The id unmapped is reserved for Unmapped company');
const mappedLoginSchema = githubLoginSchema.refine(
  (login) => login === normalizeGithubLogin(login),
  'Expected a lowercased GitHub login',
);

export const companyMappingSchema = z
  .object({
    format: z.literal(1),
    /** The sheet export's date; null only for the empty mapping, which connects nothing. */
    exportedOn: calendarDateSchema.nullable(),
    companies: z.array(contributionCompanySchema.extend({ id: companyMappingIdSchema })),
    accounts: z.record(mappedLoginSchema, companyMappingIdSchema),
  })
  .strict()
  .superRefine((mapping, context) => {
    const listed = new Set<string>();
    mapping.companies.forEach((company, index) => {
      if (listed.has(company.id))
        context.addIssue({
          code: 'custom',
          path: ['companies', index, 'id'],
          message: 'Duplicate company id: ' + company.id,
        });
      listed.add(company.id);
    });
    const referenced = new Set<string>();
    for (const [login, companyId] of Object.entries(mapping.accounts)) {
      referenced.add(companyId);
      if (!listed.has(companyId))
        context.addIssue({
          code: 'custom',
          path: ['accounts', login],
          message: 'Unknown company id: ' + companyId,
        });
    }
    mapping.companies.forEach((company, index) => {
      if (!referenced.has(company.id))
        context.addIssue({
          code: 'custom',
          path: ['companies', index],
          message: 'No account belongs to company ' + company.id,
        });
    });
    const empty = mapping.companies.length === 0 && referenced.size === 0;
    if ((mapping.exportedOn === null) !== empty)
      context.addIssue({
        code: 'custom',
        path: ['exportedOn'],
        message: 'Only a mapping with no companies and no accounts has no export date',
      });
  });
export type CompanyMapping = z.infer<typeof companyMappingSchema>;
