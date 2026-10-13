import type { Board, Card, Column } from "@/types/board";

const SEED: [string, [string, string][]][] = [
  [
    "Backlog",
    [
      [
        "Research competitor onboarding flows",
        "Review sign-up and first-run experiences of three competing tools and note patterns worth borrowing.",
      ],
      [
        "Draft Q3 product roadmap",
        "Outline themes, key bets and rough sizing for the next quarter. Share with leads for early feedback.",
      ],
      [
        "Audit accessibility of settings page",
        "Check colour contrast, focus order and screen reader labels against WCAG 2.2 AA.",
      ],
    ],
  ],
  [
    "To Do",
    [
      [
        "Set up error monitoring",
        "Add error tracking to the web client and configure alerts for new issue spikes.",
      ],
      [
        "Write release notes for v2.4",
        "Summarise new features and fixes in plain language for the changelog and in-app banner.",
      ],
      [
        "Plan customer interview sessions",
        "Recruit five customers, book 30-minute calls and prepare a discussion guide.",
      ],
    ],
  ],
  [
    "In Progress",
    [
      [
        "Redesign pricing page",
        "Simplify plan comparison, add an FAQ section and highlight the annual discount.",
      ],
      [
        "Migrate image storage to CDN",
        "Move user uploads to the CDN bucket and update URLs. Keep the old bucket read-only for two weeks.",
      ],
    ],
  ],
  [
    "Review",
    [
      [
        "Password reset email template",
        "New branded template with clearer call to action. Needs copy and design sign-off.",
      ],
      [
        "Dashboard loading performance",
        "Lazy-load charts and cache summary queries. Initial render down from 3.2s to 1.1s.",
      ],
    ],
  ],
  [
    "Done",
    [
      [
        "Launch referral programme",
        "Referral links, reward tracking and the invite page are live for all accounts.",
      ],
      [
        "Fix timezone bug in reports",
        "Weekly reports now use the account timezone instead of UTC when grouping by day.",
      ],
      [
        "Onboard two new support agents",
        "Completed product training, shadowing sessions and access setup for the help desk.",
      ],
    ],
  ],
];

export const COLUMN_IDS = [
  "backlog",
  "todo",
  "in-progress",
  "review",
  "done",
] as const;

export function createSeedBoard(): Board {
  const cards: Record<string, Card> = {};
  const columns = SEED.map(([name, seedCards], i): Column => {
    const cardIds = seedCards.map(([title, details]) => {
      const id = crypto.randomUUID();
      cards[id] = { id, title, details };
      return id;
    });
    return { id: COLUMN_IDS[i], name, cardIds };
  }) as Board["columns"];
  return { columns, cards };
}
