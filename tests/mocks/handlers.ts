import { http, HttpResponse } from 'msw';
import { faker } from '@faker-js/faker';

export function generateMockPR(number: number) {
  return {
    number,
    title: faker.lorem.sentence(),
    state: 'open',
    user: {
      login: faker.internet.username(),
      id: faker.number.int({ min: 1, max: 1000000 })
    },
    created_at: faker.date.past().toISOString(),
    updated_at: faker.date.recent().toISOString(),
    assignees: Array(faker.number.int({ min: 0, max: 3 }))
      .fill(null)
      .map(() => ({ login: faker.internet.username() })),
    requested_reviewers: Array(faker.number.int({ min: 0, max: 2 }))
      .fill(null)
      .map(() => ({ login: faker.internet.username() })),
    draft: faker.datatype.boolean(),
    merged_at: null,
    closed_at: null,
    base: {
      repo: {
        owner: { login: 'prebid' },
        name: 'test-repo'
      }
    }
  };
}

export function generateMockIssue(number: number) {
  return {
    number,
    title: faker.lorem.sentence(),
    state: 'open',
    user: {
      login: faker.internet.username(),
      id: faker.number.int({ min: 1, max: 1000000 })
    },
    created_at: faker.date.past().toISOString(),
    updated_at: faker.date.recent().toISOString(),
    assignees: Array(faker.number.int({ min: 0, max: 2 }))
      .fill(null)
      .map(() => ({ login: faker.internet.username() })),
    closed_at: null,
    closed_by: null,
    state_reason: null
  };
}

export const handlers = [
  http.get('https://api.github.com/repos/:owner/:repo/pulls', ({ request, params }) => {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const perPage = parseInt(url.searchParams.get('per_page') || '30');
    const state = url.searchParams.get('state') || 'open';
    
    if (state !== 'open') {
      return HttpResponse.json([]);
    }
    
    const totalItems = 150;
    const totalPages = Math.ceil(totalItems / perPage);
    const startIndex = (page - 1) * perPage;
    const endIndex = Math.min(startIndex + perPage, totalItems);
    
    const items = Array.from({ length: endIndex - startIndex }, (_, i) => 
      generateMockPR(startIndex + i + 1)
    );
    
    const headers = {
      'X-Total-Count': totalItems.toString(),
      'Link': page < totalPages ? 
        `<https://api.github.com/repos/${params.owner}/${params.repo}/pulls?page=${page + 1}>; rel="next"` : 
        ''
    };
    
    return HttpResponse.json(items, { headers });
  }),
  
  http.get('https://api.github.com/repos/:owner/:repo/issues', ({ request, params }) => {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const perPage = parseInt(url.searchParams.get('per_page') || '30');
    const state = url.searchParams.get('state') || 'open';
    
    if (state !== 'open') {
      return HttpResponse.json([]);
    }
    
    const totalItems = 75;
    const totalPages = Math.ceil(totalItems / perPage);
    const startIndex = (page - 1) * perPage;
    const endIndex = Math.min(startIndex + perPage, totalItems);
    
    const items = Array.from({ length: endIndex - startIndex }, (_, i) => 
      generateMockIssue(startIndex + i + 1)
    );
    
    const headers = {
      'X-Total-Count': totalItems.toString(),
      'Link': page < totalPages ? 
        `<https://api.github.com/repos/${params.owner}/${params.repo}/issues?page=${page + 1}>; rel="next"` : 
        ''
    };
    
    return HttpResponse.json(items, { headers });
  }),
  
  http.get('https://api.github.com/repos/:owner/:repo/pulls/:number/reviews', () => {
    return HttpResponse.json([]);
  }),
  
  http.get('https://api.github.com/repos/:owner/:repo/pulls/:number/commits', () => {
    const commits = Array(faker.number.int({ min: 1, max: 10 }))
      .fill(null)
      .map(() => ({
        sha: faker.git.commitSha(),
        commit: {
          author: {
            name: faker.person.fullName(),
            email: faker.internet.email()
          }
        },
        author: faker.datatype.boolean() ? {
          login: faker.internet.username()
        } : null
      }));
    
    return HttpResponse.json(commits);
  }),
  
  http.get('https://api.github.com/rate_limit', () => {
    return HttpResponse.json({
      resources: {
        core: {
          limit: 5000,
          remaining: 4500,
          reset: Math.floor(Date.now() / 1000) + 3600
        }
      }
    });
  })
];